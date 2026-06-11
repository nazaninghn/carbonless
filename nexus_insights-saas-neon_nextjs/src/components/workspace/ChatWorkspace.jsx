'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, Send, Loader2 } from 'lucide-react';
import { sendWorkspaceChatMessage, confirmSuggestion, rejectSuggestion } from '@/lib/workspace/api';
import { SuggestionReviewCard } from './SuggestionReviewCard';

function TypingDots() {
  return (
    <div className="flex items-end gap-1 px-1 py-1">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="h-2 w-2 rounded-full bg-[#B4BE6A] animate-bounce"
          style={{ animationDelay: `${i * 0.18}s` }}
        />
      ))}
    </div>
  );
}

function ChatBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isUser && (
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#95A847]/20 to-[#B4BE6A]/10 text-[#75863B]">
          <Bot className="h-4 w-4" />
        </div>
      )}
      <div
        className={`max-w-[85%] rounded-[20px] px-4 py-3 text-[13.5px] leading-[1.65] ${
          isUser
            ? 'rounded-tr-sm bg-[#302817] text-white'
            : 'rounded-tl-sm border border-[#302817]/6 bg-white text-[#302817] shadow-sm'
        }`}
      >
        {msg.content}
      </div>
    </div>
  );
}

export function ChatWorkspace({ reportId, lang = 'en', onFieldsConfirmed }) {
  const tr = lang === 'tr';
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: tr
        ? 'Merhaba! Ben CarbonIQ Workspace asistanınızım. Emisyon verilerinizi paylaşın, ben yapılandırılmış alanlara dönüştüreyim. Örneğin: "Geçen yıl 15.000 m³ doğalgaz kullandık."'
        : 'Hi! I\'m your CarbonIQ Workspace assistant. Share your emission data and I\'ll extract structured fields for you. Try: "We used 15,000 m³ natural gas last year."',
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef(null);
  const msgIdRef = useRef(0);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const addMsg = useCallback((role, content, extra = {}) => {
    setMessages(prev => [...prev, { id: `m-${++msgIdRef.current}`, role, content, ...extra }]);
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || !reportId) return;
    setInput('');
    setError('');
    addMsg('user', text);
    setSending(true);

    try {
      const data = await sendWorkspaceChatMessage(reportId, text);
      if (data.reply) addMsg('assistant', data.reply);
      if (data.suggestion) {
        setMessages(prev => [...prev, {
          id: `s-${data.suggestion.id}`,
          role: 'suggestion',
          suggestion: data.suggestion,
        }]);
      }
    } catch (e) {
      setError(tr ? 'AI isteği başarısız oldu. Lütfen tekrar deneyin.' : 'AI request failed. Please try again.');
    } finally {
      setSending(false);
    }
  }, [input, sending, reportId, addMsg, tr]);

  const handleConfirm = useCallback(async (suggestionId, editedFields) => {
    try {
      const result = await confirmSuggestion(suggestionId, editedFields);
      // Replace suggestion card with success message
      setMessages(prev => prev.map(m =>
        m.suggestion?.id === suggestionId
          ? { ...m, role: 'confirmed', suggestion: { ...m.suggestion, status: 'confirmed' } }
          : m
      ));
      addMsg('assistant', tr
        ? `✓ Veriler kaydedildi! ${result.saved_fields?.length || 0} alan güncellendi.`
        : `✓ Data saved! ${result.saved_fields?.length || 0} field(s) updated.`
      );
      if (onFieldsConfirmed) onFieldsConfirmed(result.saved_fields || []);
    } catch {
      setError(tr ? 'Onaylama başarısız.' : 'Confirmation failed.');
    }
  }, [addMsg, tr, onFieldsConfirmed]);

  const handleReject = useCallback(async (suggestionId) => {
    try {
      await rejectSuggestion(suggestionId);
      setMessages(prev => prev.map(m =>
        m.suggestion?.id === suggestionId
          ? { ...m, role: 'rejected' }
          : m
      ));
      addMsg('assistant', tr ? 'Öneri reddedildi.' : 'Suggestion rejected.');
    } catch {
      setError(tr ? 'İşlem başarısız.' : 'Action failed.');
    }
  }, [addMsg, tr]);

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
        {messages.map(msg => {
          if (msg.role === 'suggestion') {
            return (
              <SuggestionReviewCard
                key={msg.id}
                suggestion={msg.suggestion}
                onConfirm={handleConfirm}
                onReject={handleReject}
                lang={lang}
              />
            );
          }
          if (msg.role === 'confirmed') {
            return (
              <div key={msg.id} className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-xs font-semibold text-green-700">
                ✓ {tr ? 'Onaylandı' : 'Confirmed'} — {msg.suggestion?.category}
              </div>
            );
          }
          if (msg.role === 'rejected') {
            return (
              <div key={msg.id} className="rounded-2xl border border-[#302817]/8 bg-[#302817]/3 px-4 py-3 text-xs text-[#302817]/40 line-through">
                {tr ? 'Reddedildi' : 'Rejected'} — {msg.suggestion?.category}
              </div>
            );
          }
          return <ChatBubble key={msg.id} msg={msg} />;
        })}
        {sending && (
          <div className="flex gap-2.5">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#95A847]/20 to-[#B4BE6A]/10 text-[#75863B]">
              <Bot className="h-4 w-4" />
            </div>
            <div className="rounded-[20px] rounded-tl-sm border border-[#302817]/6 bg-white px-4 py-3 shadow-sm">
              <TypingDots />
            </div>
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
            {error}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-[#302817]/6 px-4 py-3">
        <div className="flex items-end gap-2">
          <textarea
            className="flex-1 resize-none rounded-2xl border border-[#302817]/12 bg-white px-4 py-2.5 text-sm text-[#302817] outline-none placeholder:text-[#302817]/30 focus:border-[#B4BE6A]/50 focus:ring-2 focus:ring-[#B4BE6A]/20 min-h-[44px] max-h-[120px]"
            placeholder={tr ? 'Emisyon verisi paylaşın…' : 'Share emission data…'}
            value={input}
            rows={1}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            maxLength={4000}
          />
          <button
            onClick={send}
            disabled={!input.trim() || sending}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#302817] text-white shadow-sm transition hover:bg-black disabled:opacity-40"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </button>
        </div>
        <p className="mt-1.5 text-[10px] text-[#302817]/30 pl-1">
          {tr ? 'AI öneri oluşturur — siz onaylamadan kaydedilmez.' : 'AI creates a suggestion — nothing saves without your approval.'}
        </p>
      </div>
    </div>
  );
}
