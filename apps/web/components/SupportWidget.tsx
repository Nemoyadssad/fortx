'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send, Headset } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/app/providers';

interface Msg {
  id: string;
  sender: 'USER' | 'AGENT' | 'SYSTEM';
  body: string;
  createdAt: string;
}

export function SupportWidget() {
  const { email } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const openChat = () => setOpen(true);
    window.addEventListener('predikt:support', openChat);
    return () => window.removeEventListener('predikt:support', openChat);
  }, []);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [unread, setUnread] = useState(0);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const scrollToEnd = () =>
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });

  const pollOpen = useCallback(async () => {
    try {
      const d = await api.support.poll();
      setMessages(d.messages || []);
      setUnread(0);
      scrollToEnd();
    } catch {
      /* ignore */
    }
  }, []);

  const pollBadge = useCallback(async () => {
    try {
      const d = await api.support.myUnread();
      setUnread(d.count || 0);
    } catch {
      /* ignore */
    }
  }, []);

  // Badge polling while signed in and closed.
  useEffect(() => {
    if (!email || open) return;
    pollBadge();
    const t = setInterval(pollBadge, 12000);
    return () => clearInterval(t);
  }, [email, open, pollBadge]);

  // Conversation polling while open.
  useEffect(() => {
    if (!open || !email) return;
    pollOpen();
    const t = setInterval(pollOpen, 4000);
    return () => clearInterval(t);
  }, [open, email, pollOpen]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    setInput('');
    // optimistic
    setMessages((m) => [
      ...m,
      { id: `tmp-${Date.now()}`, sender: 'USER', body: text, createdAt: new Date().toISOString() },
    ]);
    scrollToEnd();
    try {
      await api.support.send(text);
      await pollOpen();
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }

  function toggle() {
    if (!email) {
      window.dispatchEvent(new CustomEvent('predikt:auth'));
      return;
    }
    setOpen((v) => !v);
  }

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
      {open && email && (
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
        </div>
      )}
    </>
  );
}
