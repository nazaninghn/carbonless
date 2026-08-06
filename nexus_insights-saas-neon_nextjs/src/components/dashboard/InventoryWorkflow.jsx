'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { api } from '@/lib/utils/api';
import { readAnswerValue, unmapPhase1Answer } from '@/lib/carboniq/questions';

// A report resumed from the backend echoes back exactly what was PATCHed for
// each question — { answer: value } for most questions (mapAnswerForBackend's
// default case), but named backend fields for Phase 1 (e.g. { legal_name }).
// Neither shape matches what a live session stores in `answers` (the raw
// widget value), so every downstream consumer — conditionalShow checks,
// summary tables, goBack/edit pre-fill — would silently misread a resumed
// report until it was normalised once here, at load time.
function normalizeHydratedAnswers(rawAnswers) {
  const normalized = {};
  for (const [qid, raw] of Object.entries(rawAnswers || {})) {
    const unmapped = unmapPhase1Answer(qid, raw);
    normalized[qid] = unmapped !== undefined ? unmapped : readAnswerValue({ [qid]: raw }, qid);
  }
  return normalized;
}

const InventoryContext = createContext();

export function InventoryProvider({ children }) {
  // Workflow modes
  const [mode, setMode] = useState('library'); // 'library' | 'questionnaire' | 'review' | 'report'

  // Active inventory
  const [activeInventoryId, setActiveInventoryId] = useState(null);
  const [inventoryTitle, setInventoryTitle] = useState('');
  const [inventoryStatus, setInventoryStatus] = useState('draft');

  // Survey state
  const [answers, setAnswers] = useState({});
  const [currentStep, setCurrentStep] = useState('A1');
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Save-on-exit
  const [showSaveModal, setShowSaveModal] = useState(false);
  const exitActionRef = useRef(null);

  // ✅ Start new inventory
  const startNewInventory = useCallback(async (name) => {
    setLoading(true);
    setError('');
    try {
      const title = `${name} — ${new Date().toLocaleString()}`;
      const res = await api.startCarbonReport(title, true);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || 'Could not start inventory');
        return false;
      }

      setActiveInventoryId(data.report_id);
      setInventoryTitle(data.title);
      setInventoryStatus('in_progress');
      setCurrentStep(data.current_step || 'A1');
      setAnswers({});
      setDirty(false);
      setMode('questionnaire');

      // Save to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('carboniq_activeInventoryId', data.report_id);
      }

      return true;
    } catch (e) {
      setError('Connection error');
      console.error('startNewInventory:', e);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // ✅ Continue existing inventory
  const continueInventory = useCallback(async (inventoryId) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getReportStatus(inventoryId);
      if (!res.ok) {
        setError('Could not load inventory');
        return false;
      }

      const data = await res.json();
      setActiveInventoryId(inventoryId);
      setInventoryTitle(data.title || `Inventory ${inventoryId}`);
      setInventoryStatus(data.status);
      setCurrentStep(data.current_step || 'A1');
      setAnswers(normalizeHydratedAnswers(data.answers));
      setDirty(false);
      setMode('questionnaire');

      // Save to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('carboniq_activeInventoryId', inventoryId);
      }

      return true;
    } catch (e) {
      setError('Connection error');
      console.error('continueInventory:', e);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // ✅ Save draft
  const saveDraft = useCallback(async () => {
    if (!activeInventoryId) return false;

    try {
      const res = await api.saveReportDraft(activeInventoryId, {
        current_step: currentStep,
      });

      if (!res.ok) {
        setError('Could not save draft');
        return false;
      }

      setDirty(false);
      return true;
    } catch (e) {
      setError('Connection error');
      console.error('saveDraft:', e);
      return false;
    }
  }, [activeInventoryId, currentStep]);

  // ✅ Exit with save confirmation
  const requestExit = useCallback((action) => {
    if (dirty && mode === 'questionnaire') {
      exitActionRef.current = action;
      setShowSaveModal(true);
    } else {
      action();
    }
  }, [dirty, mode]);

  // ✅ Handle save modal response
  const handleSaveModalResponse = useCallback(async (shouldSave) => {
    setShowSaveModal(false);

    if (shouldSave) {
      const saved = await saveDraft();
      if (saved && exitActionRef.current) {
        exitActionRef.current();
      }
    } else if (exitActionRef.current) {
      exitActionRef.current();
    }

    exitActionRef.current = null;
  }, [saveDraft]);

  // ✅ Go back to library
  const backToLibrary = useCallback(() => {
    requestExit(() => {
      setMode('library');
      setActiveInventoryId(null);
      setAnswers({});
      setCurrentStep('A1');
      setDirty(false);
    });
  }, [requestExit]);

  // ✅ Switch to review mode
  const switchToReview = useCallback(() => {
    setMode('review');
  }, []);

  // ✅ Switch back to questionnaire
  const switchToQuestionnaire = useCallback(() => {
    setMode('questionnaire');
  }, []);

  const value = {
    // State
    mode,
    activeInventoryId,
    inventoryTitle,
    inventoryStatus,
    answers,
    currentStep,
    dirty,
    loading,
    error,
    showSaveModal,

    // Actions
    setAnswers,
    setCurrentStep,
    setDirty,
    startNewInventory,
    continueInventory,
    saveDraft,
    requestExit,
    handleSaveModalResponse,
    backToLibrary,
    switchToReview,
    switchToQuestionnaire,
  };

  return (
    <InventoryContext.Provider value={value}>
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventory() {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error('useInventory must be used within InventoryProvider');
  }
  return context;
}
