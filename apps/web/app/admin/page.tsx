'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { TOPIC_NAMES } from '@/lib/topics';
import { useAuth } from '@/app/providers';
import { fmtMoney, pct } from '@/lib/format';

type Tab = 'dashboard' | 'users' | 'markets' | 'create' | 'support' | 'promos' | 'control' | 'broadcast';

const ROLES = ['USER', 'SUPPORT', 'ADMIN', 'SUPERADMIN'];
const STATUSES = ['ACTIVE', 'SUSPENDED', 'BANNED'];

export default function AdminPage() {
  const { role, loading } = useAuth();
  const [tab, setTab] = useState<Tab>('dashboard');
  const isAdmin = role === 'ADMIN' || role === 'SUPERADMIN';
  const [supportUnread, setSupportUnread] = useState(0);
  useEffect(() => {
    if (!isAdmin) return;
    const load = () =>
      api.support.unreadCount().then((d) => setSupportUnread(d.count || 0)).catch(() => {});
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [isAdmin]);

  if (loading) {
    return <div className="mx-auto max-w-7xl px-5 py-20 text-fg/50">Loading…</div>;
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-7xl px-5 py-24 text-center">
        <h1 className="font-display text-2xl font-bold">Admin access only</h1>
        <p className="mt-2 text-fg/50">
          Sign in with an admin account to manage the platform.
        </p>
        <a href="/" className="mt-6 inline-block text-gold-deep hover:underline">
          ← Back to site
        </a>
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'users', label: 'Users' },
    { id: 'markets', label: 'Markets & results' },
    { id: 'create', label: 'New event' },
    { id: 'support', label: 'Support' },
    { id: 'promos', label: 'Promo codes' },
    { id: 'control', label: 'Game control' },
    { id: 'broadcast', label: 'Broadcast' },
  ];

  return (
    <div className="mx-auto max-w-7xl px-5 py-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">
          Admin <span className="gold-text">console</span>
        </h1>
        <a href="/" className="text-sm text-fg/50 hover:text-fg">
          ← Back to site
        </a>
      </div>

      <div className="mt-6 flex flex-wrap gap-1 overflow-x-auto rounded-2xl border hairline bg-panel/50 p-1.5 [&::-webkit-scrollbar]:hidden">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex shrink-0 items-center rounded-xl px-4 py-2 text-sm transition ${
              tab === t.id
                ? 'bg-gradient-to-b from-gold to-gold-soft font-bold text-black shadow-gold'
                : 'text-fg/55 hover:bg-fg/[0.05] hover:text-fg'
            }`}
          >
            {t.label}
            {t.id === 'support' && supportUnread > 0 && (
              <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-lose px-1 text-[11px] font-bold text-white">
                {supportUnread}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === 'dashboard' && <Dashboard />}
        {tab === 'users' && <Users />}
        {tab === 'markets' && <Markets />}
        {tab === 'create' && <CreateEvent />}
        {tab === 'support' && <Support />}
        {tab === 'promos' && <Promos />}
        {tab === 'control' && <GameControl />}
        {tab === 'broadcast' && <Broadcast />}
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl panel p-5">
      <p className="font-mono text-[10px] uppercase tracking-widest text-fg/40">{label}</p>
      <p className="mt-2 font-display text-2xl font-bold text-fg/95">{value}</p>
    </div>
  );
}

function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.admin.stats().then(setStats).catch(() => {});
  }, []);
  useEffect(() => load(), [load]);

  async function sync() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.admin.sync();
      setMsg(
        r?.skipped
          ? 'A sync was already running.'
          : `Synced: ${r.imported} imported, ${r.resolved} resolved.`,
      );
      load();
    } catch (e: any) {
      setMsg(e?.message || 'Sync failed');
    } finally {
      setBusy(false);
    }
  }

  if (!stats) return <p className="text-fg/40">Loading…</p>;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card label="Users" value={stats.users} />
        <Card label="Events" value={stats.events} />
        <Card label="Open markets" value={stats.openMarkets} />
        <Card label="Open bets" value={stats.openBets} />
        <Card label="House balance" value={fmtMoney(stats.houseBalance)} />
      </div>
      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={sync}
          disabled={busy}
          className="rounded-xl bg-gradient-to-b from-gold to-gold-soft px-5 py-2.5 font-bold text-black shadow-gold transition hover:brightness-105 disabled:opacity-60"
        >
          {busy ? 'Syncing…' : 'Sync Polymarket now'}
        </button>
        {msg && <span className="text-sm text-fg/60">{msg}</span>}
      </div>
    </>
  );
}

function Users() {
  const [users, setUsers] = useState<any[]>([]);
  const [reportId, setReportId] = useState<string | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    api.admin.users().then(setUsers).catch(() => {});
  }, []);
  useEffect(() => load(), [load]);

  async function update(id: string, data: { role?: string; status?: string }) {
    try {
      await api.admin.updateUser(id, data);
      load();
    } catch (e: any) {
      setMsg(e?.message || 'Update failed');
    }
  }

  async function adjust(id: string) {
    const amount = Number(amounts[id]);
    if (!amount) return;
    try {
      await api.admin.adjust(id, amount, 'Admin adjustment');
      setAmounts((a) => ({ ...a, [id]: '' }));
      setMsg(`Adjusted ${fmtMoney(amount)} for ${id.slice(0, 8)}.`);
      load();
    } catch (e: any) {
      setMsg(e?.message || 'Adjustment failed');
    }
  }

  async function resetPassword(id: string, email: string) {
    if (!confirm(`Сбросить пароль для ${email}?`)) return;
    try {
      const r = await api.admin.resetPassword(id);
      setMsg(
        r?.tempPassword
          ? `Новый пароль для ${email}: ${r.tempPassword}`
          : `Письмо для сброса пароля отправлено на ${email}.`,
      );
    } catch (e: any) {
      setMsg(e?.message || 'Не удалось сбросить пароль');
    }
  }

  return (
    <div className="rounded-2xl panel">
      {msg && <p className="border-b hairline px-5 py-3 text-sm text-gold-deep">{msg}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left font-mono text-[10px] uppercase tracking-widest text-fg/40">
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Balance</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Adjust balance</th>
              <th className="px-4 py-3">Report</th>
              <th className="px-4 py-3">Password</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t hairline">
                <td className="px-4 py-3 text-fg/85">{u.email}</td>
                <td className="px-4 py-3 font-mono text-gold-deep">{fmtMoney(u.cash)}</td>
                <td className="px-4 py-3">
                  <select
                    value={u.role}
                    onChange={(e) => update(u.id, { role: e.target.value })}
                    className="rounded-lg border hairline bg-fg/[0.03] px-2 py-1 text-fg/80 outline-none"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r} className="bg-panel">
                        {r}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={u.status}
                    onChange={(e) => update(u.id, { status: e.target.value })}
                    className="rounded-lg border hairline bg-fg/[0.03] px-2 py-1 text-fg/80 outline-none"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s} className="bg-panel">
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="+/-"
                      value={amounts[u.id] ?? ''}
                      onChange={(e) =>
                        setAmounts((a) => ({ ...a, [u.id]: e.target.value }))
                      }
                      className="w-24 rounded-lg border hairline bg-fg/[0.03] px-2 py-1 font-mono outline-none"
                    />
                    <button
                      onClick={() => adjust(u.id)}
                      className="rounded-lg border border-gold/30 px-3 py-1 text-gold-deep transition hover:bg-gold/10"
                    >
                      Apply
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => setReportId(u.id)}
                    className="rounded-lg border hairline px-3 py-1 text-fg/70 transition hover:border-gold/40 hover:text-gold-deep"
                  >
                    View
                  </button>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => resetPassword(u.id, u.email)}
                    className="rounded-lg border hairline px-3 py-1 text-fg/70 transition hover:border-lose/40 hover:text-lose"
                  >
                    Reset password
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {reportId && <PlayerReportModal id={reportId} onClose={() => setReportId(null)} />}
    </div>
  );
}

function Markets() {
  const [markets, setMarkets] = useState<any[]>([]);
  const [status, setStatus] = useState('OPEN');
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    api.admin.markets(status).then(setMarkets).catch(() => {});
  }, [status]);
  useEffect(() => load(), [load]);

  async function resolve(marketId: string) {
    const outcomeId = picks[marketId];
    if (!outcomeId) {
      setMsg('Pick a winning outcome first.');
      return;
    }
    try {
      const r = await api.admin.resolve(marketId, outcomeId);
      setMsg(`Resolved. Settled ${r.resolved} bet(s).`);
      load();
    } catch (e: any) {
      setMsg(e?.message || 'Resolve failed');
    }
  }

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        {['OPEN', 'CLOSED', 'RESOLVED'].map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              status === s
                ? 'border-gold/50 bg-gold/10 text-gold-deep'
                : 'border-fg/[0.06] text-fg/55 hover:text-fg'
            }`}
          >
            {s}
          </button>
        ))}
        {msg && <span className="ml-2 text-sm text-gold-deep">{msg}</span>}
      </div>

      <div className="space-y-3">
        {markets.length === 0 && (
          <p className="text-fg/40">No markets with this status.</p>
        )}
        {markets.map((m) => (
          <div key={m.id} className="rounded-2xl panel p-4">
            <p className="text-sm text-fg/85">{m.question}</p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-fg/35">
              {m.event?.title}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {m.outcomes.map((o: any) => (
                <button
                  key={o.id}
                  onClick={() => setPicks((p) => ({ ...p, [m.id]: o.id }))}
                  className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                    picks[m.id] === o.id
                      ? 'border-gold bg-gold/10 text-gold-deep'
                      : 'border-fg/[0.06] text-fg/60 hover:text-fg'
                  }`}
                >
                  {o.label} · {pct(o.price)}%
                </button>
              ))}
              {m.status !== 'RESOLVED' && (
                <button
                  onClick={() => resolve(m.id)}
                  className="ml-auto rounded-lg bg-gradient-to-b from-gold to-gold-soft px-4 py-1.5 text-xs font-bold text-black shadow-gold transition hover:brightness-105"
                >
                  Resolve as winner
                </button>
              )}
              {m.status === 'RESOLVED' && (
                <span className="ml-auto text-xs text-win">Resolved</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function CreateEvent() {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [question, setQuestion] = useState('');
  const [outcomes, setOutcomes] = useState([
    { label: 'Yes', price: 0.5 },
    { label: 'No', price: 0.5 },
  ]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function setOutcome(i: number, key: 'label' | 'price', value: string) {
    setOutcomes((arr) =>
      arr.map((o, idx) =>
        idx === i ? { ...o, [key]: key === 'price' ? Number(value) : value } : o,
      ),
    );
  }

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      await api.admin.createEvent({ title, category: category || undefined, question, outcomes });
      setMsg('Event created and live on the site.');
      setTitle('');
      setCategory('');
      setQuestion('');
      setOutcomes([
        { label: 'Yes', price: 0.5 },
        { label: 'No', price: 0.5 },
      ]);
    } catch (e: any) {
      setMsg(e?.message || 'Could not create event');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl rounded-2xl panel p-6">
      <p className="text-sm text-fg/55">
        Create your own market. It goes live immediately and you resolve it later under
        Markets &amp; results.
      </p>
      <div className="mt-5 space-y-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Event title (e.g. Champions League final)"
          className="w-full rounded-xl border hairline bg-fg/[0.03] px-4 py-3 text-sm outline-none focus:border-gold/50"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full rounded-xl border hairline bg-fg/[0.03] px-4 py-3 text-sm outline-none focus:border-gold/50"
        >
          <option value="">Topic (optional)</option>
          {TOPIC_NAMES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Question (e.g. Will Real Madrid win?)"
          className="w-full rounded-xl border hairline bg-fg/[0.03] px-4 py-3 text-sm outline-none focus:border-gold/50"
        />

        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-fg/40">
            Outcomes (price = probability 0–1)
          </p>
          {outcomes.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={o.label}
                onChange={(e) => setOutcome(i, 'label', e.target.value)}
                placeholder="Label"
                className="flex-1 rounded-lg border hairline bg-fg/[0.03] px-3 py-2 text-sm outline-none focus:border-gold/50"
              />
              <input
                type="number"
                step="0.01"
                min="0.01"
                max="0.99"
                value={o.price}
                onChange={(e) => setOutcome(i, 'price', e.target.value)}
                className="w-24 rounded-lg border hairline bg-fg/[0.03] px-3 py-2 font-mono text-sm outline-none focus:border-gold/50"
              />
              {outcomes.length > 2 && (
                <button
                  onClick={() => setOutcomes((arr) => arr.filter((_, idx) => idx !== i))}
                  className="rounded-lg border hairline px-3 py-2 text-fg/50 hover:text-fg"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button
            onClick={() => setOutcomes((arr) => [...arr, { label: '', price: 0.5 }])}
            className="text-sm text-gold-deep hover:underline"
          >
            + Add outcome
          </button>
        </div>

        {msg && <p className="text-sm text-gold-deep">{msg}</p>}
        <button
          onClick={submit}
          disabled={busy || !title || !question}
          className="rounded-xl bg-gradient-to-b from-gold to-gold-soft px-6 py-3 font-bold text-black shadow-gold transition hover:brightness-105 disabled:opacity-50"
        >
          {busy ? 'Creating…' : 'Create event'}
        </button>
      </div>
    </div>
  );
}

function Support() {
  const [threads, setThreads] = useState<any[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [thread, setThread] = useState<any | null>(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const loadThreads = useCallback(() => {
    api.support
      .threads()
      .then((d) => setThreads(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const loadThread = useCallback((id: string) => {
    api.support
      .thread(id)
      .then((d) => {
        setThread(d);
        requestAnimationFrame(() => {
          if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadThreads();
    const t = setInterval(loadThreads, 5000);
    return () => clearInterval(t);
  }, [loadThreads]);

  useEffect(() => {
    if (!activeId) return;
    loadThread(activeId);
    const t = setInterval(() => loadThread(activeId), 4000);
    return () => clearInterval(t);
  }, [activeId, loadThread]);

  async function send() {
    const text = reply.trim();
    if (!text || !activeId || busy) return;
    setBusy(true);
    setReply('');
    try {
      await api.support.reply(activeId, text);
      await loadThread(activeId);
      loadThreads();
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }

  const time = (s: string) =>
    new Date(s).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      {/* thread list */}
      <div className="rounded-2xl panel">
        <div className="border-b hairline px-4 py-3">
          <h2 className="font-display text-sm font-semibold text-fg/80">Conversations</h2>
        </div>
        <div className="max-h-[32rem] overflow-y-auto">
          {threads.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-fg/35">No conversations yet.</p>
          ) : (
            threads.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveId(t.id)}
                className={`flex w-full items-start gap-3 border-b hairline px-4 py-3 text-left transition hover:bg-fg/[0.03] ${
                  activeId === t.id ? 'bg-gold/[0.06]' : ''
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fg/85">{t.email}</p>
                  <p className="truncate text-xs text-fg/45">
                    {t.lastSender === 'AGENT' ? 'You: ' : ''}
                    {t.preview || '—'}
                  </p>
                </div>
                {t.agentUnread > 0 && (
                  <span className="mt-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-lose px-1 text-[11px] font-bold text-white">
                    {t.agentUnread}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* conversation */}
      <div className="flex h-[34rem] flex-col rounded-2xl panel">
        {!thread ? (
          <div className="flex flex-1 items-center justify-center text-sm text-fg/35">
            Select a conversation to reply.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b hairline px-4 py-3">
              <div>
                <p className="text-sm font-semibold">{thread.email}</p>
                <p className="text-[11px] text-fg/45">{thread.status}</p>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {thread.messages.map((m: any) => {
                const agent = m.sender === 'AGENT';
                return (
                  <div key={m.id} className={`flex ${agent ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                        agent
                          ? 'rounded-br-sm bg-gold/15 text-fg'
                          : 'rounded-bl-sm bg-fg/[0.05] text-fg/85'
                      }`}
                    >
                      {m.body}
                      <span className="mt-1 block text-right text-[10px] text-fg/35">
                        {time(m.createdAt)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-2 border-t hairline p-3">
              <input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                placeholder="Type your reply…"
                className="w-full rounded-xl border hairline bg-fg/[0.03] px-3 py-2.5 text-sm outline-none focus:border-gold/50"
              />
              <button
                onClick={send}
                disabled={busy || !reply.trim()}
                className="rounded-xl bg-gradient-to-b from-gold to-gold-soft px-4 py-2.5 text-sm font-bold text-black transition hover:brightness-105 disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Broadcast() {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function send() {
    const body = text.trim();
    if (!body) return;
    if (!confirm(`Send this to ALL users?\n\n"${body}"`)) return;
    setBusy(true);
    setMsg(null);
    try {
      await api.admin.broadcast(body);
      setMsg({ ok: true, text: 'Sent to all users.' });
      setText('');
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || 'Could not send broadcast.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl rounded-2xl panel p-6">
      <h2 className="font-display text-lg font-bold">Broadcast notification</h2>
      <p className="mt-1 text-sm text-fg/55">
        Sends an announcement to every user&rsquo;s notification bell.
      </p>
      <div className="mt-4 space-y-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message text…"
          rows={4}
          maxLength={500}
          className="w-full resize-none rounded-xl border hairline bg-fg/[0.03] px-4 py-3 text-sm outline-none focus:border-gold/50"
        />
        <p className="text-right text-xs text-fg/35">{text.length}/500</p>
        {msg && <p className={`text-sm ${msg.ok ? 'text-win' : 'text-lose'}`}>{msg.text}</p>}
        <button
          onClick={send}
          disabled={busy || !text.trim()}
          className="rounded-xl bg-gradient-to-b from-gold to-gold-soft px-6 py-3 font-bold text-black shadow-gold transition hover:brightness-105 disabled:opacity-50"
        >
          {busy ? 'Sending…' : 'Send to all users'}
        </button>
      </div>
    </div>
  );
}

function Promos() {
  const [list, setList] = useState<any[]>([]);
  const [code, setCode] = useState('');
  const [amount, setAmount] = useState(500);
  const [maxUses, setMaxUses] = useState(0);
  const [expiresAt, setExpiresAt] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => api.admin.promos().then(setList).catch(() => {});
  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (!code.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      await api.admin.createPromo({
        code: code.trim(),
        amount,
        maxUses: maxUses || undefined,
        expiresAt: expiresAt || undefined,
      });
      setMsg({ ok: true, text: 'Promo code created.' });
      setCode('');
      load();
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || 'Could not create code.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
      <div className="rounded-2xl panel p-5">
        <h2 className="font-display text-lg font-bold">New promo code</h2>
        <div className="mt-4 space-y-3">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="CODE (e.g. WELCOME50)"
            className="w-full rounded-xl border hairline bg-fg/[0.03] px-4 py-3 text-sm uppercase outline-none focus:border-gold/50"
          />
          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-fg/40">Amount ($)</label>
            <input
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(Math.max(1, Number(e.target.value)))}
              className="mt-1 w-full rounded-xl border hairline bg-fg/[0.03] px-4 py-2.5 font-mono outline-none focus:border-gold/50"
            />
          </div>
          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-fg/40">Max uses (0 = unlimited)</label>
            <input
              type="number"
              min={0}
              value={maxUses}
              onChange={(e) => setMaxUses(Math.max(0, Number(e.target.value)))}
              className="mt-1 w-full rounded-xl border hairline bg-fg/[0.03] px-4 py-2.5 font-mono outline-none focus:border-gold/50"
            />
          </div>
          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-fg/40">Expires (optional)</label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="mt-1 w-full rounded-xl border hairline bg-fg/[0.03] px-4 py-2.5 text-sm outline-none focus:border-gold/50"
            />
          </div>
          <button
            onClick={create}
            disabled={busy}
            className="w-full rounded-xl bg-gradient-to-b from-gold to-gold-soft py-3 font-bold text-black shadow-gold transition hover:brightness-105 disabled:opacity-50"
          >
            {busy ? 'Creating…' : 'Create code'}
          </button>
          {msg && <p className={`text-center text-sm ${msg.ok ? 'text-win' : 'text-lose'}`}>{msg.text}</p>}
        </div>
      </div>

      <div className="rounded-2xl panel">
        <div className="border-b hairline px-5 py-3">
          <h2 className="font-display text-lg font-bold">Active codes</h2>
        </div>
        {list.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-fg/40">No promo codes yet.</p>
        ) : (
          <div className="divide-y divide-fg/[0.04]">
            {list.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                <span className="font-mono font-bold text-gold-deep">{p.code}</span>
                <span className="text-fg/70">{'$' + Number(p.amount).toLocaleString()}</span>
                <span className="ml-auto text-fg/45">
                  {p.uses}/{p.maxUses === 0 ? '∞' : p.maxUses} used
                </span>
                {p.expiresAt && (
                  <span className="text-fg/35">· exp {new Date(p.expiresAt).toLocaleDateString()}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const SECTIONS = [
  { id: 'edge', label: 'House edge (RTP)' },
  { id: 'winchance', label: 'Win chance' },
  { id: 'games', label: 'Games on/off' },
  { id: 'limits', label: 'Bet limits' },
  { id: 'highstake', label: 'High-stake edge' },
  { id: 'extra', label: 'Coinflip & Crash' },
  { id: 'cases', label: 'Cases' },
  { id: 'wheel', label: 'Daily wheel' },
  { id: 'bonuses', label: 'Bonuses' },
  { id: 'missions', label: 'Missions' },
];

const F = 'w-full rounded-xl border hairline bg-fg/[0.03] px-3 py-2 font-mono text-sm outline-none focus:border-gold/50';
const LAB = 'font-mono text-[10px] uppercase tracking-widest text-fg/40';

function Hint({ children }: { children: any }) {
  return <p className="mt-1 text-xs leading-relaxed text-fg/45">{children}</p>;
}
function NumField({ label, value, onChange, step = 1, suffix }: any) {
  return (
    <div>
      <label className={LAB}>{label}</label>
      <div className="relative mt-1">
        <input type="number" step={step} value={Number.isFinite(value) ? value : 0} onChange={(e) => onChange(Number(e.target.value))} className={F} />
        {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-fg/30">{suffix}</span>}
      </div>
    </div>
  );
}

const RARITIES = ['nothing', 'common', 'rare', 'epic', 'legendary', 'mythic'];
const RARITY_COL: Record<string, string> = {
  nothing: '#5b6472', common: '#9aa4b2', rare: '#3aa3ff', epic: '#b96cff', legendary: '#f5c542', mythic: '#ff4d6d',
};

function CaseTableEditor({ cid, rows, setCfg }: { cid: string; rows: any[]; setCfg: any }) {
  const free = cid === 'free';
  function mutate(fn: (arr: any[]) => any[]) {
    setCfg((c: any) => {
      const next = structuredClone(c);
      if (!next.cases.tables) next.cases.tables = {};
      next.cases.tables[cid] = fn(next.cases.tables[cid] ?? []);
      return next;
    });
  }
  const setRow = (i: number, field: string, value: any) => mutate((arr) => { arr[i] = { ...arr[i], [field]: value }; return arr; });
  const addRow = () => mutate((arr) => [...arr, free ? { amount: 50, weight: 10, rarity: 'common' } : { mult: 1, weight: 10, rarity: 'rare' }]);
  const removeRow = (i: number) => mutate((arr) => arr.filter((_, j) => j !== i));

  const totalW = rows.reduce((s, r) => s + (Number(r.weight) || 0), 0) || 1;

  return (
    <div className="rounded-2xl panel p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-bold capitalize">{cid} case — drops</h3>
        <button onClick={addRow} className="rounded-lg border border-gold/40 px-3 py-1.5 text-xs font-semibold text-gold-deep transition hover:bg-gold/10">+ Add drop</button>
      </div>
      <Hint>{free ? 'Value is a flat $ amount.' : 'Value is a multiplier of the case cost (e.g. 2 = 2× the price).'} Weight = relative chance (set everything to 0 except one row to force that drop). Set a row to rarity &ldquo;nothing&rdquo; for an empty result.</Hint>
      <div className="mt-3 space-y-2">
        <div className="grid grid-cols-[1fr_1fr_1.2fr_70px_28px] gap-2 px-1 font-mono text-[9px] uppercase tracking-wider text-fg/35">
          <span>{free ? 'Amount $' : 'Mult ×'}</span><span>Weight</span><span>Rarity</span><span>Chance</span><span />
        </div>
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_1.2fr_70px_28px] items-center gap-2">
            <input type="number" step={free ? 1 : 0.1} value={free ? (r.amount ?? 0) : (r.mult ?? 0)}
              onChange={(e) => setRow(i, free ? 'amount' : 'mult', Number(e.target.value))} className={F} />
            <input type="number" step={0.5} value={r.weight ?? 0} onChange={(e) => setRow(i, 'weight', Number(e.target.value))} className={F} />
            <select value={r.rarity ?? 'common'} onChange={(e) => setRow(i, 'rarity', e.target.value)} className={F} style={{ color: RARITY_COL[r.rarity] }}>
              {RARITIES.map((x) => <option key={x} value={x} style={{ color: '#fff' }}>{x}</option>)}
            </select>
            <span className="text-center font-mono text-xs text-fg/55">{(((Number(r.weight) || 0) / totalW) * 100).toFixed(1)}%</span>
            <button onClick={() => removeRow(i)} className="text-fg/30 transition hover:text-lose" title="Remove">✕</button>
          </div>
        ))}
        {!rows.length && <p className="text-xs text-fg/35">No drops — add at least one.</p>}
      </div>
    </div>
  );
}

function GameControl() {
  const [cfg, setCfg] = useState<any | null>(null);
  const [sec, setSec] = useState('edge');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => { api.admin.settings().then(setCfg).catch(() => {}); }, []);

  function setPath(path: (string | number)[], value: any) {
    setCfg((c: any) => {
      const next = structuredClone(c);
      let o = next;
      for (let i = 0; i < path.length - 1; i++) o = o[path[i]];
      o[path[path.length - 1]] = value;
      return next;
    });
  }

  async function save() {
    setBusy(true); setMsg(null);
    try {
      const saved = await api.admin.updateSettings(cfg);
      setCfg(saved);
      setMsg({ ok: true, text: 'Saved — applies to new rounds instantly.' });
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || 'Could not save.' });
    } finally { setBusy(false); }
  }

  if (!cfg) return <p className="text-fg/40">Loading…</p>;
  const EDGE_GAMES = ['dice', 'plinko', 'mines', 'climber', 'crash'];
  const GAME_KEYS = ['dice', 'plinko', 'mines', 'tower', 'ladder', 'crash', 'coinflip', 'roulette', 'cases'];

  return (
    <div className="grid gap-5 lg:grid-cols-[200px_1fr]">
      {/* sub-nav */}
      <div className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
        {SECTIONS.map((x) => (
          <button key={x.id} onClick={() => setSec(x.id)} className={`shrink-0 rounded-xl px-3 py-2 text-left text-sm transition lg:w-full ${sec === x.id ? 'bg-gold/15 font-semibold text-gold-deep' : 'text-fg/60 hover:bg-fg/[0.04] hover:text-fg'}`}>
            {x.label}
          </button>
        ))}
      </div>

      <div className="space-y-5">
        {sec === 'edge' && (
          <div className="rounded-2xl panel p-5">
            <h2 className="font-display text-lg font-bold">House edge (RTP %)</h2>
            <Hint>RTP controls the <b className="text-fg/70">size of wins</b> (payout multiplier), not how often they happen. 97% is standard; 0% makes wins pay nothing. To control how <b className="text-fg/70">often</b> players win, use the <b className="text-gold-deep">Win chance</b> tab.</Hint>
            <div className="mt-4 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {EDGE_GAMES.map((g) => (
                <NumField key={g} label={g} step={0.5} suffix="%"
                  value={Math.round((cfg.edge?.[g] ?? 0.97) * 1000) / 10}
                  onChange={(v: number) => setPath(['edge', g], Math.max(0, Math.min(5, v / 100)))} />
              ))}
            </div>
          </div>
        )}

        {sec === 'winchance' && (
          <div className="rounded-2xl panel p-5">
            <h2 className="font-display text-lg font-bold">Win chance (%)</h2>
            <Hint>How <b className="text-fg/70">often</b> players win, independent of payout size. <b className="text-fg/70">100% = fair odds. 0% = players always lose their bet</b> (in Mines/Tower/Ladder they bust immediately; Crash crashes at 1.00; Dice/Coinflip always lose). Above 100% lets players win more often. Plinko &amp; Roulette use RTP only.</Hint>
            <div className="mt-4 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {['dice', 'mines', 'crash', 'coinflip', 'tower', 'ladder'].map((g) => (
                <NumField key={g} label={g} step={5} suffix="%"
                  value={Math.round((cfg.winChance?.[g] ?? 1) * 100)}
                  onChange={(v: number) => setPath(['winChance', g], Math.max(0, Math.min(1.5, v / 100)))} />
              ))}
            </div>
          </div>
        )}

        {sec === 'games' && (
          <div className="rounded-2xl panel p-5">
            <h2 className="font-display text-lg font-bold">Enable / disable games</h2>
            <Hint>Turn a game off and players can&rsquo;t stake on it — the attempt is rejected and the card is greyed out on the site.</Hint>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {GAME_KEYS.map((g) => {
                const on = cfg.games?.[g] !== false;
                return (
                  <button key={g} onClick={() => setPath(['games', g], !on)} className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm capitalize transition ${on ? 'border-win/40 bg-win/10 text-win' : 'border-fg/[0.08] text-fg/45'}`}>
                    {g}
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${on ? 'bg-win/20' : 'bg-fg/[0.06]'}`}>{on ? 'ON' : 'OFF'}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {sec === 'highstake' && (
          <div className="space-y-5 rounded-2xl panel p-5">
            <h2 className="font-display text-lg font-bold">High-stake edge</h2>
            <Hint>When a player bets <b className="text-fg/70">at or above the threshold</b>, their win-chance multiplier is reduced by the factor below. This makes large bets harder to win — independently of RTP. <b className="text-gold-deep">Example:</b> threshold $20, factor 70% → a player betting $20+ wins only 70% as often.</Hint>
            <div className="grid gap-4 sm:grid-cols-2">
              <NumField
                label="Threshold ($)"
                suffix="$"
                value={cfg.highStake?.threshold ?? 20}
                onChange={(v: number) => setPath(['highStake', 'threshold'], v)}
              />
              <NumField
                label="Win-chance factor (%)"
                suffix="%"
                value={Math.round((cfg.highStake?.factor ?? 0.7) * 100)}
                onChange={(v: number) => setPath(['highStake', 'factor'], Math.max(10, Math.min(100, v)) / 100)}
              />
            </div>
            <p className="text-xs text-fg/40">
              Currently: bets ≥ ${cfg.highStake?.threshold ?? 20} → win chance ×{Math.round((cfg.highStake?.factor ?? 0.7) * 100)}%
            </p>
          </div>
        )}

        {sec === 'limits' && (
          <div className="rounded-2xl panel p-5">
            <h2 className="font-display text-lg font-bold">Bet limits</h2>
            <Hint>Min/max stake per bet, applied to all games and predictions (case prices are exempt).</Hint>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <NumField label="Min stake" suffix="$" value={cfg.limits?.minStake} onChange={(v: number) => setPath(['limits', 'minStake'], v)} />
              <NumField label="Max stake" suffix="$" value={cfg.limits?.maxStake} onChange={(v: number) => setPath(['limits', 'maxStake'], v)} />
            </div>
          </div>
        )}

        {sec === 'extra' && (
          <div className="rounded-2xl panel p-5">
            <h2 className="font-display text-lg font-bold">Coinflip & Crash</h2>
            <Hint>Coinflip payout is the win multiplier (2.0 = fair, &lt;2 gives the house an edge). Crash half-life is the seconds for the multiplier to double — smaller = faster &amp; riskier.</Hint>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <NumField label="Coinflip payout" step={0.01} suffix="×" value={cfg.coinflip?.payout} onChange={(v: number) => setPath(['coinflip', 'payout'], v)} />
              <NumField label="Crash half-life" step={0.5} suffix="s" value={cfg.crash?.halfLife} onChange={(v: number) => setPath(['crash', 'halfLife'], v)} />
            </div>
          </div>
        )}

        {sec === 'cases' && (
          <div className="space-y-5">
            <div className="rounded-2xl panel p-5">
              <h2 className="font-display text-lg font-bold">Mystery cases</h2>
              <Hint><b className="text-fg/70">Luck</b> shrinks the chance of an empty (&ldquo;nothing&rdquo;) drop — &gt;1 = players win more often. Costs set the price of each paid case. <b className="text-fg/70">Note:</b> the RTP slider does NOT affect cases — drops are controlled entirely by the tables below.</Hint>
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <NumField label="Luck" step={0.1} suffix="×" value={cfg.cases?.luck} onChange={(v: number) => setPath(['cases', 'luck'], v)} />
                <NumField label="Bronze cost" suffix="$" value={cfg.cases?.costBronze} onChange={(v: number) => setPath(['cases', 'costBronze'], v)} />
                <NumField label="Silver cost" suffix="$" value={cfg.cases?.costSilver} onChange={(v: number) => setPath(['cases', 'costSilver'], v)} />
                <NumField label="Gold cost" suffix="$" value={cfg.cases?.costGold} onChange={(v: number) => setPath(['cases', 'costGold'], v)} />
              </div>
            </div>

            {(['free', 'bronze', 'silver', 'gold'] as const).map((cid) => (
              <CaseTableEditor key={cid} cid={cid} rows={cfg.cases?.tables?.[cid] ?? []} setCfg={setCfg} />
            ))}
          </div>
        )}

        {sec === 'wheel' && (
          <div className="space-y-5">
            <div className="rounded-2xl panel p-5">
              <h2 className="font-display text-lg font-bold">Daily wheel — prizes</h2>
              <Hint>The 8 segment prize values ($).</Hint>
              <div className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-8">
                {(cfg.wheel?.amounts ?? []).map((a: number, i: number) => (
                  <NumField key={i} label={`#${i + 1}`} value={a} onChange={(v: number) => setPath(['wheel', 'amounts', i], v)} />
                ))}
              </div>
            </div>
            <div className="rounded-2xl panel p-5">
              <h2 className="font-display text-lg font-bold">Daily wheel — odds</h2>
              <Hint>Relative weight of each segment (bigger = more likely) and the cooldown between free spins.</Hint>
              <div className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-8">
                {(cfg.wheel?.weights ?? []).map((w: number, i: number) => (
                  <NumField key={i} label={`#${i + 1}`} step={0.5} value={w} onChange={(v: number) => setPath(['wheel', 'weights', i], v)} />
                ))}
              </div>
              <div className="mt-4 max-w-[200px]">
                <NumField label="Cooldown" suffix="h" value={cfg.wheel?.cooldownHours} onChange={(v: number) => setPath(['wheel', 'cooldownHours'], v)} />
              </div>
            </div>
          </div>
        )}

        {sec === 'bonuses' && (
          <div className="space-y-5">
            <div className="rounded-2xl panel p-5">
              <h2 className="font-display text-lg font-bold">Sign-up & referral bonuses</h2>
              <Hint>Welcome bonus for new accounts, plus what each side gets when someone joins via a referral link.</Hint>
              <div className="mt-4 grid grid-cols-3 gap-4">
                <NumField label="Welcome" suffix="$" value={cfg.bonuses?.welcome} onChange={(v: number) => setPath(['bonuses', 'welcome'], v)} />
                <NumField label="Referrer bonus" suffix="$" value={cfg.bonuses?.referrerSignup} onChange={(v: number) => setPath(['bonuses', 'referrerSignup'], v)} />
                <NumField label="New friend bonus" suffix="$" value={cfg.bonuses?.refereeSignup} onChange={(v: number) => setPath(['bonuses', 'refereeSignup'], v)} />
              </div>
            </div>
            <div className="rounded-2xl panel p-5">
              <h2 className="font-display text-lg font-bold">Daily check-in streak</h2>
              <Hint>Reward for each consecutive day (day 1 → day 7+). Index 1 is the first day.</Hint>
              <div className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-7">
                {(cfg.bonuses?.checkin ?? []).slice(1, 8).map((r: number, i: number) => (
                  <NumField key={i} label={`Day ${i + 1}`} suffix="$" value={r} onChange={(v: number) => setPath(['bonuses', 'checkin', i + 1], v)} />
                ))}
              </div>
            </div>
          </div>
        )}

        {sec === 'missions' && (
          <div className="rounded-2xl panel p-5">
            <h2 className="font-display text-lg font-bold">Daily missions</h2>
            <Hint>Edit each mission&rsquo;s goal and reward. Labels appear on the Daily page.</Hint>
            <div className="mt-4 space-y-3">
              {(cfg.missions ?? []).map((m: any, i: number) => (
                <div key={m.id} className="grid items-center gap-3 rounded-xl border hairline p-3 sm:grid-cols-[1fr_120px_120px]">
                  <input value={m.label} onChange={(e) => setPath(['missions', i, 'label'], e.target.value)} className={F} />
                  <NumField label="Target" value={m.target} onChange={(v: number) => setPath(['missions', i, 'target'], v)} />
                  <NumField label="Reward" suffix="$" value={m.reward} onChange={(v: number) => setPath(['missions', i, 'reward'], v)} />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button onClick={save} disabled={busy} className="rounded-xl bg-gradient-to-b from-gold to-gold-soft px-6 py-3 font-bold text-black shadow-gold transition hover:brightness-105 disabled:opacity-50">
            {busy ? 'Saving…' : 'Save settings'}
          </button>
          <button
            onClick={async () => {
              if (!confirm('Reset ALL game settings (RTP, prices, bonuses, wheel, cases…) to the recommended defaults?')) return;
              setBusy(true); setMsg(null);
              try {
                const fresh = await api.admin.resetSettings();
                setCfg(fresh);
                setMsg({ ok: true, text: 'Reset to recommended defaults.' });
              } catch (e: any) {
                setMsg({ ok: false, text: e?.message || 'Could not reset.' });
              } finally { setBusy(false); }
            }}
            disabled={busy}
            className="rounded-xl border border-lose/40 px-5 py-3 text-sm font-semibold text-lose transition hover:bg-lose/10 disabled:opacity-50"
          >
            Reset to defaults
          </button>
          {msg && <span className={`text-sm ${msg.ok ? 'text-win' : 'text-lose'}`}>{msg.text}</span>}
        </div>
      </div>
    </div>
  );
}

const KIND_LABEL: Record<string, string> = {
  BET_PLACE: 'Prediction stake',
  BET_SETTLE_WIN: 'Prediction win',
  BET_SETTLE_LOSS: 'Prediction loss',
  GAME_STAKE: 'Casino stake',
  GAME_PAYOUT: 'Casino payout',
  BONUS_GRANT: 'Bonus / rewards',
  DEPOSIT: 'Deposit',
  WITHDRAWAL: 'Withdrawal',
  ADMIN_ADJUST: 'Admin adjustment',
};

function PlayerReportModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [r, setR] = useState<any | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    api.admin.userReport(id).then(setR).catch(() => setErr(true));
  }, [id]);

  const signed = (n: number) => (
    <span className={n >= 0 ? 'text-win' : 'text-lose'}>
      {n >= 0 ? '+' : '−'}{fmtMoney(Math.abs(n))}
    </span>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="my-8 w-full max-w-3xl rounded-2xl panel p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {!r ? (
          <p className="py-10 text-center text-sm text-fg/40">{err ? 'Could not load report.' : 'Loading…'}</p>
        ) : (
          <>
            {/* header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-bold">{r.user.displayName || r.user.email}</h2>
                <p className="mt-0.5 text-xs text-fg/45">{r.user.email}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="rounded-md bg-gold/15 px-2 py-0.5 font-mono text-gold-deep">{r.user.role}</span>
                  <span className={`rounded-md px-2 py-0.5 font-mono ${r.user.status === 'ACTIVE' ? 'bg-win/15 text-win' : 'bg-lose/15 text-lose'}`}>{r.user.status}</span>
                  <span className="text-fg/40">joined {new Date(r.user.createdAt).toLocaleDateString()}</span>
                  {r.user.referredBy && <span className="text-fg/40">· ref by {r.user.referredBy}</span>}
                </div>
              </div>
              <button onClick={onClose} className="rounded-lg border hairline px-3 py-1.5 text-sm text-fg/60 hover:text-fg">Close</button>
            </div>

            {/* top stats */}
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Mini label="Cash balance" node={<span className="text-gold-deep">{fmtMoney(r.balances.cash)}</span>} />
              <Mini label="Bonus" node={<span>{fmtMoney(r.balances.bonus)}</span>} />
              <Mini label="Net P&L" node={signed(r.summary.netPnl)} />
              <Mini label="Total wagered" node={<span>{fmtMoney(r.summary.totalWagered)}</span>} />
            </div>

            {/* predictions */}
            <h3 className="mt-6 font-display text-sm font-semibold text-fg/80">Predictions</h3>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Mini label="Open" node={<span>{r.bets.open}</span>} />
              <Mini label="Won" node={<span className="text-win">{r.bets.won}</span>} />
              <Mini label="Lost" node={<span className="text-lose">{r.bets.lost}</span>} />
              <Mini label="Win rate" node={<span>{r.summary.winRate}%</span>} />
              <Mini label="P&L" node={signed(r.bets.pnl)} />
            </div>

            {/* casino by game */}
            <h3 className="mt-6 font-display text-sm font-semibold text-fg/80">Casino — by game</h3>
            {r.games.length === 0 ? (
              <p className="mt-2 text-sm text-fg/40">No casino rounds yet.</p>
            ) : (
              <div className="mt-2 overflow-hidden rounded-xl border hairline">
                <table className="w-full text-sm">
                  <thead><tr className="text-left font-mono text-[10px] uppercase tracking-widest text-fg/40">
                    <th className="px-3 py-2">Game</th><th className="px-3 py-2 text-right">Rounds</th>
                    <th className="px-3 py-2 text-right">Staked</th><th className="px-3 py-2 text-right">Payout</th><th className="px-3 py-2 text-right">Net</th>
                  </tr></thead>
                  <tbody>
                    {r.games.map((g: any) => (
                      <tr key={g.game} className="border-t hairline">
                        <td className="px-3 py-2 capitalize">{String(g.game).toLowerCase()}</td>
                        <td className="px-3 py-2 text-right text-fg/60">{g.rounds}</td>
                        <td className="px-3 py-2 text-right font-mono text-fg/60">{fmtMoney(g.staked)}</td>
                        <td className="px-3 py-2 text-right font-mono text-fg/60">{fmtMoney(g.payout)}</td>
                        <td className="px-3 py-2 text-right font-mono">{signed(g.net)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* money sources */}
            <h3 className="mt-6 font-display text-sm font-semibold text-fg/80">Where the money moved</h3>
            <div className="mt-2 overflow-hidden rounded-xl border hairline">
              <table className="w-full text-sm">
                <thead><tr className="text-left font-mono text-[10px] uppercase tracking-widest text-fg/40">
                  <th className="px-3 py-2">Source</th><th className="px-3 py-2 text-right">Count</th><th className="px-3 py-2 text-right">Net</th>
                </tr></thead>
                <tbody>
                  {r.sources.map((s: any) => (
                    <tr key={s.kind} className="border-t hairline">
                      <td className="px-3 py-2">{KIND_LABEL[s.kind] ?? s.kind}</td>
                      <td className="px-3 py-2 text-right text-fg/60">{s.count}</td>
                      <td className="px-3 py-2 text-right font-mono">{signed(s.net)}</td>
                    </tr>
                  ))}
                  {r.sources.length === 0 && <tr><td colSpan={3} className="px-3 py-4 text-center text-fg/40">No ledger activity.</td></tr>}
                </tbody>
              </table>
            </div>

            <p className="mt-4 text-xs text-fg/45">Referred friends: <b className="text-fg/70">{r.referralsInvited}</b></p>

            {/* recent */}
            <h3 className="mt-6 font-display text-sm font-semibold text-fg/80">Recent activity</h3>
            <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border hairline">
              {r.recent.length === 0 ? (
                <p className="px-3 py-4 text-sm text-fg/40">No activity.</p>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {r.recent.map((e: any, i: number) => (
                      <tr key={i} className="border-t hairline first:border-t-0">
                        <td className="px-3 py-2 text-fg/70">{KIND_LABEL[e.kind] ?? e.kind}</td>
                        <td className="px-3 py-2 text-right font-mono">{signed(e.amount)}</td>
                        <td className="px-3 py-2 text-right text-[11px] text-fg/40">{new Date(e.at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Mini({ label, node }: { label: string; node: any }) {
  return (
    <div className="rounded-xl bg-fg/[0.03] p-3">
      <p className="font-mono text-[10px] uppercase tracking-widest text-fg/40">{label}</p>
      <p className="mt-1 font-display text-lg font-bold">{node}</p>
    </div>
  );
}
