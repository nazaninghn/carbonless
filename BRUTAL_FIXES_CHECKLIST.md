# 🔥 Brutal Fixes Checklist - Survey Completion & Multi-Survey Support

## Problem Statement
**پروژه بعد از تکمیل سروی report نمی‌دید و سروی جدید نمی‌ساخت.**

Root cause: State machine broken. Backend + Frontend contract misaligned. Survey status ambiguous.

---

## ✅ Fixed Issues

### 1. Backend Response (SubmitStepView)
**BEFORE:**
```python
return Response({
    'success': True,
    'step': step,
    'next_step': step,  # ❌ WRONG: Says to show same step
    'message': 'Step saved.'
})
```

**AFTER:**
```python
if step == '7B-INFO' and data.get('answer') == 'done':
    report.status = COMPLETED
    return Response({
        'success': True,
        'next_step': None,  # ✅ NULL means DONE
        'completed': True,
        'status': 'COMPLETED'
    })
```

**Why it matters:** Frontend now has CLEAR signal that survey ended.

---

### 2. Frontend API Contract
**BEFORE:**
```javascript
startCarbonReport: (title = '') => request('/questionnaire/start/', {
    method: 'POST',
    body: JSON.stringify({ title })
    // ❌ Never sends force_new
})
```

**AFTER:**
```javascript
startCarbonReport: (title = '', forceNew = false) => request('/questionnaire/start/', {
    method: 'POST',
    body: JSON.stringify({ title, force_new: forceNew })
    // ✅ Explicit force_new parameter
})
```

**Why it matters:** Backend supports force_new but frontend wasn't using it.

---

### 3. Completion Detection (Frontend)
**BEFORE:**
```javascript
// Frontend tried to detect completion from question flow
if (!nextId) {
    // Guess: no more questions = must be done
    setCompleted(true);
}
```

**AFTER:**
```javascript
const saveRes = await saveStepToBackend(step, value);

// ✅ Trust backend, not guessing
if (saveRes.data?.completed === true || saveRes.data?.next_step === null) {
    setCompleted(true);
    // Fetch real report data
    api.getReportStatus(reportId).then(...)
}
```

**Why it matters:** Backend is source of truth, not frontend guessing.

---

### 4. Survey Lifecycle (Start vs Continue)
**BEFORE:**
```
Button "Start" → Always resume old survey
Button "Continue" → Resume old survey
```

**AFTER:**
```
Button "Start New" → handleShowNamingDialog(forceNew: true)
  → api.startCarbonReport(title, forceNew: true)
  → Backend creates NEW report

Button "Continue" → handleShowNamingDialog(forceNew: false)
  → api.startCarbonReport(title, forceNew: false)
  → Backend resumes existing incomplete report
```

**Why it matters:** User can now create multiple distinct surveys.

---

## 🧪 Test Cases

### Test 1: Complete First Survey & See Report
```
STEPS:
1. Click "Start Inventory"
2. Name survey: "Q3 Audit"
3. Answer all 133 questions
4. On Q127 (7B-INFO): Select "Done — close"

EXPECTED:
✅ Backend returns next_step: null + status: COMPLETED
✅ Frontend shows: "✅ Congratulations! All questions completed."
✅ Report displays inline with summary
✅ Database: CarbonReport.status = 'COMPLETED'
```

### Test 2: Start Second Survey (New, Not Resume)
```
STEPS:
1. After completing first survey, click "Start New"
2. Name survey: "Q4 Audit"
3. Answer first 5 questions

EXPECTED:
✅ NEW report created (different ID)
✅ Database shows TWO reports: both COMPLETED
✅ Frontend doesn't show "Resuming from Q127"
✅ New survey starts fresh at Q1
```

### Test 3: Incomplete Survey → Continue
```
STEPS:
1. Start survey, answer 20 questions
2. Close browser/navigate away
3. Come back, click "Continue"
4. Name: doesn't matter (will resume)

EXPECTED:
✅ Same report ID
✅ Resume at Q21 (where you left off)
✅ Status: IN_PROGRESS
```

### Test 4: Multiple Surveys in Report Tab
```
STEPS:
1. Complete 2 surveys
2. Navigate to Reports tab

EXPECTED:
✅ List shows 2+ completed surveys
✅ Each has: Name, Date, Creator, Status=COMPLETED
✅ Each has different timestamp
✅ Can download/view each report
```

### Test 5: Report Readiness Calculation
```
STEPS:
1. Complete survey with all questions answered
2. Check Report tab → Readiness %

EXPECTED:
✅ Readiness shows progress (e.g., 60%)
✅ Questionnaire checkbox is CHECKED
✅ No errors if entry count is 0 (just means no manual entries yet)
```

---

## 🔍 Database Verification

```sql
-- After completing first survey:
SELECT id, title, status, created_by_id, created_at 
FROM questionnaire_carbonreport 
WHERE created_by_id = (SELECT id FROM auth_user WHERE username='testuser')
ORDER BY created_at DESC;

-- Should show:
-- id | title           | status      | created_by_id | created_at
-- 5  | Q4 Audit — ...  | in_progress | 1             | 2026-07-08
-- 4  | Q3 Audit — ...  | COMPLETED   | 1             | 2026-07-08
```

---

## 🔴 Common Issues & Fixes

### Issue: "Survey still resuming, not creating new"
**Check:**
```python
# In StartReportView
force_new = request.data.get('force_new', False)
if not force_new:
    # Check for existing DRAFT/IN_PROGRESS
    ...
```
**Fix:** Make sure `forceNew: true` is being sent from frontend

---

### Issue: "Report shows but empty/no emissions"
**Symptoms:** Survey completed but Report Readiness still low
**Root:** Survey completion ≠ Carbon Inventory Report
- Survey = questionnaire answers (boundary, scope, year, etc.)
- Report = questionnaire + emission entries + calculations

**Check:**
```python
# Did survey save results to ReportField?
SELECT COUNT(*) FROM questionnaire_reportfield 
WHERE report_id = X;

# Did any EmissionEntry get created?
SELECT COUNT(*) FROM emissions_emissionentry 
WHERE company_id = Y AND year = 2026;
```

**Fix:** Survey alone doesn't create entries. User must also:
1. Log emissions via Chat, OR
2. Manually enter data in Emissions tab

---

### Issue: "Backend returns next_step but frontend doesn't see NULL"
**Check:**
```javascript
console.log("Backend response:", saveRes.data);
// Should show: { completed: true, next_step: null, status: 'COMPLETED' }
```

**Fix:** Make sure response is being parsed:
```javascript
const saveRes = await saveStepToBackend(...)
const respData = await res.json() // ✅ Must parse JSON
return { success: true, data: respData }
```

---

## 📋 Pre-Production Checklist

- [ ] Backend SubmitStepView returns `next_step: null` on completion
- [ ] Backend sets `status = COMPLETED` before returning response
- [ ] Frontend API includes `force_new` parameter
- [ ] Frontend parsesSaveResponse for `completed` flag
- [ ] Frontend shows CompletionReportCard when `next_step: null`
- [ ] Survey naming dialog displays current user + date
- [ ] "Start New" button calls with `forceNew: true`
- [ ] "Continue" button calls with `forceNew: false`
- [ ] Report appears inline (not navigate away)
- [ ] Multiple surveys show in Reports tab with different IDs/dates
- [ ] Database shows multiple COMPLETED reports

---

## 🚀 Deployment Steps

1. **Code Changes:**
   ```bash
   git pull origin main
   # Changes already in commits c47155e, 18d349f, 4d2209d
   ```

2. **Database:**
   ```bash
   python manage.py migrate  # In case any migrations exist
   ```

3. **Backend Restart:**
   ```bash
   pkill -f "python manage.py runserver"
   python manage.py runserver 8000 &
   ```

4. **Frontend Restart:**
   ```bash
   npm run build && npm start
   ```

5. **Clear Cache:**
   - Browser: Ctrl+Shift+Delete (Clear browsing data)
   - LocalStorage: Open DevTools → Application → Clear All

---

## 🎯 Success Criteria

✅ **User can:**
- Start survey → name it → complete it → see report (same page)
- Start 2nd survey → fresh start (not resume old)
- See both surveys in Reports tab
- See each survey's name, date, creator, status

✅ **Database shows:**
- Multiple CarbonReport rows with status = COMPLETED
- Each has unique title, created_at, created_by
- Report steps saved for each

✅ **API Contract is clean:**
- `next_step: null` = survey done (period.)
- `force_new: true` = create new report
- `force_new: false` = resume existing

---

## 📞 Brutal Truth

**This codebase had:**
1. ❌ No clear state machine
2. ❌ Frontend guessing completion
3. ❌ Backend support that frontend didn't use
4. ❌ Hard-coded step check without validation
5. ❌ No contract between Backend/Frontend

**After these fixes:**
1. ✅ Clear state machine (DRAFT → IN_PROGRESS → COMPLETED)
2. ✅ Backend tells frontend when done (via API response)
3. ✅ Frontend uses `force_new` parameter
4. ✅ Completion validated by backend before sending
5. ✅ Backend = source of truth

**Result:** Multiple surveys work. Report appears. State is clear.

---

**Commit:** `4d2209d` (Aggressive state machine fix)

**Status:** 🟢 Ready for testing

