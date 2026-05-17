'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bot, Send, Plus, Trash2, MessageSquare, Sparkles, Loader2, ChevronLeft,
} from 'lucide-react';
import { api } from '@/lib/utils/api';

// ── Simple markdown renderer ──────────────────────────────────────────────────
function Markdown({ text }) {
  const html = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="rounded bg-black/10 px-1 py-0.5 text-[12px] font-mono">$1</code>')
    .replace(/^### (.+)$/gm, '<p class="mt-3 mb-1 font-bold text-[#302817]">$1</p>')
    .replace(/^## (.+)$/gm, '<p class="mt-4 mb-1 text-base font-bold text-[#302817]">$1</p>')
    .replace(/^# (.+)$/gm, '<p class="mt-4 mb-1 text-lg font-bold text-[#302817]">$1</p>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
    .replace(/\n\n/g, '</p><p class="mt-2">')
    .replace(/\n/g, '<br/>');
  return <span dangerouslySetInnerHTML={{ __html: `<p>${html}</p>` }} />;
}

// ── Typing dots ───────────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex items-end gap-1 px-1 py-1">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="h-2 w-2 rounded-full bg-[#B4BE6A]"
          style={{ animation: `dot 1.2s ${i * 0.2}s ease-in-out infinite` }}
        />
      ))}
      <style>{`@keyframes dot{0%,60%,100%{opacity:.25;transform:translateY(0)}30%{opacity:1;transform:translateY(-4px)}}`}</style>
    </div>
  );
}

// ── Bubble ────────────────────────────────────────────────────────────────────
function Bubble({ role, content }) {
  const isUser = role === 'user';
  return (
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isUser && (
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#95A847]/20 to-[#B4BE6A]/10 text-[#75863B]">
          <Bot className="h-4 w-4" />
        </div>
      )}
      <div
        className={`max-w-[82%] rounded-[20px] px-4 py-3 text-[13.5px] leading-[1.65] sm:max-w-[72%] ${
          isUser
            ? 'rounded-tr-sm bg-[#302817] text-white'
            : 'rounded-tl-sm border border-[#302817]/6 bg-white text-[#302817] shadow-[0_2px_12px_rgba(48,40,23,0.05)]'
        }`}
      >
        {isUser ? content : <Markdown text={content} />}
      </div>
    </div>
  );
}

// ── Session list item ─────────────────────────────────────────────────────────
function SessionItem({ session, active, onClick, onDelete, tr }) {
  return (
    <button
      onClick={onClick}
      className={`group relative w-full rounded-xl px-3 py-2.5 text-left transition ${
        active
          ? 'bg-[#302817]/8 text-[#302817]'
          : 'text-[#302817]/60 hover:bg-[#302817]/5 hover:text-[#302817]'
      }`}
    >
      <p className="truncate text-xs font-bold leading-tight pr-6">{session.title}</p>
      <p className="mt-0.5 text-[10px] font-medium text-[#302817]/35">
        {session.message_count} {tr ? 'mesaj' : 'msgs'} · {new Date(session.updated_at).toLocaleDateString()}
      </p>
      <button
        onClick={e => { e.stopPropagation(); onDelete(session.id); }}
        className="absolute right-2 top-2.5 hidden rounded-md p-1 text-[#302817]/30 transition hover:bg-red-50 hover:text-red-400 group-hover:flex"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </button>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ onNew, tr }) {
  const prompts = tr
    ? ['Scope 1, 2, 3 emisyonları nasıl hesaplarım?', 'ISO 14064-1 sınır belirleme nasıl yapılır?', 'Karbon azaltma hedefi nasıl oluştururum?', 'Emisyon faktörü nedir?']
    : ['How do I calculate Scope 1, 2 & 3 emissions?', 'What is the ISO 14064-1 boundary approach?', 'How do I set a science-based reduction target?', 'What are common emission factors?'];
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-10 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#95A847]/15 to-[#B4BE6A]/10">
        <Sparkles className="h-7 w-7 text-[#95A847]" />
      </div>
      <div>
        <h2 className="text-lg font-bold tracking-tight text-[#302817]">
          {tr ? 'CarbonIQ Asistanı' : 'CarbonIQ Assistant'}
        </h2>
        <p className="mt-1.5 text-sm text-[#302817]/50">
          {tr
            ? 'ISO 14064-1 ve karbon muhasebesi konusunda uzman AI asistanı.'
            : 'Expert AI for carbon accounting & ISO 14064-1 reporting.'}
        </p>
      </div>
      <div className="grid w-full max-w-sm gap-2">
        {prompts.map(p => (
          <button
            key={p}
            onClick={() => onNew(p)}
            className="rounded-2xl border border-[#302817]/8 bg-white px-4 py-3 text-left text-xs font-semibold text-[#302817]/65 shadow-sm transition hover:border-[#B4BE6A]/40 hover:bg-[#B4BE6A]/5 hover:text-[#302817]"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CarbonAIPage({ language = 'en' }) {
  const tr = language === 'tr';

  const [sessions, setSessions] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [error, setError] = useState('');

  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  // Load sessions on mount
  useEffect(() => {
    (async () => {
      setLoadingSessions(true);
      try {
        const res = await api.getChatSessions();
        if (res.ok) setSessions(await res.json());
      } catch {}
      setLoadingSessions(false);
    })();
  }, []);

  // Load session messages when activeId changes
  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    (async () => {
      setLoadingMessages(true);
      try {
        const res = await api.getChatSession(activeId);
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages || []);
        }
      } catch {}
      setLoadingMessages(false);
      inputRef.current?.focus();
    })();
  }, [activeId]);

  // ── Start new chat (optionally with initial prompt) ──────────────────────
  const startNew = useCallback(async (initialPrompt = '') => {
    try {
      const res = await api.createChatSession();
      if (!res.ok) return;
      const session = await res.json();
      setSessions(prev => [session, ...prev]);
      setActiveId(session.id);
      setMessages([]);
      setError('');
      if (initialPrompt) {
        // small delay to let state settle
        setTimeout(() => sendMessage(initialPrompt, session.id), 50);
      }
    } catch {}
  }, []); // eslint-disable-line

  // ── Send message ─────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text, sid) => {
    const content = (text || input).trim();
    const sessionId = sid || activeId;
    if (!content || !sessionId || sending) return;

    setInput('');
    setSending(true);
    setError('');
    setMessages(prev => [...prev, { id: Date.now(), role: 'user', content }]);

    try {
      const res = await api.sendChatMessage(sessionId, content);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || (tr ? 'Bir hata oluştu.' : 'Something went wrong.'));
      } else {
        const aiMsg = await res.json();
        setMessages(prev => [...prev, aiMsg]);
        // Update session title if it changed
        if (aiMsg.session_title) {
          setSessions(prev => prev.map(s =>
            s.id === sessionId ? { ...s, title: aiMsg.session_title, updated_at: new Date().toISOString(), message_count: (s.message_count || 0) + 2 } : s
          ));
        }
      }
    } catch {
      setError(tr ? 'Bağlantı hatası.' : 'Connection error.');
    }
    setSending(false);
    inputRef.current?.focus();
  }, [input, activeId, sending, tr]);

  // ── Delete session ───────────────────────────────────────────────────────
  const deleteSession = useCallback(async (id) => {
    try {
      await api.deleteChatSession(id);
      setSessions(prev => prev.filter(s => s.id !== id));
      if (activeId === id) { setActiveId(null); setMessages([]); }
    } catch {}
  }, [activeId]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const activeSession = sessions.find(s => s.id === activeId);

  // ── Layout ───────────────────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100svh-190px)] min-h-[520px] overflow-hidden rounded-[28px] border border-[#302817]/8 bg-white shadow-[0_10px_40px_rgba(48,40,23,0.06)] sm:h-[calc(100svh-150px)] lg:h-[calc(100vh-120px)]">

      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <aside className={`flex shrink-0 flex-col border-r border-[#302817]/6 bg-[#FAFAF8] transition-all duration-300 ${sidebarOpen ? 'w-[220px]' : 'w-0 overflow-hidden'}`}>
        <div className="flex items-center justify-between border-b border-[#302817]/6 px-3 py-3">
          <span className="text-xs font-bold text-[#302817]/50 uppercase tracking-wider">
            {tr ? 'Sohbetler' : 'Chats'}
          </span>
          <button
            onClick={() => startNew()}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#302817] text-white shadow-sm transition hover:bg-black"
            title={tr ? 'Yeni sohbet' : 'New chat'}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {loadingSessions ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-[#302817]/30" />
            </div>
          ) : sessions.length === 0 ? (
            <p className="px-3 py-4 text-center text-[11px] text-[#302817]/35">
              {tr ? 'Henüz sohbet yok' : 'No chats yet'}
            </p>
          ) : (
            sessions.map(s => (
              <SessionItem
                key={s.id}
                session={s}
                active={s.id === activeId}
                onClick={() => setActiveId(s.id)}
                onDelete={deleteSession}
                tr={tr}
              />
            ))
          )}
        </div>
      </aside>

      {/* ── Main chat area ──────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">

        {/* Header */}
        <header className="flex shrink-0 items-center gap-3 border-b border-[#302817]/6 px-4 py-3">
          <button
            onClick={() => setSidebarOpen(v => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#302817]/40 transition hover:bg-[#302817]/6 hover:text-[#302817]"
          >
            {sidebarOpen
              ? <ChevronLeft className="h-4 w-4" />
              : <MessageSquare className="h-4 w-4" />}
          </button>

          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#95A847]/20 to-[#B4BE6A]/10">
            <Bot className="h-4 w-4 text-[#75863B]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-[#302817]">
              {activeSession ? activeSession.title : 'CarbonIQ'}
            </p>
            <p className="text-[11px] font-semibold text-[#302817]/40">
              {tr ? 'ISO 14064-1 · Karbon uzmanı AI' : 'ISO 14064-1 · Carbon expert AI'}
            </p>
          </div>
          {!activeId && (
            <button
              onClick={() => startNew()}
              className="ml-auto flex items-center gap-1.5 rounded-full bg-[#302817] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-black"
            >
              <Plus className="h-3 w-3" />
              {tr ? 'Yeni' : 'New'}
            </button>
          )}
        </header>

        {/* Messages area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          {!activeId ? (
            <EmptyState onNew={startNew} tr={tr} />
          ) : loadingMessages ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-[#302817]/30" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <Bot className="h-10 w-10 text-[#302817]/15" />
              <p className="text-sm text-[#302817]/40">
                {tr ? 'Sorunuzu yazın...' : 'Ask your first question…'}
              </p>
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
              {messages.map((msg, i) => (
                <Bubble key={msg.id || i} role={msg.role} content={msg.content} />
              ))}
              {sending && (
                <div className="flex gap-2.5">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#95A847]/20 to-[#B4BE6A]/10 text-[#75863B]">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="rounded-[20px] rounded-tl-sm border border-[#302817]/6 bg-white px-4 py-3 shadow-[0_2px_12px_rgba(48,40,23,0.05)]">
                    <TypingDots />
                  </div>
                </div>
              )}
              {error && (
                <div className="mx-auto w-full max-w-3xl rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-600">
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input bar */}
        <div className="shrink-0 border-t border-[#302817]/6 px-4 py-3 sm:px-6">
          <div className="mx-auto flex w-full max-w-3xl items-end gap-2 rounded-[22px] border border-[#302817]/10 bg-white px-4 py-3 shadow-[0_4px_20px_rgba(48,40,23,0.05)] focus-within:border-[#B4BE6A]/50 focus-within:ring-4 focus-within:ring-[#B4BE6A]/12 transition">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!activeId && !sending}
              placeholder={
                !activeId
                  ? (tr ? 'Yeni sohbet başlatmak için tıklayın ↑' : 'Click "New" to start chatting')
                  : (tr ? 'Mesajınızı yazın… (Enter gönderir)' : 'Type a message… (Enter to send)')
              }
              rows={1}
              className="min-h-[24px] max-h-[120px] flex-1 resize-none bg-transparent text-sm font-medium text-[#302817] outline-none placeholder:text-[#302817]/30 disabled:cursor-not-allowed"
              style={{ scrollbarWidth: 'none' }}
              onInput={e => {
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
              }}
            />
            <button
              onClick={() => {
                if (!activeId) startNew(input);
                else sendMessage();
              }}
              disabled={!input.trim() || sending}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#302817] text-white shadow-sm transition hover:bg-black disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {sending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Send className="h-3.5 w-3.5" />}
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] text-[#302817]/25">
            {tr ? 'CarbonIQ yanılabilir. Önemli kararlar için uzmanla doğrulayın.' : 'CarbonIQ may make errors. Verify critical decisions with an expert.'}
          </p>
        </div>
      </div>
    </div>
  );
}
