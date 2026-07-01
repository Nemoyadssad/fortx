import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function clean(body: string): string {
  const b = (body ?? '').trim();
  if (!b) throw new BadRequestException('Message cannot be empty.');
  if (b.length > 2000) throw new BadRequestException('Message is too long.');
  return b;
}

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  private ensureThread(userId: string) {
    return this.prisma.supportThread.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  // ---- user side ----
  async userPoll(userId: string) {
    const thread = await this.ensureThread(userId);
    if (thread.userUnread > 0) {
      await this.prisma.supportThread.update({
        where: { id: thread.id },
        data: { userUnread: 0 },
      });
    }
    const messages = await this.prisma.supportMessage.findMany({
      where: { threadId: thread.id },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    return {
      threadId: thread.id,
      status: thread.status,
      messages: messages.map((m) => ({
        id: m.id,
        sender: m.sender,
        body: m.body,
        createdAt: m.createdAt,
      })),
    };
  }

  async userSend(userId: string, body: string) {
    const text = clean(body);
    const thread = await this.ensureThread(userId);
    const msg = await this.prisma.supportMessage.create({
      data: { threadId: thread.id, sender: 'USER', body: text },
    });
    await this.prisma.supportThread.update({
      where: { id: thread.id },
      data: { lastMessageAt: new Date(), status: 'OPEN', agentUnread: { increment: 1 } },
    });
    return { id: msg.id, sender: 'USER', body: msg.body, createdAt: msg.createdAt };
  }

  async userUnread(userId: string) {
    const t = await this.prisma.supportThread.findUnique({
      where: { userId },
      select: { userUnread: true, status: true },
    });
    return { count: t?.userUnread ?? 0, status: t?.status ?? 'OPEN' };
  }

  // ---- admin side ----
  async adminThreads() {
    const threads = await this.prisma.supportThread.findMany({
      orderBy: { lastMessageAt: 'desc' },
      take: 100,
      include: {
        user: { select: { email: true, displayName: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    return threads.map((t) => ({
      id: t.id,
      email: t.user.email,
      name: t.user.displayName,
      status: t.status,
      agentUnread: t.agentUnread,
      lastMessageAt: t.lastMessageAt,
      preview: t.messages[0]?.body ?? '',
      lastSender: t.messages[0]?.sender ?? null,
    }));
  }

  async adminUnreadCount() {
    const count = await this.prisma.supportThread.count({
      where: { agentUnread: { gt: 0 } },
    });
    return { count };
  }

  async adminThread(threadId: string) {
    const thread = await this.prisma.supportThread.findUnique({
      where: { id: threadId },
      include: { user: { select: { email: true, displayName: true } } },
    });
    if (!thread) throw new NotFoundException('Thread not found.');
    if (thread.agentUnread > 0) {
      await this.prisma.supportThread.update({
        where: { id: thread.id },
        data: { agentUnread: 0 },
      });
    }
    const messages = await this.prisma.supportMessage.findMany({
      where: { threadId },
      orderBy: { createdAt: 'asc' },
      take: 300,
    });
    return {
      id: thread.id,
      email: thread.user.email,
      name: thread.user.displayName,
      status: thread.status,
      messages: messages.map((m) => ({
        id: m.id,
        sender: m.sender,
        body: m.body,
        createdAt: m.createdAt,
      })),
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

  async adminSetStatus(threadId: string, status: 'OPEN' | 'CLOSED') {
    await this.prisma.supportThread.update({ where: { id: threadId }, data: { status } });
    return { ok: true, status };
  }
}
