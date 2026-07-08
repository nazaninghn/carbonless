---
name: carbonless_survey_completion_fix
description: Fixed multiple surveys & completion tracking — auto-names surveys, marks complete in DB
metadata:
  type: project
---

## Survey Completion & Multiple Surveys Fix

**Status**: Completed and deployed (commit c47155e)  
**Date**: 2026-07-08  
**Issue**: Only 1 survey completable; subsequent attempts got stuck resuming old one

## The Problem

Users reported:
- Could complete 1 survey to end but never got reports
- Could not create new surveys (system tried to resume old ones)
- Surveys had no clear names/dates/metadata
- "Start Over" button didn't work properly

Root cause: When final question (7B-INFO) was submitted, backend never marked CarbonReport as COMPLETED. It stayed IN_PROGRESS, so StartReportView kept resuming it.

## The Solution

### Backend Fix (`questionnaire/views.py`)
- Added logger import (was missing, causing errors)
- Added completion detection in SubmitStepView:
  - When step='7B-INFO' AND data['answer']=='done'
  - Mark report.status = COMPLETED
  - Log for debugging

### Frontend Fix
- Updated API to accept title parameter: `startCarbonReport(title)`
- Auto-generate survey names: `Survey — MM/DD/YYYY HH:mm`
- Pass to backend on start

**Why it works**: 
- 7B-INFO is provably the final question (ID in questions.js line 4707)
- 'done' answer means user selected "Done — close"
- Once marked COMPLETED, StartReportView won't find it in resume query
- Timestamp is automatic, no user input needed

## How It Works Now

1. **Complete Survey**: Q127 answer 'done' → marked COMPLETED ✓
2. **Next Survey**: StartReportView finds NO IN_PROGRESS reports → creates new one ✓  
3. **Multiple Surveys**: Each gets unique name with timestamp + tracked creator ✓
4. **Report Access**: Navigate to Reports tab to see all completed surveys ✓

## Files Changed
- `carbonless_backend/questionnaire/views.py` — completion detection + logging
- `nexus_insights-saas-neon_nextjs/src/lib/utils/api.js` — API signature for title
- `nexus_insights-saas-neon_nextjs/src/components/dashboard/CarbonAIPage.jsx` — auto-generate title

## Testing
- Start survey → complete all 133 Q's → see congratulations ✓
- Check Reports tab → survey appears with COMPLETED status ✓
- Start new survey → get fresh one (not resumed) ✓
- Both surveys show different timestamps in Reports ✓

**How to test**: See USER_TESTING_GUIDE.md in project root

## Known Limitations
- Survey title auto-generated (user can't customize yet)
- Time format: `Survey — MM/DD/YYYY HH:mm` (could add seconds if needed)

## Future Enhancements
- Allow manual survey naming/description
- Bulk export of multiple surveys
- Copy answers from previous survey
- Survey tags/categories
