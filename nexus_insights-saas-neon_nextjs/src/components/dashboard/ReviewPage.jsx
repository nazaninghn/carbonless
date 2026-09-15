'use client';

import { useState } from 'react';
import { Edit2, ChevronLeft, Save } from 'lucide-react';
import { useInventory } from './InventoryWorkflow';
import { api } from '@/lib/utils/api';
import { getQuestionById, validateCarbonIQAnswer } from '@/lib/carboniq/questions';

// Question types whose answer isn't a plain string (compound: {field: value},
// country_city: {country, city}) can't be represented by this table's plain
// text box — saving one as free text would silently overwrite a structured
// answer with garbage the report renderer can't read. Editing those here is
// disabled; the user is pointed back to the questionnaire instead.
const NON_TEXT_EDITABLE_TYPES = new Set(['compound', 'country_city']);

export default function ReviewPage({ tr = false }) {
  const {
    activeInventoryId,
    answers,
    switchToQuestionnaire,
    loading,
    error,
    setDirty
  } = useInventory();

  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);

  const answeredQuestions = Object.entries(answers)
    .map(([qId, answer]) => ({
      qId,
      answer,
      question: getQuestionById(qId)
    }))
    .filter(item => item.question && item.question.type !== 'info');

  const handleEdit = (qId, currentValue) => {
    setEditingQuestionId(qId);
    setEditValue(currentValue || '');
    setEditError('');
  };

  const handleSaveEdit = async (qId) => {
    // This table edits every answer through one plain text box regardless of
    // the question's real type (numeric, single_select, ...) — nothing here
    // used to stop a user from typing letters into a numeric answer or an
    // arbitrary string into a single-select one. Run the same validator the
    // live questionnaire uses before it ever reaches the backend.
    const question = getQuestionById(qId);
    const check = validateCarbonIQAnswer(question, editValue, answers, tr ? 'tr' : 'en');
    if (!check.ok) {
      setEditError(check.message || (tr ? 'Geçersiz yanıt.' : 'Invalid answer.'));
      return;
    }
    setEditError('');
    setSaving(true);
    try {
      // Save to backend
      const res = await api.submitReportStep(activeInventoryId, qId, {
        answer: editValue
      });

      if (!res.ok) {
        alert(tr ? 'Kaydetme hatası' : 'Error saving');
        return;
      }

      // Update local state
      setEditingQuestionId(null);
      setDirty(true);
    } catch (e) {
      alert(tr ? 'Bağlantı hatası' : 'Connection error');
      console.error('Save edit error:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        <button
          onClick={switchToQuestionnaire}
          className="flex items-center gap-2 px-4 py-2 text-[#175022] hover:bg-[#175022]/10 rounded-lg transition"
        >
          <ChevronLeft className="w-5 h-5" />
          {tr ? 'Geri' : 'Back'}
        </button>
        <div>
          <h1 className="text-2xl font-bold text-[#175022]">
            {tr ? 'Yanıtları İncele' : 'Review Answers'}
          </h1>
          <p className="text-sm text-[#175022]/60">
            {answeredQuestions.length} {tr ? 'soru yanıtlandı' : 'questions answered'}
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-6">
          {error}
        </div>
      )}

      {/* Questions Table */}
      <div className="border border-[#175022]/10 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#175022]/3 border-b border-[#175022]/10">
              <tr>
                <th className="text-left px-6 py-3 font-semibold text-[#175022]">#</th>
                <th className="text-left px-6 py-3 font-semibold text-[#175022]">
                  {tr ? 'Soru' : 'Question'}
                </th>
                <th className="text-left px-6 py-3 font-semibold text-[#175022]">
                  {tr ? 'Cevap' : 'Answer'}
                </th>
                <th className="text-right px-6 py-3 font-semibold text-[#175022]">
                  {tr ? 'İşlem' : 'Action'}
                </th>
              </tr>
            </thead>
            <tbody>
              {answeredQuestions.map((item, idx) => (
                <tr
                  key={item.qId}
                  className={idx % 2 === 0 ? 'bg-white' : 'bg-[#175022]/2'}
                >
                  <td className="px-6 py-4 font-mono text-[10px] text-[#175022]/35">
                    {item.question.number}
                  </td>
                  <td className="px-6 py-4 text-[#175022]/65 max-w-xs">
                    {(item.question.text?.[tr ? 'tr' : 'en'] || item.question.text?.en)?.substring(0, 60)}...
                  </td>
                  <td className="px-6 py-4 font-semibold text-[#175022]">
                    {editingQuestionId === item.qId ? (
                      <div className="flex flex-col gap-1">
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className={`px-3 py-2 border rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-[#8BEA99] ${editError ? 'border-red-400' : 'border-[#175022]/20'}`}
                        />
                        {editError && (
                          <span className="text-xs text-red-500">{editError}</span>
                        )}
                      </div>
                    ) : (
                      <span>
                        {NON_TEXT_EDITABLE_TYPES.has(item.question.type)
                          ? (tr ? '(çoklu alan — düzenlemek için ankete dönün)' : '(multi-field — edit from the questionnaire)')
                          : String(item.answer).substring(0, 40)}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {editingQuestionId === item.qId ? (
                      <button
                        onClick={() => handleSaveEdit(item.qId)}
                        disabled={saving}
                        className="flex items-center gap-1 px-3 py-2 bg-[#175022] text-white text-xs font-bold rounded-full hover:bg-[#175022] transition disabled:opacity-50"
                      >
                        <Save className="w-3 h-3" />
                        {tr ? 'Kaydet' : 'Save'}
                      </button>
                    ) : NON_TEXT_EDITABLE_TYPES.has(item.question.type) ? null : (
                      <button
                        onClick={() => handleEdit(item.qId, item.answer)}
                        className="flex items-center gap-1 px-3 py-2 text-[#175022] hover:bg-[#175022]/10 rounded-full transition"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {answeredQuestions.length === 0 && (
        <div className="text-center py-12">
          <p className="text-[#175022]/60">
            {tr ? 'Henüz cevap yok' : 'No answers yet'}
          </p>
        </div>
      )}
    </div>
  );
}
