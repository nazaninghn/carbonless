# Survey System - Multiple Surveys & Completion Fixes

## Issues Resolved

### 1. **Could Only Complete One Survey**
- **Problem**: After completing a survey, the backend kept the report in `IN_PROGRESS` status
- **Impact**: When trying to start a new survey, the system would "resume" the old incomplete one instead of creating a new one
- **Root Cause**: No logic to mark a report as `COMPLETED` when the final question was submitted

### 2. **No Reports Being Generated** 
- **Problem**: Reports were stuck in `IN_PROGRESS` status, preventing them from being retrieved
- **Impact**: Users couldn't see their completed survey results
- **Root Cause**: Missing completion detection in the submission flow

### 3. **No Survey Metadata**
- **Problem**: Surveys had no names, dates, or clear creator information
- **Impact**: Hard to distinguish between different survey attempts
- **Solution**: Auto-generate survey names with timestamps

## Technical Fixes

### Backend Changes (`questionnaire/views.py`)

#### Added Logger Import
```python
import logging
logger = logging.getLogger(__name__)
```

#### Report Completion Detection
When the final question (7B-INFO) is submitted with "done" answer:
```python
# Mark report as COMPLETED when final question (7B-INFO / done) is submitted
if step == '7B-INFO' and isinstance(data, dict) and data.get('answer') == 'done':
    report.status = CarbonReport.Status.COMPLETED
    logger.info(f"✅ Report {report.id} marked as COMPLETED (user {request.user.id})")
```

**Why this works:**
- `7B-INFO` is the final question in the questionnaire
- When user selects "Done — close", the answer value is `'done'`
- Frontend sends this as `{ answer: 'done' }` via the generic handler
- Backend now detects this and marks the report complete

### Frontend Changes

#### API Enhancement (`lib/utils/api.js`)
```javascript
startCarbonReport: (title = '') => request('/questionnaire/start/', {
  method: 'POST',
  body: JSON.stringify({ title })
})
```
Now accepts a title parameter that can be passed to the backend.

#### Auto-Generate Survey Names (`CarbonAIPage.jsx`)
```javascript
// Auto-generate survey title with timestamp (e.g., "2026-07-08 14:23")
const now = new Date();
const title = `Survey — ${now.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })} ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
const res = await api.startCarbonReport(title);
```

**Features:**
- Each survey gets a unique name with creation timestamp
- Format: `Survey — MM/DD/YYYY HH:mm` (e.g., `Survey — 07/08/2026 14:23`)
- Backend already tracks `created_by` (authenticated user)
- Combined, this provides full survey provenance

## How The Flow Now Works

### Starting a New Survey
1. User clicks "Start Inventory" or "Continue Inventory"
2. Frontend generates title: `Survey — <date> <time>`
3. Frontend calls `startCarbonReport(title)`
4. Backend checks for existing DRAFT/IN_PROGRESS reports
   - If found: Resumes with same report_id
   - If not: Creates new CarbonReport with the generated title
5. Questionnaire begins at Question 1 or resumes at last step

### Completing a Survey
1. User reaches final question (7B-INFO)
2. User selects "Done — close"
3. Frontend submits: `{ step: '7B-INFO', data: { answer: 'done' } }`
4. Backend receives submission in SubmitStepView
5. Detects `step == '7B-INFO'` and `data['answer'] == 'done'`
6. **NEW:** Marks report `status = CarbonReport.Status.COMPLETED`
7. Frontend detects null `next_step` → shows completion message
8. Frontend navigates to Reports tab after 3 seconds
9. Report is now retrievable via the Reports/Dashboard

### Starting a New Survey After Completion
1. Old report is marked COMPLETED ✓
2. User clicks "Start Inventory" again
3. StartReportView finds NO DRAFT/IN_PROGRESS reports
4. Creates brand new CarbonReport with fresh title/timestamp
5. User can complete multiple distinct surveys

### Resetting a Survey ("Start Over")
1. User clicks reset button during questionnaire
2. Frontend calls `api.resetQuestionnaire()`
3. Backend marks current IN_PROGRESS report as COMPLETED
4. Frontend clears all state and shows welcome screen
5. Next "Start Inventory" creates new report with new timestamp

## Testing Checklist

- [ ] Start first survey → See it begins at Q1 with auto-generated title
- [ ] Complete first survey → See "Congratulations" message
- [ ] Check Report tab → Verify first survey appears in list
- [ ] Start second survey → Verify it creates NEW report (not resuming old one)
- [ ] Check Report tab → Verify BOTH surveys appear with different timestamps
- [ ] Click "Start Over" mid-survey → Verify creates new report on next start
- [ ] Verify each survey has metadata:
  - Title with date/time
  - created_by (current logged-in user)
  - status = COMPLETED
  - created_at and updated_at timestamps

## Database State

### Before Fix
```sql
-- After completing survey:
SELECT id, status, title, created_by_id, created_at 
FROM questionnaire_carbonreport 
WHERE company_id = 1;

-- Output:
-- id | status      | title                          | created_by_id | created_at
-- 1  | IN_PROGRESS | Carbon Report — 2026-07-08...  | 5             | 2026-07-08
```
❌ Status stuck as IN_PROGRESS → Can't start new survey

### After Fix
```sql
-- After completing survey:
SELECT id, status, title, created_by_id, created_at 
FROM questionnaire_carbonreport 
WHERE company_id = 1 ORDER BY created_at;

-- Output:
-- id | status      | title                                    | created_by_id | created_at
-- 1  | COMPLETED   | Survey — 07/08/2026 14:23               | 5             | 2026-07-08
-- 2  | IN_PROGRESS | Survey — 07/08/2026 14:27               | 5             | 2026-07-08
```
✓ First survey marked COMPLETED
✓ Second survey has new title with new timestamp

## Logs

When a survey completes, you'll see in backend logs:
```
✅ Report 42 marked as COMPLETED (user 5)
```

## Future Enhancements

Could be implemented in future iterations:
- [ ] Allow users to manually name surveys instead of auto-generating
- [ ] Add survey descriptions/notes field
- [ ] Show survey list/selector before starting
- [ ] Copy previous survey answers to new one
- [ ] Export/archive completed surveys
- [ ] Add survey tags/categories

## Files Modified

```
carbonless_backend/questionnaire/views.py
  - Added logging import
  - Added report completion detection in SubmitStepView

nexus_insights-saas-neon_nextjs/src/lib/utils/api.js
  - Updated startCarbonReport to accept title parameter

nexus_insights-saas-neon_nextjs/src/components/dashboard/CarbonAIPage.jsx
  - Auto-generate survey title with timestamp
  - Pass title to startCarbonReport call
```

## Commit

```
fix: complete multiple surveys with auto-naming and proper completion tracking
commit: c47155e
```

---

**Status**: ✅ Ready for testing

**Test Plan**: Follow the testing checklist above to verify all functionality
