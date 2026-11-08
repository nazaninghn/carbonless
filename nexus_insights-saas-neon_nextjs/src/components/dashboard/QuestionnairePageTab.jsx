'use client';

import { useEffect } from 'react';
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

// The page title. While a questionnaire is open the inventory needs the whole height, so the title shrinks to
// a visually hidden heading (the questionnaire's own bar already names the inventory and holds "My Inventories");
// the library and the review keep the full header.
function PageHeader({ tr }) {
  const { mode } = useInventory();
  const title = tr ? 'Karbon Envanteri' : 'Carbon Inventory';
  if (mode !== 'library' && mode !== 'review') {
    return <h1 className="sr-only" data-testid="page-title">{title}</h1>;
  }
  // One line on a phone, so the inventory keeps the screen.
  return (
    <div className="mb-3 flex flex-row items-center justify-between gap-3" data-testid="page-title">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="hidden h-9 w-9 items-center justify-center rounded-[10px] bg-[#2ABD41]/12 ring-1 ring-[#2ABD41]/20 sm:flex">
          <ClipboardList className="h-[18px] w-[18px] text-[#1D9C31]" />
        </div>
        <div className="leading-tight">
          <h1 className="app-title truncate">{title}</h1>
          <p className="app-subtitle hidden sm:block">
            {tr
              ? 'Şirketinizin karbon ayak izini adım adım hesaplayın'
              : "Calculate your company's carbon footprint step by step"}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <div className="hidden h-7 items-center gap-1.5 rounded-full border border-[#CFE9D4] bg-white px-2.5 sm:flex">
          <HelpCircle className="h-3.5 w-3.5 text-[#2ABD41]" />
          <span className="text-[11px] font-semibold text-[#175022]/70">
            {tr ? 'ISO 14064-1 uyumlu' : 'ISO 14064-1 compliant'}
          </span>
        </div>
      </div>
    </div>
  );
}

// The library is a page of cards that sits straight on the page background (and scrolls with it); the questionnaire
// and the review keep their framed, height-bound surface.
function ContentFrame({ children }) {
  const { mode } = useInventory();
  if (mode === 'library') return <div className="w-full">{children}</div>;
  return (
    <div className="flex flex-1 min-h-0 flex-col rounded-3xl border border-white/80 bg-white/75 overflow-hidden shadow-[0_18px_50px_-24px_rgba(7,44,14,0.25)] backdrop-blur-xl">
      {children}
    </div>
  );
}

// Tells the page around it whether an inventory's questionnaire is open (mode 'questionnaire'), so AI mode can hand its own
// header's space to the workspace. Renders nothing; without `onChange` (the dashboard's Carbon Inventory tab) it does nothing.
function WorkspaceSignal({ onChange }) {
  const { mode } = useInventory();
  useEffect(() => {
    if (!onChange) return undefined;
    onChange(mode === 'questionnaire');
    return () => onChange(false);       // leaving the page (or the mode) always gives the header back
  }, [mode, onChange]);
  return null;
}

export default function QuestionnairePageTab({ language, onWorkspaceChange }) {
  const tr = language === 'tr';

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <InventoryProvider>
        <WorkspaceSignal onChange={onWorkspaceChange} />
        <PageHeader tr={tr} />
        {/* Main content area */}
        <ContentFrame>
          <QuestionnaireContent language={language} />
        </ContentFrame>
      </InventoryProvider>
    </div>
  );
}
