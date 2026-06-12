'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, Send, Loader2 } from 'lucide-react';
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
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#302817] text-[#B4BE6A]">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
      )}
      <div
        className={`max-w-[85%] rounded-[18px] px-4 py-2.5 text-[13px] leading-[1.65] ${
          isUser
            ? 'rounded-tr-sm bg-[#302817] text-white'
            : 'rounded-tl-sm border border-[#302817]/8 bg-white text-[#302817] shadow-sm'
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
        : "Hi! I'm your CarbonIQ Workspace assistant. Share your emission data and I'll extract structured fields for you. Try: \"We used 15,000 m³ natural gas last year.\"",
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
      } else {
        setMessages(prev => [...prev, {
          id: `hint-${Date.now()}`,
          role: 'hint',
          content: tr
            ? 'İpucu: Sayısal veri paylaşırsanız (örn: "15.000 m³ doğalgaz", "18.000 kWh") otomatik çıkarım yapabilirim.'
            : "Tip: Share specific quantities and units (e.g., \"15,000 m³ natural gas\", \"18,000 kWh\") and I'll extract structured fields for you.",
        }]);
      }
    } catch {
      setError(tr ? 'AI isteği başarısız oldu. Lütfen tekrar deneyin.' : 'AI request failed. Please try again.');
    } finally {
      setSending(false);
    }
  }, [input, sending, reportId, addMsg, tr]);

  const handleConfirm = useCallback(async (suggestionId, editedFields) => {
    try {
      const result = await confirmSuggestion(suggestionId, editedFields);
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
    <div className="flex flex-col h-full bg-[#FAFAF8]">
      {/* AI mode header strip */}
      <div className="shrink-0 flex items-center gap-2.5 px-4 py-2.5 border-b border-[#302817]/6 bg-white">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#302817]">
          <Sparkles className="h-3 w-3 text-[#B4BE6A]" />
        </div>
        <div className="flex-1">
          <p className="text-[11px] font-bold text-[#302817]">
            {tr ? 'AI Veri Asistanı' : 'AI Data Assistant'}
          </p>
          <p className="text-[9.5px] text-[#302817]/40">
            {tr ? 'Verilerinizi paylaşın, yapılandırılmış alanlara dönüştüreyim' : 'Share your data and I\'ll extract structured fields'}
          </p>
        </div>
        <span className="flex items-center gap-1 text-[9.5px] font-bold text-[#75863B] bg-[#95A847]/10 border border-[#95A847]/20 px-2 py-1 rounded-full">
          <span className="h-1.5 w-1.5 rounded-full bg-[#95A847] animate-pulse" />
          {tr ? 'Çevrimiçi' : 'Online'}
        </span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5">
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
              <div key={msg.id} className="flex items-center gap-2 rounded-2xl border border-[#95A847]/20 bg-[#95A847]/8 px-4 py-3">
                <span className="text-[#527A1A] text-xs">✓</span>
                <div>
                  <p className="text-xs font-bold text-[#527A1A]">{tr ? 'Onaylandı' : 'Confirmed'}</p>
                  <p className="text-[10px] text-[#302817]/45">{msg.suggestion?.category}</p>
                </div>
              </div>
            );
          }
          if (msg.role === 'rejected') {
            return (
              <div key={msg.id} className="rounded-2xl border border-[#302817]/8 bg-[#302817]/3 px-4 py-2.5 text-xs text-[#302817]/35 line-through">
                {tr ? 'Reddedildi' : 'Rejected'} — {msg.suggestion?.category}
              </div>
            );
          }
          if (msg.role === 'hint') {
            return (
              <div key={msg.id} className="flex items-start gap-2.5 rounded-2xl border border-[#B4BE6A]/25 bg-[#B4BE6A]/6 px-4 py-2.5">
                <span className="text-[9.5px] font-bold text-[#75863B] uppercase tracking-wider shrink-0 mt-0.5">
                  {tr ? 'İpucu' : 'Tip'}
                </span>
                <span className="text-[12px] text-[#302817]/55 leading-relaxed">{msg.content}</span>
              </div>
            );
          }
          return <ChatBubble key={msg.id} msg={msg} />;
        })}
        {sending && (
          <div className="flex gap-2.5">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#302817] text-[#B4BE6A]">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <div className="rounded-[18px] rounded-tl-sm border border-[#302817]/8 bg-white px-4 py-3 shadow-sm">
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
      <div className="shrink-0 border-t border-[#302817]/6 bg-white px-4 py-3">
        <div className="flex items-end gap-2">
          <textarea
            className="flex-1 resize-none rounded-2xl border border-[#302817]/10 bg-[#FAFAF8] px-4 py-2.5 text-sm text-[#302817] outline-none placeholder:text-[#302817]/30 focus:border-[#B4BE6A]/50 focus:ring-2 focus:ring-[#B4BE6A]/15 min-h-[44px] max-h-[120px] transition-colors"
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
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#302817] text-white shadow-sm transition hover:bg-black disabled:opacity-35"
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
