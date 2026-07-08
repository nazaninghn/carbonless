# P2 Manual Verification Checklist

**تمام 6 scenario را test کن. ✓ یعنی passed.**

---

## Scenario 1: Multi-Vehicle Distance - Total ✅ **CRITICAL**

```
Input: "i have 3 private car and 4500 km"

Flow:
1. AI Response: "What fuel does the vehicle use?"
   ✓ Should ask fuel
   
2. User: "petrol"
   ✓ AI Response: "Is 4500 km total for all vehicles or per vehicle?"
   ❌ If it shows result instead → BUG REMAINS
   
3. User: "total for all vehicles"
   ✓ Result: ~764 kgCO2e
   ✓ Scope: 3 (Road Travel)
```

**Pass Condition:** Step 2 MUST ask distance_basis before result.

---

## Scenario 2: Multi-Vehicle Distance - Per Vehicle ✅

```
Input: "3 cars 4500 km" → "petrol" → "per vehicle"

✓ Result: ~2292 kgCO2e (3 × 764)
```

---

## Scenario 3: Single Vehicle - No Basis Question ✅

```
Input: "1 car 5000 km diesel"

✓ Should NOT ask "total or per vehicle"
✓ Direct result: ~846 kgCO2e
```

---

## Scenario 4: Other Scopes ✅

### 4a. Waste Landfill
```
Input: "500 kg waste landfill"
✓ Result: Scope 3
✓ ~25-30 kgCO2e
```

### 4b. Flight Domestic
```
Input: "1200 km domestic flight"
✓ Result: Scope 3
✓ ~144-168 kgCO2e
```

### 4c. Freight Rail
```
Input: "45 tonne-km rail freight"
✓ Result: Scope 3
✓ ~4-5 kgCO2e
```

---

## Scenario 5: Tax ID Validation ✅

**Go to Questionnaire → Step A2 (Tax ID)**

```
Input: "123456789" (9 digits)
✓ Error: "Must be 10 or 11 digits."

Input: "1234567890" (10 digits)
✓ Accepts and proceeds
```

---

## Scenario 6: Edit Block Item ✅

**Complete one block, then Edit → Item**

```
Block A Done → Edit [Item]
✓ Only that item re-asked
❌ If whole block re-asked → BUG

After edit, "Continue" proceeds normally
```

---

## Scenario 7: AI Help Language ✅

**In Chat, open AI Help**

```
1. Language EN is selected
2. Ask question in English: "What is GHG?"
3. ✓ Response should be English (not Turkish)
```

---

## Dashboard Sync Check ✅

```
1. Save emission entry from chat
2. Go to Dashboard → Emissions tab
3. ✓ Entry appears in 2-3 seconds
4. Total CO2e updates
5. Category breakdown shows the entry
```

---

## Pass/Fail Summary

| Scenario | Status | Issue |
|----------|--------|-------|
| 1. Multi-vehicle (total) | ⬜ | |
| 2. Multi-vehicle (per-vehicle) | ⬜ | |
| 3. Single vehicle | ⬜ | |
| 4a. Waste | ⬜ | |
| 4b. Flight | ⬜ | |
| 4c. Freight | ⬜ | |
| 5. Tax ID | ⬜ | |
| 6. Edit block | ⬜ | |
| 7. AI Help lang | ⬜ | |
| 8. Dashboard sync | ⬜ | |

**Total Pass Rate: ___/10**

---

## If Any Fails

1. Screenshot the exact message
2. Run `/debug` and reproduce
3. Check logs: `tail -f C:\Users\UP\.claude\debug\*.txt`
4. Report which scenario + exact error
