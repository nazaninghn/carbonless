'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, RotateCcw, AlertTriangle, CheckCircle2, ChevronDown } from 'lucide-react';
import { api } from '@/lib/utils/api';

export default function Chatbot({ language = 'tr', onComplete }) {
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [inputValues, setInputValues] = useState({});
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);
  const [allWarnings, setAllWarnings] = useState([]);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [messages]);

  const startChat = async () => {
    setLoading(true);
    try {
      const res = await api.startQuestionnaire(language);
      if (res.ok) {
        const data = await res.json();
        setSessionId(data.session_id);
        setComplete(false);
        setAllWarnings(data.warnings || []);

        if (data.resumed && data.answers && Object.keys(data.answers).length > 0) {
          setMessages([{
            type: 'bot',
            text: language === 'tr'
              ? '👋 Kaldığınız yerden devam ediyoruz...'
              : '👋 Resuming where you left off...',
          }]);
        } else {
          setMessages([{
            type: 'bot',
            text: language === 'tr'
              ? '👋 Merhaba! Karbon envanteri prsşnamesine hoş geldiniz. Size birkaç soru soracağım.'
              : '👋 Hello! Welcome to the carbon inventory questionnaire. I will ask you a few questions.',
          }]);
        }

        if (data.question) {
          setTimeout(() => {
            setMessages(prev => [...prev, { type: 'question', data: data.question }]);
            setCurrentQuestion(data.question);
          }, 500);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    if (!sessionId) startChat();
  };

  const toggleOption = (key) => {
    if (!currentQuestion) return;
    if (currentQuestion.type === 'single') {
      setSelectedOptions([key]);
    } else {
      setSelectedOptions(prev =>
        prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
      );
    }
  };

  const handleInputChange = (key, value) => {
    setInputValues(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmitAnswer = async () => {
    if (selectedOptions.length === 0 || !currentQuestion) return;

    // Check if selected option needs input
    const needsInput = currentQuestion.options.filter(
      o => selectedOptions.includes(o.key) && o.has_input
    );
    for (const opt of needsInput) {
      const val = inputValues[opt.key];
      if (val === undefined || val === null || String(val).trim() === '') return;
    }

    setLoading(true);

    // Build user message
    const selectedTexts = currentQuestion.options
      .filter(o => selectedOptions.includes(o.key))
      .map(o => {
        let txt = o.text;
        if (o.has_input && inputValues[o.key]) txt += `: ${inputValues[o.key]}`;
        return txt;
      });

    setMessages(prev => [...prev, {
      type: 'user',
      text: selectedTexts.join(', '),
    }]);

    const answerData = {
      selected: currentQuestion.type === 'single' ? selectedOptions[0] : selectedOptions,
    };
    // Attach input values
    for (const opt of needsInput) {
      answerData[`input_${opt.key}`] = inputValues[opt.key];
    }

    try {
      const res = await api.answerQuestion({
        session_id: sessionId,
        question_id: currentQuestion.id,
        answer: answerData,
        lang: language,
      });

      if (res.ok) {
        const data = await res.json();

        // Show warnings
        if (data.warnings?.length > 0) {
          for (const w of data.warnings) {
            setMessages(prev => [...prev, {
              type: 'warning',
              text: language === 'tr' ? w.text_tr : w.text_en,
            }]);
          }
        }
        setAllWarnings(data.all_warnings || []);

        if (data.is_complete) {
          setComplete(true);
          setCurrentQuestion(null);
          setMessages(prev => [...prev, {
            type: 'bot',
            text: language === 'tr'
              ? '✅ Prsşname tamamlandı! Cevaplarınız kaydedildi. Artık emisyon verilerinizi girmeye başlayabilirsiniz.'
              : '✅ Questionnaire complete! Your answers have been saved. You can now start entering emission data.',
          }]);
          // Notify parent to refresh data
          if (onComplete) onComplete();
        } else if (data.question) {
          setTimeout(() => {
            setMessages(prev => [...prev, { type: 'question', data: data.question }]);
            setCurrentQuestion(data.question);
          }, 400);
        }

        setSelectedOptions([]);
        setInputValues({});
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    await api.resetQuestionnaire();
    setSessionId(null);
    setMessages([]);
    setCurrentQuestion(null);
    setSelectedOptions([]);
    setInputValues({});
    setComplete(false);
    setAllWarnings([]);
    startChat();
  };

  const canSubmit = selectedOptions.length > 0 && (() => {
    if (!currentQuestion) return false;
    const needsInput = currentQuestion.options.filter(
      o => selectedOptions.includes(o.key) && o.has_input
    );
    return needsInput.every(o => {
      const val = inputValues[o.key];
      if (val === undefined || val === null || val === '') return false;
      return String(val).trim().length > 0;
    });
  })();

  return (
    <>
      {/* Floating Button */}
      {!open && (
        <button
          onClick={handleOpen}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-to-br from-primary to-secondary rounded-full shadow-lg shadow-primary/30 flex items-center justify-center text-white hover:scale-110 transition-transform"
          aria-label="Open questionnaire chatbot"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {/* Chat Window */}
      {open && (
        <div className="fixed bottom-0 right-0 sm:bottom-6 sm:right-6 z-50 w-full sm:w-96 h-full sm:h-[600px] bg-white sm:rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary to-secondary px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <MessageCircle className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm">
                  {language === 'tr' ? 'Karbon Envanteri Sihirbazı' : 'Carbon Inventory Wizard'}
                </h3>
                <p className="text-white/70 text-xs">
                  {language === 'tr' ? 'ISO 14064-1 Prsşname' : 'ISO 14064-1 Questionnaire'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {sessionId && (
                <button onClick={handleReset} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors" title={language === 'tr' ? 'Yeniden başla' : 'Restart'}>
                  <RotateCcw className="w-4 h-4 text-white" />
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, i) => (
              <div key={i}>
                {msg.type === 'bot' && (
                  <div className="flex gap-2">
                    <div className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <MessageCircle className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[80%]">
                      <p className="text-sm text-gray-800">{msg.text}</p>
                    </div>
                  </div>
                )}

                {msg.type === 'user' && (
                  <div className="flex justify-end">
                    <div className="bg-primary text-white rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[80%]">
                      <p className="text-sm">{msg.text}</p>
                    </div>
                  </div>
                )}

                {msg.type === 'warning' && (
                  <div className="flex gap-2">
                    <div className="w-7 h-7 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[85%]">
                      <p className="text-sm text-amber-800">{msg.text}</p>
                    </div>
                  </div>
                )}

                {msg.type === 'question' && (
                  <div className="flex gap-2">
                    <div className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <MessageCircle className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%]">
                      <p className="text-sm font-medium text-gray-900 mb-1">{msg.data.text}</p>
                      {msg.data.type === 'multi' && (
                        <p className="text-xs text-gray-500 mb-1">
                          {language === 'tr' ? '(Birden fazla seçebilirsiniz)' : '(You can select multiple)'}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-2">
                <div className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <MessageCircle className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}

            {complete && (
              <div className="flex gap-2">
                <div className="w-7 h-7 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                </div>
                <div className="bg-green-50 border border-green-200 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%]">
                  <p className="text-sm text-green-800 font-medium">
                    {language === 'tr' ? 'Prsşname tamamlandı!' : 'Questionnaire complete!'}
                  </p>
                  {allWarnings.length > 0 && (
                    <p className="text-xs text-amber-700 mt-1">
                      ⚠️ {allWarnings.length} {language === 'tr' ? 'uyarı mevcut' : 'warning(s)'}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Options / Input Area */}
          {currentQuestion && !loading && !complete && (
            <div className="border-t border-gray-200 p-3 flex-shrink-0 max-h-[45%] overflow-y-auto">
              <div className="space-y-2">
                {currentQuestion.options.map(opt => (
                  <div key={opt.key}>
                    <button
                      onClick={() => toggleOption(opt.key)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all border ${
                        selectedOptions.includes(opt.key)
                          ? 'border-primary bg-primary/10 text-primary font-medium'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          selectedOptions.includes(opt.key) ? 'border-primary' : 'border-gray-300'
                        }`}>
                          {selectedOptions.includes(opt.key) && (
                            <div className="w-2 h-2 bg-primary rounded-full"></div>
                          )}
                        </div>
                        <span>{opt.text}</span>
                        {opt.warning && <span className="text-amber-500 text-xs">🟡</span>}
                      </div>
                    </button>

                    {/* Conditional input */}
                    {opt.has_input && selectedOptions.includes(opt.key) && (
                      <div className="mt-1.5 ml-6">
                        <label className="text-xs text-gray-500 mb-1 block">{opt.input_label}</label>
                        {opt.input_type === 'year' && (
                          <input
                            type="number"
                            min="2000"
                            max="2050"
                            placeholder="2024"
                            value={inputValues[opt.key] || ''}
                            onChange={e => handleInputChange(opt.key, e.target.value)}
                            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary focus:border-primary"
                          />
                        )}
                        {opt.input_type === 'date' && (
                          <input
                            type="date"
                            value={inputValues[opt.key] || ''}
                            onChange={e => handleInputChange(opt.key, e.target.value)}
                            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary focus:border-primary"
                          />
                        )}
                        {opt.input_type === 'date_range' && (
                          <div className="flex gap-2">
                            <input
                              type="date"
                              value={inputValues[opt.key]?.split('|')[0] || ''}
                              onChange={e => {
                                const end = inputValues[opt.key]?.split('|')[1] || '';
                                handleInputChange(opt.key, `${e.target.value}|${end}`);
                              }}
                              className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary focus:border-primary"
                            />
                            <input
                              type="date"
                              value={inputValues[opt.key]?.split('|')[1] || ''}
                              onChange={e => {
                                const start = inputValues[opt.key]?.split('|')[0] || '';
                                handleInputChange(opt.key, `${start}|${e.target.value}`);
                              }}
                              className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary focus:border-primary"
                            />
                          </div>
                        )}
                        {opt.input_type === 'text' && (
                          <input
                            type="text"
                            value={inputValues[opt.key] || ''}
                            onChange={e => handleInputChange(opt.key, e.target.value)}
                            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary focus:border-primary"
                          />
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Hint text */}
              {selectedOptions.length === 0 && (
                <p className="text-xs text-gray-400 mt-2 text-center">
                  {language === 'tr' ? '↑ Lütfen bir seçenek seçin' : '↑ Please select an option above'}
                </p>
              )}

              {/* Submit button */}
              <button
                onClick={handleSubmitAnswer}
                disabled={!canSubmit}
                className={`w-full mt-3 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                  canSubmit
                    ? 'bg-primary text-white hover:bg-secondary cursor-pointer'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                <Send className="w-4 h-4" />
                {language === 'tr' ? 'Gönder' : 'Submit'}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
