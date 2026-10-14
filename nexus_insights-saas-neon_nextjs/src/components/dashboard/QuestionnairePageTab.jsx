'use client';

import { InventoryProvider, useInventory } from './InventoryWorkflow';
import InventoryLibrary from './InventoryLibrary';
import ReviewPage from './ReviewPage';
import SaveDraftModal from './SaveDraftModal';
import { QuestionnaireTab } from './CarbonAIPage';
import { ClipboardList, HelpCircle } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// QuestionnairePageTab — standalone dashboard tab for the carbon questionnaire
// Wraps the same InventoryWorkflow/QuestionnaireTab used inside CarbonAIPage,
// but presented as a dedicated page in the dashboard instead of hidden in the
// AI overlay. Users can now find and access the questionnaire directly from
// the sidebar navigation.
// ─────────────────────────────────────────────────────────────────────────────

function QuestionnaireContent({ language }) {
  const {
    mode,
    activeInventoryId,
    answers: workflowAnswers,
    currentStep: workflowStep,
    stepExact: workflowStepExact,
    inventoryStatus,
    startedBy,
    setDirty,
    backToLibrary,
  } = useInventory();

  const tr = language === 'tr';

  // If in library mode, show InventoryLibrary
  if (mode === 'library') {
    return <InventoryLibrary tr={tr} />;
  }

  // If in review mode, show ReviewPage
  if (mode === 'review') {
    return <ReviewPage tr={tr} />;
  }

  // Otherwise (questionnaire mode) — render the survey
  return (
    <>
      <QuestionnaireTab
        language={language}
        isVisible={true}
        hydrated
        initialReportId={activeInventoryId}
        initialAnswers={workflowAnswers}
        initialStep={workflowStep}
        initialStepExact={workflowStepExact}
        inventoryCompleted={inventoryStatus === 'completed'}
        startedBy={startedBy}
        onDirtyChange={setDirty}
        onExitToLibrary={backToLibrary}
      />
      <SaveDraftModal tr={tr} />
    </>
  );
}

export default function QuestionnairePageTab({ language }) {
  const tr = language === 'tr';

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Header */}
      {/* One line on a phone, so the inventory keeps the screen. */}
      <div className="mb-1.5 flex flex-row items-center justify-between gap-3 sm:mb-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="hidden h-8 w-8 items-center justify-center rounded-lg bg-[#2ABD41]/10 sm:flex">
            <ClipboardList className="h-4 w-4 text-[#2ABD41]" />
          </div>
          <div className="leading-tight">
            <h1 className="truncate text-[16px] sm:text-[18px] font-bold text-[#072C0E] tracking-tight">
              {tr ? 'Karbon Envanteri' : 'Carbon Inventory'}
            </h1>
            <p className="hidden text-[11px] text-[#072C0E]/50 sm:block">
              {tr
                ? 'Şirketinizin karbon ayak izini adım adım hesaplayın'
                : 'Calculate your company\'s carbon footprint step by step'}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden items-center gap-1.5 rounded-full bg-[#F1FCF2] border sm:flex border-[#DEFAE1] px-3 py-1.5">
            <HelpCircle className="h-3.5 w-3.5 text-[#2ABD41]" />
            <span className="text-[11px] font-medium text-[#175022]/60">
              {tr ? 'ISO 14064-1 uyumlu' : 'ISO 14064-1 compliant'}
            </span>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 min-h-0 flex-col rounded-2xl border border-[#DEFAE1] bg-white overflow-hidden shadow-sm">
        <InventoryProvider>
          <QuestionnaireContent language={language} />
        </InventoryProvider>
      </div>
    </div>
  );
}
