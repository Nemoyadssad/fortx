'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send, Headset } from 'lucide-react';

// NOTE: this widget talks to the API directly with fetch, since the guest
// flow needs a custom `x-support-token` header. If you already have
// `api.support.*` helpers in `@/lib/api`, wire these calls through there
// instead — just make sure they accept/send the token header below.
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';
const TOKEN_KEY = 'predikt:supportToken';

interface Msg {
  id: string;
  sender: 'USER' | 'AGENT' | 'SYSTEM';
  body: string;
  createdAt: string;
}

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

async function api<T>(path: string, init?: RequestInit, token?: string | null): Promise<T> {
  const res = await fetch(`${API_BASE}/support${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'x-support-token': token } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`Support API error: ${res.status}`);
  return res.json();
}

export function SupportWidget() {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [unread, setUnread] = useState(0);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Self-service FAQ (shown before a real ticket is opened)
  const [faq, setFaq] = useState<FaqItem[]>([]);
  const [faqAnswer, setFaqAnswer] = useState<FaqItem | null>(null);
  const [showStartForm, setShowStartForm] = useState(false);

  // Guest start-form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [question, setQuestion] = useState('');
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  // Restore any existing session token on mount.
  useEffect(() => {
    setToken(localStorage.getItem(TOKEN_KEY));
    setHydrated(true);
  }, []);

  useEffect(() => {
    const openChat = () => setOpen(true);
    window.addEventListener('predikt:support', openChat);
    return () => window.removeEventListener('predikt:support', openChat);
  }, []);

  // Load the FAQ chips once, only needed while there's no open ticket.
  useEffect(() => {
    if (token) return;
    api<FaqItem[]>('/faq')
      .then(setFaq)
      .catch(() => setFaq([]));
  }, [token]);

  const scrollToEnd = () =>
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });

  const pollOpen = useCallback(async () => {
    if (!token) return;
    try {
      const d = await api<{ messages: Msg[]; status: 'OPEN' | 'CLOSED' }>('/thread', undefined, token);
      setMessages(d.messages || []);
      setUnread(0);
      scrollToEnd();
      // Conversation expired / was closed server-side (e.g. > 1 day idle) —
      // drop the stale session so the next visit starts fresh.
      if (d.status === 'CLOSED') {
        localStorage.removeItem(TOKEN_KEY);
      }
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
    }
  }, [token]);

  const pollBadge = useCallback(async () => {
    if (!token) return;
    try {
      const d = await api<{ count: number }>('/thread/unread', undefined, token);
      setUnread(d.count || 0);
    } catch {
      /* ignore */
    }
  }, [token]);

  // Badge polling while closed.
  useEffect(() => {
    if (!token || open) return;
    pollBadge();
    const t = setInterval(pollBadge, 12000);
    return () => clearInterval(t);
  }, [token, open, pollBadge]);

  // Conversation polling while open — keeps going indefinitely as long as
  // the widget stays open, no login/session timeout involved.
  useEffect(() => {
    if (!open || !token) return;
    pollOpen();
    const t = setInterval(pollOpen, 4000);
    return () => clearInterval(t);
  }, [open, token, pollOpen]);

  async function send() {
    const text = input.trim();
    if (!text || busy || !token) return;
    setBusy(true);
    setInput('');
    setMessages((m) => [
      ...m,
      { id: `tmp-${Date.now()}`, sender: 'USER', body: text, createdAt: new Date().toISOString() },
    ]);
    scrollToEnd();
    try {
      await api('/thread/messages', { method: 'POST', body: JSON.stringify({ body: text }) }, token);
      await pollOpen();
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }

  async function startConversation(prefillQuestion?: string) {
    if (starting) return;
    setStartError(null);
    const q = prefillQuestion ?? question;
    if (!name.trim() || !email.trim() || !q.trim()) {
      setStartError('Заполните имя, email и вопрос.');
      return;
    }
    setStarting(true);
    try {
      const d = await api<{ token: string; messages: Msg[] }>('/start', {
        method: 'POST',
        body: JSON.stringify({ name, email, body: q }),
      });
      localStorage.setItem(TOKEN_KEY, d.token);
      setToken(d.token);
      setMessages(d.messages || []);
      setQuestion('');
      scrollToEnd();
    } catch {
      setStartError('Не удалось отправить сообщение. Попробуйте ещё раз.');
    } finally {
      setStarting(false);
    }
  }

  function toggle() {
    setOpen((v) => !v);
  }

  function pickFaq(item: FaqItem) {
    setFaqAnswer(item);
  }

  if (!hydrated) return null;

  return (
    <>
      {/* launcher */}
      <button
        onClick={toggle}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-b from-gold to-gold-soft text-black shadow-gold transition hover:brightness-105"
        aria-label="Support chat"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        {!open && unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-lose px-1 text-[11px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>

      {/* panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-40 flex h-[28rem] w-[22rem] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border hairline bg-panel shadow-panel animate-riseIn">
          <div className="flex items-center gap-3 border-b hairline bg-fg/[0.02] px-4 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold/15">
              <Headset className="h-4 w-4 text-gold-deep" />
            </div>
            <div>
              <p className="text-sm font-semibold">Support</p>
              <p className="text-[11px] text-fg/45">We usually reply within a few minutes</p>
            </div>
          </div>

          {!token ? (
            <div className="flex flex-1 flex-col overflow-y-auto px-4 py-4">
              {!showStartForm ? (
                // ---- Step 1: self-service FAQ chips ----
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-fg/60">Возможно, ответ уже есть — выберите вопрос:</p>

                  <div className="flex flex-wrap gap-2">
                    {faq.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => pickFaq(item)}
                        className={`rounded-full border hairline px-3 py-1.5 text-xs transition ${
                          faqAnswer?.id === item.id
                            ? 'border-gold/50 bg-gold/15 text-fg'
                            : 'bg-fg/[0.03] text-fg/70 hover:bg-fg/[0.06]'
                        }`}
                      >
                        {item.question}
                      </button>
                    ))}
                  </div>

                  {faqAnswer && (
                    <div className="rounded-2xl rounded-bl-sm bg-fg/[0.05] px-3 py-2 text-sm text-fg/85">
                      {faqAnswer.answer}
                    </div>
                  )}

                  <button
                    onClick={() => {
                      setShowStartForm(true);
                      if (faqAnswer) setQuestion(faqAnswer.question);
                    }}
                    className="mt-1 text-left text-xs font-medium text-gold-deep underline underline-offset-2"
                  >
                    {faqAnswer ? 'Не помогло — написать в поддержку' : 'Не нашли ответ? Написать в поддержку'}
                  </button>
                </div>
              ) : (
                // ---- Step 2: guest start form (name + email + question) ----
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-fg/60">
                    Оставьте контакт и опишите вопрос — мы ответим вам в этом чате.
                  </p>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ваше имя"
                    className="w-full rounded-xl border hairline bg-fg/[0.03] px-3 py-2.5 text-sm outline-none focus:border-gold/50"
                  />
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    type="email"
                    className="w-full rounded-xl border hairline bg-fg/[0.03] px-3 py-2.5 text-sm outline-none focus:border-gold/50"
                  />
                  <textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Ваш вопрос…"
                    rows={3}
                    className="w-full resize-none rounded-xl border hairline bg-fg/[0.03] px-3 py-2.5 text-sm outline-none focus:border-gold/50"
                  />
                  {startError && <p className="text-xs text-lose">{startError}</p>}
                  <button
                    onClick={() => startConversation()}
                    disabled={starting}
                    className="mt-1 flex h-10 items-center justify-center rounded-xl bg-gradient-to-b from-gold to-gold-soft text-sm font-semibold text-black transition hover:brightness-105 disabled:opacity-50"
                  >
                    {starting ? 'Отправка…' : 'Начать чат'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {messages.length === 0 ? (
                  <p className="mt-6 text-center text-sm text-fg/40">
                    Hi! 👋 How can we help you today?
                  </p>
                ) : (
                  messages.map((m) => {
                    const mine = m.sender === 'USER';
                    return (
                      <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                            mine
                              ? 'rounded-br-sm bg-gold/15 text-fg'
                              : 'rounded-bl-sm bg-fg/[0.05] text-fg/85'
                          }`}
                        >
                          {m.body}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="flex items-center gap-2 border-t hairline p-3">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && send()}
                  placeholder="Type a message…"
                  className="w-full rounded-xl border hairline bg-fg/[0.03] px-3 py-2.5 text-sm outline-none focus:border-gold/50"
                />
                <button
                  onClick={send}
                  disabled={busy || !input.trim()}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-gold to-gold-soft text-black transition hover:brightness-105 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}