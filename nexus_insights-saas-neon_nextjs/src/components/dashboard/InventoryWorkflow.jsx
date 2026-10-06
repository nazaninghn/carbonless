'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { api } from '@/lib/utils/api';
import { noPermissionMessage } from '@/lib/permissions';
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
  // Name of the team mate who started the open inventory (null when it's ours).
  const [startedBy, setStartedBy] = useState(null);
  const [inventoryStatus, setInventoryStatus] = useState('draft');

  // Survey state
  const [answers, setAnswers] = useState({});
  const [currentStep, setCurrentStep] = useState('A1');
  // true when currentStep is a question the user asked to open ("Ankette aç"),
  // not the last answered one — the survey then shows exactly that question.
  const [stepExact, setStepExact] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Save-on-exit
  const [showSaveModal, setShowSaveModal] = useState(false);
  const exitActionRef = useRef(null);

  // ✅ Start new inventory
  // `tr` is optional (defaults to false/English) — this provider has no
  // language of its own, callers pass it through so the one hardcoded
  // fallback below (when the backend doesn't return its own error text)
  // isn't stuck in English regardless of the selected language.
  const startNewInventory = useCallback(async (name, tr = false) => {
    setLoading(true);
    setError('');
    try {
      // Keep the name exactly as typed; the list already shows each draft's
      // date. An unnamed inventory is called after today's date, written the
      // way the user reads dates (27.09.2026, not 9/27/2026, 11:50:01 PM).
      const title = (name || '').trim()
        || new Date().toLocaleDateString(tr ? 'tr-TR' : 'en-GB');
      const res = await api.startCarbonReport(title, true);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(res.status === 403
          ? noPermissionMessage(tr)
          : (data.error || (tr ? 'Envanter başlatılamadı' : 'Could not start inventory')));
        return false;
      }

      setActiveInventoryId(data.report_id);
      setInventoryTitle(data.title);
      setStartedBy(null);
      setInventoryStatus('in_progress');
      setCurrentStep(data.current_step || 'A1');
      setStepExact(false);
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
  // `atStep` opens the inventory on that question instead of where it was
  // left (used by "Ankette düzelt" on a questionnaire-created record).
  const continueInventory = useCallback(async (inventoryId, atStep = null) => {
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
      setStartedBy(data.started_by || null);
      setInventoryStatus(data.status);
      setCurrentStep(atStep || data.current_step || 'A1');
      setStepExact(!!atStep);
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

  // "Ankette düzelt" from Emisyon Yönetimi leaves an open request behind and
  // switches to this tab; pick it up once the tab is mounted.
  useEffect(() => {
    let req = null;
    try {
      req = JSON.parse(sessionStorage.getItem('carboniq_open_request') || 'null');
      sessionStorage.removeItem('carboniq_open_request');
    } catch { req = null; }
    if (req?.report_id) continueInventory(req.report_id, req.step_id || null);
  }, [continueInventory]);

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
      setStepExact(false);
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
    startedBy,
    inventoryStatus,
    answers,
    currentStep,
    stepExact,
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
