'use client';

import { useState } from 'react';
import { Edit2, ChevronLeft, Save } from 'lucide-react';
import { useInventory } from './InventoryWorkflow';
import { api } from '@/lib/utils/api';
import { getQuestionById } from '@/lib/carboniq/questions';

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
  };

  const handleSaveEdit = async (qId) => {
    setSaving(true);
    try {
      // Save to backend
      const res = await api.submitReportStep(activeInventoryId, qId, {
        answer: editValue
      });

      if (!res.ok) {
        alert(tr ? 'خطا در ذخیره' : 'Error saving');
        return;
      }

      // Update local state
      setEditingQuestionId(null);
      setDirty(true);
    } catch (e) {
      alert(tr ? 'خطای اتصال' : 'Connection error');
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
          className="flex items-center gap-2 px-4 py-2 text-[#244959] hover:bg-[#244959]/10 rounded-lg transition"
        >
          <ChevronLeft className="w-5 h-5" />
          {tr ? 'بازگشت' : 'Back'}
        </button>
        <div>
          <h1 className="text-2xl font-bold text-[#244959]">
            {tr ? 'بررسی پاسخ‌ها' : 'Review Answers'}
          </h1>
          <p className="text-sm text-[#244959]/60">
            {answeredQuestions.length} {tr ? 'سوال پاسخ‌داده‌شده' : 'questions answered'}
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-6">
          {error}
        </div>
      )}

      {/* Questions Table */}
      <div className="border border-[#244959]/10 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#244959]/3 border-b border-[#244959]/10">
              <tr>
                <th className="text-left px-6 py-3 font-semibold text-[#244959]">#</th>
                <th className="text-left px-6 py-3 font-semibold text-[#244959]">
                  {tr ? 'سوال' : 'Question'}
                </th>
                <th className="text-left px-6 py-3 font-semibold text-[#244959]">
                  {tr ? 'پاسخ' : 'Answer'}
                </th>
                <th className="text-right px-6 py-3 font-semibold text-[#244959]">
                  {tr ? 'عمل' : 'Action'}
                </th>
              </tr>
            </thead>
            <tbody>
              {answeredQuestions.map((item, idx) => (
                <tr
                  key={item.qId}
                  className={idx % 2 === 0 ? 'bg-white' : 'bg-[#244959]/2'}
                >
                  <td className="px-6 py-4 font-mono text-[10px] text-[#244959]/35">
                    {item.question.number}
                  </td>
                  <td className="px-6 py-4 text-[#244959]/65 max-w-xs">
                    {(item.question.text?.[tr ? 'tr' : 'en'] || item.question.text?.en)?.substring(0, 60)}...
                  </td>
                  <td className="px-6 py-4 font-semibold text-[#244959]">
                    {editingQuestionId === item.qId ? (
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="px-3 py-2 border border-[#244959]/20 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-[#89E789]"
                      />
                    ) : (
                      <span>{String(item.answer).substring(0, 40)}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {editingQuestionId === item.qId ? (
                      <button
                        onClick={() => handleSaveEdit(item.qId)}
                        disabled={saving}
                        className="flex items-center gap-1 px-3 py-2 bg-[#244959] text-white text-xs font-bold rounded-full hover:bg-[#1a3a2e] transition disabled:opacity-50"
                      >
                        <Save className="w-3 h-3" />
                        {tr ? 'ذخیره' : 'Save'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleEdit(item.qId, item.answer)}
                        className="flex items-center gap-1 px-3 py-2 text-[#244959] hover:bg-[#244959]/10 rounded-full transition"
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
          <p className="text-[#244959]/60">
            {tr ? 'هنوز پاسخی وجود ندارد' : 'No answers yet'}
          </p>
        </div>
      )}
    </div>
  );
}
