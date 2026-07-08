# User Testing Guide - Multiple Surveys Feature

## What's Been Fixed

You can now:
✅ **Create multiple surveys** - Each survey gets a unique name with date/time  
✅ **Complete surveys** - Get proper reports that you can view  
✅ **Start new surveys** - Without getting stuck resuming old ones  
✅ **Track survey metadata** - Know when each survey was created and by whom  

---

## Step-by-Step Testing

### Phase 1: Start and Complete First Survey

#### Step 1: Log In & Go to Dashboard
1. Navigate to the application
2. Log in with your credentials
3. Click on the "Questionnaire" or "AI Carbon" tab
4. You should see the welcome screen

#### Step 2: Start First Survey
1. Click "Start Inventory" button
2. Note: Survey automatically gets a name like `Survey — 07/08/2026 14:23`
3. First question should appear (Question 1/133)
4. Begin answering questions

#### Step 3: Answer Questions
- Go through questions at your pace
- You can click "Back" to review previous answers
- Use "Start Over" button if you want to reset (more on this later)
- Progress indicator shows: `Q <current> / 133`

#### Step 4: Complete Survey
1. Continue through all 133 questions
2. On the **final question (Q127: "GHG Inventory Complete")**:
   - You'll see two options:
     - "Review Assumptions"
     - "Done — close"
3. Select **"Done — close"**
4. You should see: **"Congratulations! All questions completed..."**

#### Step 5: View First Survey Report
- After 3 seconds, you're automatically taken to the Reports tab
- You should see your completed survey with:
  - Title: `Survey — 07/08/2026 14:23`
  - Status: `Completed`
  - Reporting year and other metadata

---

### Phase 2: Start and Complete Second Survey

#### Step 1: Return to Questionnaire Tab
1. Click back on the "Questionnaire" tab
2. You should see the welcome screen (not a "resume" message)
3. This is different from before — previously it would resume the old one!

#### Step 2: Start Second Survey
1. Click "Start Inventory" button
2. Note: The survey gets a **NEW** name with current time
   - E.g., if first was `Survey — 07/08/2026 14:23`
   - Second might be `Survey — 07/08/2026 14:28`
3. First question appears
4. Begin answering (you can take a shortcut by copy-pasting answers)

#### Step 3: Complete Second Survey
- Answer all 133 questions again
- Select "Done — close" on the final question
- See completion message

#### Step 4: View Both Surveys
- Navigate to Reports tab
- You should now see **TWO** completed surveys:
  1. `Survey — 07/08/2026 14:23` (First survey)
  2. `Survey — 07/08/2026 14:28` (Second survey)
- Each has its own data, emissions calculations, and reports

---

### Phase 3: Test "Start Over" Button

#### Step 1: Start Third Survey
1. Go to Questionnaire tab
2. Click "Start Inventory"
3. You're in a fresh survey (should get a new timestamp)
4. Answer a few questions (e.g., Q1-Q10)

#### Step 2: Use "Start Over"
1. Click the "↻ Start Over" button in the top-right
2. Confirm: Click "Yes" when asked "Sure?"
3. You're back to the welcome screen
4. All your answers are cleared

#### Step 3: Start Fresh Survey
1. Click "Start Inventory" again
2. You should see the welcome screen (not "resuming")
3. This is a **brand new** survey (new timestamp)
4. Previous in-progress survey was auto-marked as complete

---

### Phase 4: Verify Survey Metadata

#### Check the Reports Tab
For each survey, you should see:
- **Title**: Auto-generated with date and time
- **Status**: "Completed"
- **Created By**: Your username (logged-in user)
- **Created At**: Exact timestamp when survey was started
- **Reporting Year**: Extracted from your answers
- **Current Step**: "COMPLETED" or "7B-INFO"

#### In Database (Advanced)
Run this SQL to see the structure:
```sql
SELECT 
  id,
  title,
  status,
  created_by_id,
  created_at,
  updated_at,
  current_step
FROM questionnaire_carbonreport
ORDER BY created_at DESC;
```

You should see multiple rows, each with:
- Unique `id`
- `status = 'completed'`
- Unique `title` with different timestamps
- `created_by_id` = your user ID
- Different `created_at` timestamps

---

## Common Issues & Troubleshooting

### Issue 1: "Start Over" Shows 500 Error

**Symptoms**: Clicking "Start Over" gives a server error  
**Solution**: 
- Check backend logs for the error
- Ensure migrations are applied: `python manage.py migrate`
- Restart backend: `python manage.py runserver`

### Issue 2: Starting New Survey Still Shows "Resume" Message

**Symptoms**: After completing survey 1, clicking "Start Inventory" says "Resuming..."  
**Cause**: Old survey not marked as COMPLETED  
**Solution**:
- Check backend logs for completion message: `✅ Report X marked as COMPLETED`
- Verify the database: `SELECT status FROM questionnaire_carbonreport WHERE id=X`
- If status is still "in_progress", the fix may not be deployed

### Issue 3: Survey Names All Look The Same

**Symptoms**: Multiple surveys have identical titles  
**Expected**: Each should have different timestamps  
**Solution**:
- Check browser time is correct
- Ensure a few seconds pass between starting surveys
- Refresh Reports page to see updated times

### Issue 4: Can't Find Reports After Completion

**Symptoms**: Survey completes but doesn't show in Reports tab  
**Solution**:
- Go to Reports tab and refresh (F5)
- Check backend logs: `No report found in DB for user...`
- Verify company is set up in Settings
- Try again - there may be a slight delay

---

## Expected Behavior Summary

| Action | Before Fix | After Fix |
|--------|-----------|-----------|
| Complete survey | Report stays "IN_PROGRESS" | Report marked "COMPLETED" ✓ |
| View report | Can't access completed report | Report shows in Reports tab ✓ |
| Start new survey | "Resuming old survey..." | Fresh survey with new timestamp ✓ |
| Multiple surveys | Only 1 survey possible | Unlimited surveys possible ✓ |
| Survey name | Default timestamp | Auto-generated with time ✓ |
| Start Over | May not work properly | Properly resets and creates new ✓ |

---

## Screenshots to Look For

### 1. Welcome Screen (Correct)
```
"Hello! I'm CarbonIQ — I'll help you build an ISO 14064-1..."
[Start Inventory] button
```
✓ NOT "Resuming from Question X" - that's wrong!

### 2. Question Screen (Correct)
```
[Menu] [Q 25 / 133] [ISO 14064-1 §2.1] [←Back] [↻Start Over]
```

### 3. Completion Screen (Correct)
```
"Congratulations! All questions completed..."
"Click below to view your report."
[Navigating to Reports...]
```

### 4. Reports List (Correct)
```
Survey — 07/08/2026 14:23  | Completed | 2026-07-08
Survey — 07/08/2026 14:28  | Completed | 2026-07-08
Survey — 07/08/2026 14:35  | Completed | 2026-07-08
```
✓ Each survey has DIFFERENT timestamp  
✓ Each shows "Completed" status

---

## Backend Logs to Watch For

### Success Logs
```
✅ Report 42 marked as COMPLETED (user 5)
✅ Report 43 marked as COMPLETED (user 5)
```

### Error Logs (If Something's Wrong)
```
❌ Report summary retrieval FAILED: ...
❌ Dashboard sync failed: ...
```

---

## Questions to Answer After Testing

1. **Can you start the first survey?**  
   Yes ☐ / No ☐

2. **Can you complete it and see a congratulations message?**  
   Yes ☐ / No ☐

3. **Does it auto-navigate to Reports after completion?**  
   Yes ☐ / No ☐

4. **Can you see your first completed survey in the Reports tab?**  
   Yes ☐ / No ☐

5. **When you start a new survey, does it show the welcome screen (not "resume")?**  
   Yes ☐ / No ☐

6. **Can you complete the second survey?**  
   Yes ☐ / No ☐

7. **Do both surveys show in the Reports tab with different timestamps?**  
   Yes ☐ / No ☐

8. **Does "Start Over" work without errors?**  
   Yes ☐ / No ☐

---

If all answers are "Yes" ✓, the feature is working correctly!

---

## Quick Reference

**To run the system:**
```bash
# Terminal 1 - Backend
cd carbonless_backend
python manage.py runserver

# Terminal 2 - Frontend  
cd nexus_insights-saas-neon_nextjs
npm run dev
```

**To check logs:**
```bash
# Backend logs (auto-printed)
tail -f carbonless_backend/backend.log

# Database check
python manage.py shell
>>> from questionnaire.models import CarbonReport
>>> CarbonReport.objects.all().values('id', 'status', 'title', 'created_at')
```

---

**Need help?** Check `SURVEY_FIX_SUMMARY.md` for technical details.
