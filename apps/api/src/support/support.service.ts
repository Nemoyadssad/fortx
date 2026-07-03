import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

/** A guest conversation resets after this much inactivity. */
const THREAD_EXPIRY_MS = 24 * 60 * 60 * 1000; // 1 day

function clean(body: string): string {
  const b = (body ?? '').trim();
  if (!b) throw new BadRequestException('Message cannot be empty.');
  if (b.length > 2000) throw new BadRequestException('Message is too long.');
  return b;
}

function cleanEmail(email: string): string {
  const e = (email ?? '').trim().toLowerCase();
  if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
    throw new BadRequestException('A valid email is required.');
  }
  return e;
}

function cleanName(name: string): string {
  const n = (name ?? '').trim();
  if (!n) throw new BadRequestException('Name is required.');
  if (n.length > 120) throw new BadRequestException('Name is too long.');
  return n;
}

/** Canned responses agents can send with one click. Edit freely. */
export const QUICK_REPLIES = [
  { id: 'greeting', label: 'Приветствие', text: 'Здравствуйте! Спасибо за обращение, чем можем помочь?' },
  { id: 'checking', label: 'Разбираемся', text: 'Спасибо, уже разбираемся в вопросе, дайте нам пару минут.' },
  { id: 'need-info', label: 'Нужны детали', text: 'Не могли бы вы уточнить детали — скриншот или ID заказа?' },
  { id: 'resolved', label: 'Решено', text: 'Проблема решена. Если появятся ещё вопросы — пишите!' },
  { id: 'closing', label: 'Закрытие диалога', text: 'Закрываем обращение, спасибо, что написали в поддержку!' },
];

/**
 * Self-service FAQ shown to the visitor BEFORE they open a ticket. Tapping
 * one answers instantly, client-side, with no agent involved. Edit these to
 * match your real most-asked questions — id must stay unique.
 */
export const FAQ_ITEMS = [
  {
    id: 'reset-password',
    question: 'Как сбросить пароль?',
    answer:
      'Откройте страницу входа → «Забыли пароль» → введите email. Мы пришлём ссылку для сброса, она активна 30 минут.',
  },
  {
    id: 'verify-account',
    question: 'Как подтвердить аккаунт?',
    answer:
      'Проверьте почту (в том числе папку «Спам») — там письмо со ссылкой подтверждения. Если письма нет, нажмите «Отправить письмо повторно» на странице входа.',
  },
  {
    id: 'payment-not-going',
    question: 'Платёж не проходит',
    answer:
      'Убедитесь, что на карте достаточно средств и включены онлайн-платежи. Если оплата всё равно отклоняется, попробуйте другой способ оплаты или обратитесь в банк.',
  },
  {
    id: 'withdrawal-time',
    question: 'Сколько идёт вывод средств?',
    answer: 'Обычно вывод обрабатывается в течение 1–24 часов в рабочие дни.',
  },
];

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  private newToken(): string {
    return randomBytes(24).toString('hex');
  }

  private isExpired(thread: { lastMessageAt: Date }): boolean {
    return Date.now() - new Date(thread.lastMessageAt).getTime() > THREAD_EXPIRY_MS;
  }

  // ---------------------------------------------------------------------
  // Guest flow — no login required. Identified by a random session token
  // that the client stores (e.g. localStorage) after /support/start.
  // ---------------------------------------------------------------------

  async guestStart(email: string, name: string, body: string) {
    const cleanedEmail = cleanEmail(email);
    const cleanedName = cleanName(name);
    const text = clean(body);

    let thread = await this.prisma.supportThread.findUnique({ where: { email: cleanedEmail } });

    // Fresh conversation if this is a new visitor, or the previous thread
    // was closed / went quiet for more than a day.
    if (!thread || thread.status === 'CLOSED' || this.isExpired(thread)) {
      const token = this.newToken();
      thread = thread
        ? await this.prisma.supportThread.update({
            where: { id: thread.id },
            data: { name: cleanedName, status: 'OPEN', token, userUnread: 0, agentUnread: 0 },
          })
        : await this.prisma.supportThread.create({
            data: { email: cleanedEmail, name: cleanedName, token, status: 'OPEN' },
          });
    }

    const msg = await this.prisma.supportMessage.create({
      data: { threadId: thread.id, sender: 'USER', body: text },
    });
    await this.prisma.supportThread.update({
      where: { id: thread.id },
      data: { lastMessageAt: new Date(), status: 'OPEN', agentUnread: { increment: 1 } },
    });

    return {
      threadId: thread.id,
      token: thread.token,
      messages: [{ id: msg.id, sender: 'USER', body: msg.body, createdAt: msg.createdAt }],
    };
  }

  private async threadByToken(token: string) {
    if (!token) throw new UnauthorizedException('Missing support session.');
    const thread = await this.prisma.supportThread.findFirst({ where: { token } });
    if (!thread) throw new UnauthorizedException('Support session expired or invalid.');
    return thread;
  }

  async guestPoll(token: string) {
    const thread = await this.threadByToken(token);
    if (thread.userUnread > 0) {
      await this.prisma.supportThread.update({ where: { id: thread.id }, data: { userUnread: 0 } });
    }
    const messages = await this.prisma.supportMessage.findMany({
      where: { threadId: thread.id },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    return {
      threadId: thread.id,
      status: thread.status,
      messages: messages.map((m) => ({ id: m.id, sender: m.sender, body: m.body, createdAt: m.createdAt })),
    };
  }

  async guestUnread(token: string) {
    const thread = await this.threadByToken(token);
    return { count: thread.userUnread, status: thread.status };
  }

  async guestSend(token: string, body: string) {
    const thread = await this.threadByToken(token);
    const text = clean(body);
    const msg = await this.prisma.supportMessage.create({
      data: { threadId: thread.id, sender: 'USER', body: text },
    });
    await this.prisma.supportThread.update({
      where: { id: thread.id },
      data: { lastMessageAt: new Date(), status: 'OPEN', agentUnread: { increment: 1 } },
    });
    return { id: msg.id, sender: 'USER', body: msg.body, createdAt: msg.createdAt };
  }

  // ---------------------------------------------------------------------
  // Admin side
  // ---------------------------------------------------------------------

  async adminThreads() {
    const threads = await this.prisma.supportThread.findMany({
      orderBy: { lastMessageAt: 'desc' },
      take: 100,
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    return threads.map((t) => ({
      id: t.id,
      email: t.email,
      name: t.name,
      status: t.status,
      agentUnread: t.agentUnread,
      lastMessageAt: t.lastMessageAt,
      preview: t.messages[0]?.body ?? '',
      lastSender: t.messages[0]?.sender ?? null,
    }));
  }

  async adminUnreadCount() {
    const count = await this.prisma.supportThread.count({ where: { agentUnread: { gt: 0 } } });
    return { count };
  }

  async adminThread(threadId: string) {
    const thread = await this.prisma.supportThread.findUnique({ where: { id: threadId } });
    if (!thread) throw new NotFoundException('Thread not found.');
    if (thread.agentUnread > 0) {
      await this.prisma.supportThread.update({ where: { id: thread.id }, data: { agentUnread: 0 } });
    }
    const messages = await this.prisma.supportMessage.findMany({
      where: { threadId },
      orderBy: { createdAt: 'asc' },
      take: 300,
    });
    return {
      id: thread.id,
      email: thread.email,
      name: thread.name,
      status: thread.status,
      messages: messages.map((m) => ({ id: m.id, sender: m.sender, body: m.body, createdAt: m.createdAt })),
    };
  }

  async adminReply(threadId: string, agentId: string, body: string) {
    const text = clean(body);
    const thread = await this.prisma.supportThread.findUnique({ where: { id: threadId } });
    if (!thread) throw new NotFoundException('Thread not found.');
    const msg = await this.prisma.supportMessage.create({
      data: { threadId, sender: 'AGENT', agentId, body: text },
    });
    await this.prisma.supportThread.update({
      where: { id: threadId },
      data: { lastMessageAt: new Date(), status: 'OPEN', userUnread: { increment: 1 } },
    });
    return { id: msg.id, sender: 'AGENT', body: msg.body, createdAt: msg.createdAt };
  }

  quickReplies() {
    return QUICK_REPLIES;
  }

  faqItems() {
    return FAQ_ITEMS;
  }

  async adminQuickReply(threadId: string, agentId: string, quickReplyId: string) {
    const qr = QUICK_REPLIES.find((q) => q.id === quickReplyId);
    if (!qr) throw new BadRequestException('Unknown quick reply.');
    return this.adminReply(threadId, agentId, qr.text);
  }

  async adminSetStatus(threadId: string, status: 'OPEN' | 'CLOSED') {
    await this.prisma.supportThread.update({ where: { id: threadId }, data: { status } });
    return { ok: true, status };
  }
}