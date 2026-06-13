'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, Send, Loader2 } from 'lucide-react';
import { sendWorkspaceChatMessage, confirmSuggestion, rejectSuggestion } from '@/lib/workspace/api';
import { SuggestionReviewCard } from './SuggestionReviewCard';

// ── Preview-mode mock AI ───────────────────────────────────────────────────────
// Used when no real backend is available (isPreview=true)

const PREVIEW_PATTERNS = [
  {
    test: /doğalgaz|natural.?gas|m³|m3|yakıt|fuel.gas|gaz\b/i,
    extract(text, tr) {
      const nums = [...text.matchAll(/[\d]+[.,]?[\d]*/g)].map(m => parseFloat(m[0].replace(',', '.')));
      const amount = nums.find(n => n > 100) || 15000;
      return {
        replyTr: `Anladım! ${amount.toLocaleString('tr-TR')} m³ doğalgaz Kapsam 1 emisyonu olarak hesaplıyorum...`,
        replyEn: `Got it! Calculating ${amount.toLocaleString()} m³ natural gas as Scope 1 emission...`,
        suggestion: {
          id: `preview-${Date.now()}`,
          category: '3A',
          confidence: 0.92,
          fields: [
            { field_id: 'rf.3a.fuel_type',    label: tr ? 'Yakıt Türü'  : 'Fuel Type',    value: 'natural_gas', confidence: 0.97 },
            { field_id: 'rf.3a.consumption',  label: tr ? 'Tüketim'     : 'Consumption',  value: amount,        confidence: 0.93, unit: 'm³' },
            { field_id: 'rf.3a.unit',         label: tr ? 'Birim'       : 'Unit',         value: 'm³',          confidence: 0.99 },
          ],
          _localFields: {
            'rf.3a.fuel_type':   'natural_gas',
            'rf.3a.consumption': amount,
            'rf.3a.unit':        'm³',
          },
        },
      };
    },
  },
  {
    test: /kwh|kilowatt|elektrik\b|electricity|enerji\b|energy\b/i,
    extract(text, tr) {
      const nums = [...text.matchAll(/[\d]+[.,]?[\d]*/g)].map(m => parseFloat(m[0].replace(',', '.')));
      const kwh = nums.find(n => n > 100) || 18000;
      return {
        replyTr: `Elektrik tüketimi tespit edildi! ${kwh.toLocaleString('tr-TR')} kWh IEA 2023 faktörü ile hesaplıyorum...`,
        replyEn: `Electricity usage detected! Calculating ${kwh.toLocaleString()} kWh with IEA 2023 factor...`,
        suggestion: {
          id: `preview-${Date.now()}`,
          category: '4A',
          confidence: 0.89,
          fields: [
            { field_id: 'rf.4a.consumption_kwh',  label: tr ? 'Tüketim'           : 'Consumption',       value: kwh,    confidence: 0.92, unit: 'kWh'         },
            { field_id: 'rf.4a.emission_factor',   label: tr ? 'Emisyon Faktörü'   : 'Emission Factor',   value: 0.439,  confidence: 0.98, unit: 'kgCO₂e/kWh'  },
            { field_id: 'rf.4a.supplier',          label: tr ? 'Tedarikçi'         : 'Supplier',          value: tr ? 'Şebeke (TEDAŞ)' : 'National Grid', confidence: 0.75 },
          ],
          _localFields: {
            'rf.4a.consumption_kwh': kwh,
            'rf.4a.emission_factor': 0.439,
            'rf.4a.supplier':        tr ? 'Şebeke (TEDAŞ)' : 'National Grid',
          },
        },
      };
    },
  },
  {
    test: /uçuş|uçak|flight|hava.?yolu|airline|business.?travel|iş.?seyahat/i,
    extract(text, tr) {
      const nums = [...text.matchAll(/[\d]+[.,]?[\d]*/g)].map(m => parseFloat(m[0].replace(',', '.')));
      const pkm = nums.find(n => n > 100) || 12000;
      const emission = Math.round(pkm * 0.153);
      return {
        replyTr: `İş seyahati verisi tespit edildi! ${pkm.toLocaleString('tr-TR')} yolcu-km kısa mesafe uçuş olarak kaydediyorum...`,
        replyEn: `Business travel detected! Recording ${pkm.toLocaleString()} pkm as short-haul flight...`,
        suggestion: {
          id: `preview-${Date.now()}`,
          category: 'K5',
          confidence: 0.85,
          fields: [
            { field_id: 'rf.k5.air_short_haul_pkm',   label: tr ? 'Kısa Mesafe Uçuş' : 'Short-Haul Flight', value: pkm,     confidence: 0.87, unit: 'pkm'      },
            { field_id: 'rf.k5.total_emission_kgco2e', label: tr ? 'Toplam Emisyon'   : 'Total Emission',    value: emission, confidence: 0.90, unit: 'kgCO₂e'  },
          ],
          _localFields: {
            'rf.k5.air_short_haul_pkm':    pkm,
            'rf.k5.total_emission_kgco2e': emission,
          },
        },
      };
    },
  },
  {
    test: /nakliye|taşıma|freight|transport|kamyon|tır\b|sevkiyat|kargo|shipment/i,
    extract(text, tr) {
      const nums = [...text.matchAll(/[\d]+[.,]?[\d]*/g)].map(m => parseFloat(m[0].replace(',', '.')));
      const tonnes = nums.find(n => n > 0 && n < 1000) || 45;
      const km = nums.find(n => n >= 100 && n > tonnes) || 1200;
      const emission = Math.round(tonnes * km * 0.0614);
      return {
        replyTr: `Upstream taşıma verisi tespit edildi! ${tonnes} ton × ${km} km karayolu HGV olarak hesaplıyorum...`,
        replyEn: `Upstream transport detected! Calculating ${tonnes} tonnes × ${km} km as road HGV...`,
        suggestion: {
          id: `preview-${Date.now()}`,
          category: 'K4',
          confidence: 0.82,
          fields: [
            { field_id: 'rf.k4.total_emission_kgco2e', label: tr ? 'Toplam Emisyon' : 'Total Emission', value: emission, confidence: 0.84, unit: 'kgCO₂e' },
          ],
          _localFields: {
            'rf.k4.total_emission_kgco2e': emission,
          },
        },
      };
    },
  },
];

function getPreviewResponse(text, tr) {
  for (const pattern of PREVIEW_PATTERNS) {
    if (pattern.test.test(text)) return pattern.extract(text, tr);
  }
  return {
    replyTr: 'Enerji veya seyahat verilerinizi paylaşın. Örn: "15.000 m³ doğalgaz kullandık", "18.000 kWh elektrik aldık", "12.000 pkm iş seyahati yaptık".',
    replyEn: 'Share your energy or travel data. E.g. "We used 15,000 m³ natural gas", "We consumed 18,000 kWh electricity", "We had 12,000 pkm business travel".',
    suggestion: null,
  };
}

// ── UI helpers ─────────────────────────────────────────────────────────────────
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

// ── Main component ─────────────────────────────────────────────────────────────
export function ChatWorkspace({ reportId, lang = 'en', onFieldsConfirmed, isPreview = false, onPreviewFields }) {
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
  const [input,    setInput]    = useState('');
  const [sending,  setSending]  = useState(false);
  const [error,    setError]    = useState('');
  const scrollRef  = useRef(null);
  const msgIdRef   = useRef(0);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const addMsg = useCallback((role, content, extra = {}) => {
    setMessages(prev => [...prev, { id: `m-${++msgIdRef.current}`, role, content, ...extra }]);
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setError('');
    addMsg('user', text);
    setSending(true);

    try {
      if (isPreview) {
        // ── Preview mode: mock AI, no backend ──
        await new Promise(r => setTimeout(r, 900 + Math.random() * 600)); // simulate latency
        const response = getPreviewResponse(text, tr);
        addMsg('assistant', tr ? response.replyTr : response.replyEn);
        if (response.suggestion) {
          setMessages(prev => [...prev, {
            id: `s-${response.suggestion.id}`,
            role: 'suggestion',
            suggestion: response.suggestion,
          }]);
        } else {
          setMessages(prev => [...prev, {
            id: `hint-${Date.now()}`,
            role: 'hint',
            content: tr
              ? 'İpucu: Sayısal veri paylaşırsanız (örn: "15.000 m³ doğalgaz", "18.000 kWh") otomatik çıkarım yapabilirim.'
              : 'Tip: Share specific quantities and units (e.g., "15,000 m³ natural gas", "18,000 kWh") and I\'ll extract structured fields.',
          }]);
        }
      } else {
        // ── Production mode: real backend ──
        if (!reportId) return;
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
      }
    } catch {
      setError(tr ? 'AI isteği başarısız oldu. Lütfen tekrar deneyin.' : 'AI request failed. Please try again.');
    } finally {
      setSending(false);
    }
  }, [input, sending, reportId, addMsg, tr, isPreview]);

  const handleConfirm = useCallback(async (suggestionId, editedFields) => {
    try {
      if (isPreview) {
        // ── Preview confirm: update state locally, no backend ──
        const msg = messages.find(m => m.suggestion?.id === suggestionId);
        if (msg?.suggestion?._localFields) {
          const fields = editedFields
            ? editedFields
            : Object.entries(msg.suggestion._localFields).map(([field_id, value]) => ({ field_id, value }));
          if (onPreviewFields) onPreviewFields(fields);
        }
        setMessages(prev => prev.map(m =>
          m.suggestion?.id === suggestionId
            ? { ...m, role: 'confirmed', suggestion: { ...m.suggestion, status: 'confirmed' } }
            : m
        ));
        addMsg('assistant', tr
          ? '✓ Veriler workspace\'e kaydedildi! Panel görünümünden kontrol edebilirsiniz.'
          : '✓ Data saved to workspace! You can check it in the Panel view.'
        );
        if (onFieldsConfirmed) onFieldsConfirmed([]);
      } else {
        // ── Production confirm: call backend ──
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
      }
    } catch {
      setError(tr ? 'Onaylama başarısız.' : 'Confirmation failed.');
    }
  }, [addMsg, tr, isPreview, messages, onPreviewFields, onFieldsConfirmed]);

  const handleReject = useCallback(async (suggestionId) => {
    try {
      if (!isPreview) await rejectSuggestion(suggestionId);
      setMessages(prev => prev.map(m =>
        m.suggestion?.id === suggestionId ? { ...m, role: 'rejected' } : m
      ));
      addMsg('assistant', tr ? 'Öneri reddedildi. Başka veri paylaşabilirsiniz.' : 'Suggestion rejected. Feel free to share different data.');
    } catch {
      setError(tr ? 'İşlem başarısız.' : 'Action failed.');
    }
  }, [addMsg, tr, isPreview]);

  return (
    <div className="flex flex-col h-full bg-[#FAFAF8]">
      {/* Header strip */}
      <div className="shrink-0 flex items-center gap-2.5 px-4 py-2.5 border-b border-[#302817]/6 bg-white">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#302817]">
          <Sparkles className="h-3 w-3 text-[#B4BE6A]" />
        </div>
        <div className="flex-1">
          <p className="text-[11px] font-bold text-[#302817]">
            {tr ? 'AI Veri Asistanı' : 'AI Data Assistant'}
          </p>
          <p className="text-[9.5px] text-[#302817]/40">
            {tr ? 'Verilerinizi paylaşın, yapılandırılmış alanlara dönüştüreyim' : "Share your data and I'll extract structured fields"}
          </p>
        </div>
        <span className="flex items-center gap-1 text-[9.5px] font-bold text-[#75863B] bg-[#95A847]/10 border border-[#95A847]/20 px-2 py-1 rounded-full">
          <span className="h-1.5 w-1.5 rounded-full bg-[#95A847] animate-pulse" />
          {tr ? 'Çevrimiçi' : 'Online'}
        </span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5">

        {/* ── Quick-start chips — shown only before conversation starts ── */}
        {messages.length === 1 && messages[0].id === 'welcome' && (
          <div className="flex flex-col items-center text-center gap-3 pt-3 pb-2">
            <div className="flex flex-wrap justify-center gap-2">
              {[
                {
                  label: tr ? '⚡ 18.000 kWh elektrik' : '⚡ 18,000 kWh electricity',
                  text:  tr ? '18.000 kWh elektrik tükettik' : 'We consumed 18,000 kWh electricity',
                },
                {
                  label: tr ? '🔥 15.000 m³ doğalgaz' : '🔥 15,000 m³ natural gas',
                  text:  tr ? '15.000 m³ doğalgaz kullandık' : 'We used 15,000 m³ natural gas',
                },
                {
                  label: tr ? '✈️ 12.000 pkm iş seyahati' : '✈️ 12,000 pkm business travel',
                  text:  tr ? '12.000 pkm kısa mesafe iş seyahati yaptık' : 'We had 12,000 pkm short-haul business travel',
                },
                {
                  label: tr ? '🚛 45 ton × 1200 km nakliye' : '🚛 45 t × 1,200 km freight',
                  text:  tr ? '45 ton yük 1200 km karayoluyla taşındı' : '45 tonnes shipped 1,200 km by road',
                },
              ].map((chip, i) => (
                <button
                  key={i}
                  onClick={() => setInput(chip.text)}
                  className="rounded-full border border-[#302817]/10 bg-white px-3 py-1.5 text-[11px] font-semibold text-[#302817]/55 shadow-sm transition hover:border-[#B4BE6A]/50 hover:bg-[#B4BE6A]/8 hover:text-[#302817]"
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 w-full max-w-xs mt-1">
              <div className="flex-1 h-px bg-[#302817]/8" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#302817]/25">
                {tr ? 'veya kendiniz yazın' : 'or type your own'}
              </span>
              <div className="flex-1 h-px bg-[#302817]/8" />
            </div>
          </div>
        )}

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
                  <p className="text-xs font-bold text-[#527A1A]">{tr ? 'Onaylandı & Kaydedildi' : 'Confirmed & Saved'}</p>
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
            placeholder={tr ? 'Emisyon verisi paylaşın… (Örn: 15.000 m³ doğalgaz kullandık)' : 'Share emission data… (e.g. We used 15,000 m³ natural gas)'}
            value={input}
            rows={1}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
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
