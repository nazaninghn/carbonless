# CarbonIQ Workspace — Client Demo Script
**Version:** Sprint 3 Stabilization · June 2026  
**Duration:** ~12–15 minutes  
**Audience:** Non-technical client / sustainability manager

---

## Pre-Demo Checklist (do this before the call)

```bash
# 1. Reset to clean state
cd carbonless_backend
python -X utf8 demo_seed.py reset

# 2. Start both servers
# Terminal A — backend
cd carbonless_backend && python manage.py runserver

# Terminal B — frontend
cd nexus_insights-saas-neon_nextjs && npm run dev

# 3. Open browser to
http://localhost:3000/dashboard/workspace

# 4. Confirm GROQ_API_KEY is set (starts with gsk_)
echo $GROQ_API_KEY   # Linux/Mac
$env:GROQ_API_KEY    # Windows PowerShell
```

**Confirm before starting:**
- [ ] Browser at `/dashboard/workspace` with empty state banner visible
- [ ] Backend running on port 8000, no errors in terminal
- [ ] Groq key configured and responding (test with one message)
- [ ] Screen at ≥1280px wide so the right data-entry panel is visible

---

## Step 1 — Empty Workspace (1 min)

**What to show:**
- The green-tinted banner: *"Henüz aktivite verisi yok"*
- Three category cards: 3A (Stationary Combustion), 4A (Electricity), K4 (Upstream Transport)
- All status dots are grey (missing)
- Sidebar progress bar: 0/3

**What to say:**
> "This is the Workspace. It starts completely empty — no hard-coded data, no pre-filled assumptions. Everything the client enters is tied to their specific report."

> "There are three emission scopes tracked here. Each one can be populated either manually through the panels on the right, or by simply describing the data to the AI assistant."

---

## Step 2 — 3A Stationary Combustion via AI (3 min)

### 2a. Open AI Chat
Click the **"AI Asistan'ı Aç"** button on the empty state banner  
*(or click the "AI" toggle in the topbar)*

### 2b. Type this exact phrase:
```
Geçen yıl 15000 m³ doğalgaz kullandık.
```

**Expected AI reply (in Turkish):**
> *"Geçen yıl 15.000 m³ doğalgaz kullanımı kaydedildi."* (or similar)

**Expected SuggestionReviewCard appears immediately below:**

| Alan | Değer | Güven |
|------|-------|-------|
| Fuel type | natural_gas | ~95% |
| Consumption | 15000 | ~92% |
| Unit | m3 | ~88% |

Overall confidence badge: **~92% güven** (green)

### 2c. Click "Onayla & Kaydet"

**Expected response:**
- Card disappears → replaced by green "✓ Onaylandı — 3A" chip
- AI replies: *"✓ Veriler kaydedildi! 3 alan güncellendi."*
- **Right panel auto-fills immediately** (look at the "Güncelleniyor" pulse in the panel header)

### 2d. Switch to Dashboard, select 3A

**Expected panel state:**
- Yakıt türü: Doğalgaz ✓
- Tüketim miktarı: 15000 ✓
- Birim: m³ ✓
- Emission estimate box:

```
Tahmini Emisyon (DEFRA 2023)
▶  30.30 tCO₂e
```
*(15,000 m³ × 2.02 kgCO₂e/m³ = 30,300 kgCO₂e)*

**Sidebar / Category card:**
- 3A status dot: 🟢 green (complete)
- Sidebar tCO₂e: **30.3 tCO₂e**
- Progress bar: 1/3

---

## Step 3 — 4A Purchased Electricity via AI (3 min)

### 3a. Switch back to AI Chat
*(topbar toggle → "AI")*

### 3b. Type this exact phrase:
```
Geçen yıl TEDAŞ'tan 18000 kWh elektrik aldık.
```

**Expected SuggestionReviewCard:**

| Alan | Değer | Güven |
|------|-------|-------|
| Electricity supplier | TEDAŞ | ~94% |
| Electricity consumed (kWh) | 18000 | ~95% |

Overall confidence: **~95% güven** (green)

### 3c. Click "Onayla & Kaydet"

### 3d. Switch to Dashboard → click 4A card or category card

**Expected panel state (auto-filled):**
- Tüketim (kWh): 18000 ✓
- Tedarikçi: TEDAŞ ✓
- Emisyon faktörü: *(empty — needs grid preset)*

### 3e. Select grid preset: **"Türkiye (TEİAŞ)"**

This auto-fills:
- Faktör: **0.437** kgCO₂e/kWh
- Faktör kaynağı: **IEA 2023**

**Emission estimate appears:**
```
Tahmini Kapsam 2 Emisyonu
▶  7.87 tCO₂e
```
*(18,000 kWh × 0.437 = 7,866 kgCO₂e)*

### 3f. Click "Kaydet"

**Expected:**
- Save button flashes ✓ Kaydedildi
- 4A status dot: 🟢 green (complete)
- Progress bar: 2/3

---

## Step 4 — K4 Upstream Transport via Dashboard (4 min)

*(K4 uses the dashboard flow — AI extraction for complex multi-modal shipments is Sprint 4)*

### 4a. Click K4 card (or select from sidebar)

Right panel shows K4 panel with empty shipment form.

### 4b. Add a shipment

Fill in the draft form:
- **Taşıma modu:** Karayolu HGV >34t (tam dolu)
- **Yük (ton):** `45`
- **Mesafe (km):** `1200`

**Auto-calculated preview appears immediately:**
```
Tonne-km (otomatik)     54,000 t·km
```

**GLEC EF box appears:**
```
GLEC Framework v3
0.062 kgCO₂e/tonne-km
Karayolu HGV >34t (tam dolu)
```

**Per-shipment estimate:**
```
Bu sevkiyat tahmini     3,348 kgCO₂e
```

### 4c. Click "+ Sevkiyat Ekle"

Shipment appears in the list:
```
#1 · Karayolu HGV >34t (tam dolu)
45 t · 1200 km · 54,000 tkm         3,348 kgCO₂e
```

**Total summary box updates:**
```
Toplam Kat.4 Emisyonu (GLEC v3)
▶  3.35 tCO₂e
54,000 tonne-km · 1 sevkiyat
```

### 4d. Click "Kaydet"

**Expected:**
- K4 status dot: 🟢 green (complete)
- Progress bar: **3/3**
- Sidebar shows K4: **3.35 tCO₂e**

---

## Step 5 — Final Dashboard View (2 min)

### 5a. Switch to Dashboard mode (topbar toggle)

**Scroll down to the "Toplam Tahmini Emisyon" card.**

Expected final state:

| Kapsam | Kategori | Durum | Emisyon |
|--------|----------|-------|---------|
| Kapsam 1 | Sabit Yanma | ✅ Tamamlandı | **30.30 tCO₂e** |
| Kapsam 2 | Elektrik | ✅ Tamamlandı | **7.87 tCO₂e** |
| Kapsam 3 | Upstream Taşıma | ✅ Tamamlandı | **3.35 tCO₂e** |

```
Toplam Tahmini Emisyon          41.51 tCO₂e
                           Tüm kapsamlar
```

**Topbar:** `3/3 tamamlandı` with full green progress bar

**Sidebar:** all three dots green, individual tCO₂e values visible

### 5b. Prove state persistence across modes

Click **"AI"** → switch to chat mode → click **"Panel"** → switch back to dashboard.

> "Notice the data persists — switching between AI and Dashboard doesn't lose anything. The field values live in the database, not in memory."

---

## Talking Points by Stakeholder

### For the Sustainability Manager
- *"Every field is traceable — you can see whether data came from the AI, from manual entry, or from a file upload. Source and confidence are stored for each field."*
- *"The AI never saves anything automatically. Every extraction goes through a review step where you see exactly what it found and you approve it."*
- *"These emission factors are DEFRA 2023 for combustion, IEA 2023 for electricity, and GLEC Framework v3 for transport — all standard, auditable sources."*

### For the Technical Buyer
- *"The backend is Django REST — all business logic is server-side. The AI layer is Groq (llama-3.3-70b-versatile), and the suggestion flow is completely decoupled: the LLM creates a PendingSuggestion object; nothing writes to ReportField until the user explicitly confirms."*
- *"Adding a new emission category is a configuration change: add the field schema to `CATEGORY_SCHEMAS` in the backend and add a new panel component in the frontend."*

### For the CEO / Decision Maker
- *"This replaces the spreadsheet and the consultant's Excel template with a guided, AI-assisted data collection flow. The accuracy is the same — the time to collect is 80% less."*

---

## Known Limitations (Sprint 3 — be transparent)

| # | Limitation | Impact | Planned Fix |
|---|------------|--------|-------------|
| L1 | 4A AI suggestion only extracts `supplier` + `consumption_kwh`. Grid preset must be selected manually after confirm | Low — 2 extra clicks | Sprint 4: AI extracts EF from context |
| L2 | K4 AI extraction exists but transport mode confidence varies — demo uses dashboard flow for K4 | Low — dashboard flow is clean | Sprint 4: K4 AI prompt tuning |
| L3 | Language is hardcoded Turkish in Workspace (`const [lang] = useState('tr')`) | Low — Turkish-first audience | Post-K5: language toggle |
| L4 | Data entry panel only visible at ≥1280px (xl breakpoint) | Medium — laptop-only for now | Post-K5: responsive layout |
| L5 | No multi-facility support — one set of fields per report | Medium | Roadmap item |
| L6 | 3 categories (3A, 4A, K4) — not all ISO 14064-1 sources covered | Expected — MVP scope | K5+ sprints |
| L7 | `reporting_year` shows `None` in demo report title | Cosmetic | Fix: set during report creation |

---

## Quick Reference — Demo Commands

```bash
# Full reset (clean slate)
python -X utf8 demo_seed.py reset

# Seed all 3 categories (for showing a "filled" state)
python -X utf8 demo_seed.py seed

# Seed 3A only (best for live AI demo — 4A and K4 done live)
python -X utf8 demo_seed.py seed --partial

# Check current state
python -X utf8 demo_seed.py status
```

## Quick Reference — Exact Demo Values

| Flow | Input | Field | Stored Value | Display |
|------|-------|-------|-------------|---------|
| 3A AI | `15000 m³ doğalgaz` | rf.3a.fuel_type | `natural_gas` | Doğalgaz |
| 3A AI | `15000 m³ doğalgaz` | rf.3a.consumption | `15000` (int) | 15,000 |
| 3A AI | `15000 m³ doğalgaz` | rf.3a.unit | `m3` | m³ |
| 3A | DEFRA 2023 | emission | 30,300 kgCO₂e | **30.30 tCO₂e** |
| 4A AI | `TEDAŞ 18000 kWh` | rf.4a.supplier | `TEDAŞ` | TEDAŞ |
| 4A AI | `TEDAŞ 18000 kWh` | rf.4a.consumption_kwh | `18000` (int) | 18,000 kWh |
| 4A Manual | Grid: Türkiye | rf.4a.emission_factor | `0.437` | 0.437 |
| 4A Manual | Grid: Türkiye | rf.4a.emission_factor_source | `IEA 2023` | IEA 2023 |
| 4A | IEA 2023 Turkey | emission | 7,866 kgCO₂e | **7.87 tCO₂e** |
| K4 Panel | 45t · 1200km · HGV full | rf.k4.total_tkm | `54000` | 54,000 tkm |
| K4 Panel | GLEC v3 road_hgv_full | rf.k4.total_emission_kgco2e | `3348` | **3.35 tCO₂e** |
| **Total** | All scopes | — | 41,514 kgCO₂e | **41.51 tCO₂e** |

---

## If Something Goes Wrong

| Problem | Fix |
|---------|-----|
| AI reply is empty / 503 | GROQ_API_KEY not set or quota exceeded. Check `echo $GROQ_API_KEY`. Key starts with `gsk_` |
| SuggestionReviewCard doesn't appear | AI returned no extractable data. Re-send the exact Turkish phrase from this script |
| Panel doesn't auto-fill after confirm | Click the Panel tab — the `loadFields()` refresh fires asynchronously. Wait 1–2 seconds |
| Status stays "missing" after save | Check if shipments array is non-empty. Known: empty array = missing (fixed in this sprint) |
| 401 errors in browser network tab | Session expired. Log out and log back in |
| Backend 500 on chat endpoint | Groq rate limit or model unavailable. Wait 30 seconds and retry |
