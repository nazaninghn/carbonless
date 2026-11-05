// GENERATED from questions.js by scripts/generate-deferral-policy.mjs — do not edit by hand.
// The same data lives in carbonless_backend/questionnaire/deferral_policy.json (a test keeps them identical).
export default {
 "version": 1,
 "generated_from": "src/lib/carboniq/questions.js",
 "questions": {
  "A1": {
   "n": 1,
   "stage": 1,
   "type": "text",
   "text": "What is the full legal name of your company?",
   "iso": "ISO 14064-1 §7.5",
   "req": true,
   "next": "A2",
   "kind": "required",
   "code": "identity",
   "reason": "Legal name of the reporting organization: identifies the inventory in every report and in Company Profile reuse."
  },
  "A2": {
   "n": 2,
   "stage": 1,
   "type": "text",
   "text": "What is your tax identification number?",
   "iso": "ISO 14064-1 §7.5",
   "req": true,
   "next": "A3",
   "kind": "deferrable",
   "code": "deferrable",
   "reason": "Tax identification number: identifies the company, changes neither the route nor any calculation."
  },
  "A3": {
   "n": 3,
   "stage": 1,
   "type": "country_city",
   "text": "In which country and city is your company registered?",
   "iso": "ISO 14064-1 §5.1",
   "req": true,
   "next": "A4",
   "kind": "required",
   "code": "calc_prerequisite",
   "reason": "Country and city select the default national grid and regional factors the rest of the questionnaire uses."
  },
  "A4": {
   "n": 4,
   "stage": 1,
   "type": "year_select",
   "text": "Which reporting year are we preparing this report for?",
   "iso": "ISO 14064-1 §7.5",
   "req": true,
   "next": "A5",
   "kind": "required",
   "code": "identity",
   "reason": "Reporting year: sets the factor year and every year-scoped record of the inventory."
  },
  "A5": {
   "n": 5,
   "stage": 1,
   "type": "text",
   "text": "Who is preparing this report? (name and/or department)",
   "iso": "ISO 14064-1 §7.5",
   "req": true,
   "next": "A6",
   "kind": "deferrable",
   "code": "deferrable",
   "reason": "Name of the preparer: documentation only."
  },
  "A6": {
   "n": 6,
   "stage": 1,
   "type": "multi_select",
   "text": "What is the intended use of this report?",
   "iso": "ISO 14064-1 §7.5",
   "req": false,
   "next": "A7",
   "exclusive": [
    "skip"
   ],
   "kind": "deferrable",
   "code": "deferrable",
   "reason": "Intended use of the report: documentation only."
  },
  "A7": {
   "n": 7,
   "stage": 1,
   "type": "single_select",
   "text": "Have you prepared a carbon report before?",
   "iso": "ISO 14064-1 §7.5",
   "req": false,
   "nbv": {
    "yes": "A7a",
    "no": "A7b",
    "skip": "A7b"
   },
   "exclusive": [
    "skip"
   ],
   "kind": "required",
   "code": "gate",
   "reason": "Its answer chooses the next question (yes / no / skip); without it the route is a guess."
  },
  "A7a": {
   "n": "7a",
   "stage": 1,
   "type": "year_select",
   "text": "What is your baseline year?",
   "iso": "ISO 14064-1 §7.5",
   "req": false,
   "creq": {
    "questionId": "A7",
    "equals": "yes"
   },
   "next": "A7b",
   "kind": "conditional",
   "code": "deferrable",
   "reason": "Data input or documentation: its answer changes neither the route, the boundary nor the method; it can be supplied later.",
   "then": "deferrable"
  },
  "A7b": {
   "n": 8,
   "stage": 1,
   "type": "compound",
   "text": "Complete the organization details that appear in your report.",
   "iso": "ISO 14064-1 §9.3.1",
   "req": false,
   "next": "B1",
   "kind": "deferrable",
   "code": "deferrable",
   "reason": "Organization details printed in the report: documentation only."
  },
  "B1": {
   "n": 9,
   "stage": 1,
   "type": "single_select",
   "text": "What is the primary sector of your company?",
   "iso": "ISO 14064-1 §5.1",
   "req": true,
   "next": "B2",
   "kind": "required",
   "code": "structure",
   "reason": "Sector decides whether the process-emission (3C-0) and sold-product-processing (K3C10-0) questions apply."
  },
  "B2": {
   "n": 10,
   "stage": 1,
   "type": "text",
   "text": "Briefly describe your company's main business activity.",
   "iso": "ISO 14064-1 §5.1",
   "req": true,
   "next": "B3",
   "kind": "deferrable",
   "code": "deferrable",
   "reason": "Description of the main activity: documentation only."
  },
  "B3": {
   "n": 11,
   "stage": 1,
   "type": "single_select",
   "text": "What is your total number of employees?",
   "iso": "ISO 14064-1 §5.1",
   "req": true,
   "next": "B4",
   "kind": "deferrable",
   "code": "deferrable",
   "reason": "Employee band: used for the sector-benchmark band and a plausibility warning against the commuting headcounts (K3C7-1); not an input of any emission calculation."
  },
  "B4": {
   "n": 12,
   "stage": 1,
   "type": "text",
   "text": "How many physical locations does your company operate from?",
   "iso": "ISO 14064-1 §5.1",
   "req": true,
   "next": "B5",
   "kind": "deferrable",
   "code": "deferrable",
   "reason": "Number of locations: a reference for the facility count, which 2A-1 asks itself."
  },
  "B5": {
   "n": 13,
   "stage": 1,
   "type": "multi_select",
   "text": "What types of locations does your company operate?",
   "iso": "ISO 14064-1 §5.1",
   "req": true,
   "next": "B6",
   "kind": "deferrable",
   "code": "deferrable",
   "reason": "Location types: documentation only."
  },
  "B6": {
   "n": 14,
   "stage": 1,
   "type": "single_select",
   "text": "What is your approximate annual revenue range? (Optional)",
   "iso": "ISO 14064-1 §5.1",
   "req": false,
   "next": "C1",
   "exclusive": [
    "skip"
   ],
   "kind": "deferrable",
   "code": "deferrable",
   "reason": "Revenue band (optional)."
  },
  "C1": {
   "n": 15,
   "stage": 1,
   "type": "single_select",
   "text": "Does your company have any subsidiaries or affiliates?",
   "iso": "ISO 14064-1 §5.1",
   "req": true,
   "next": "C2",
   "kind": "required",
   "code": "structure",
   "reason": "Subsidiaries decide whether the subsidiary boundary questions (2A-4) apply."
  },
  "C2": {
   "n": 16,
   "stage": 1,
   "type": "single_select",
   "text": "Does your company have any international operations?",
   "iso": "ISO 14064-1 §5.1",
   "req": true,
   "next": "C3",
   "kind": "required",
   "code": "structure",
   "reason": "International operations drive the overseas-site advisor check on later site answers."
  },
  "C3": {
   "n": 17,
   "stage": 1,
   "type": "single_select",
   "text": "Does your company have any franchise agreements or joint ventures?",
   "iso": "ISO 14064-1 §5.1",
   "req": true,
   "next": "D1",
   "kind": "required",
   "code": "structure",
   "reason": "Franchise / joint venture decides whether Scope 3 category 14 (K3C14-0) applies."
  },
  "D1": {
   "n": 18,
   "stage": 1,
   "type": "single_select",
   "text": "Which emission factor database would you like to use?",
   "iso": "ISO 14064-1 §6.1",
   "req": true,
   "next": "D2",
   "kind": "required",
   "code": "methodology",
   "reason": "Emission factor database: selects the factor source used by every calculation."
  },
  "D2": {
   "n": 19,
   "stage": 1,
   "type": "info",
   "text": "Information about Scope 2 calculation methodology",
   "iso": "ISO 14064-1 §6.2",
   "req": false,
   "next": "D3",
   "kind": "info",
   "code": "info",
   "reason": "Information screen: not a question."
  },
  "D3": {
   "n": 20,
   "stage": 1,
   "type": "single_select",
   "text": "Which organizational boundary approach will you use?",
   "iso": "ISO 14064-1 §5.1",
   "req": true,
   "next": "D4",
   "kind": "required",
   "code": "boundary",
   "reason": "Consolidation approach: decides which boundary questions follow and how facilities are included."
  },
  "D4": {
   "n": 21,
   "stage": 1,
   "type": "single_select",
   "text": "How would you like to determine the scope of your Scope 3 reporting?",
   "iso": "ISO 14064-1 §6.1",
   "req": true,
   "next": "2A-0",
   "kind": "required",
   "code": "methodology",
   "reason": "Scope 3 reporting approach: decides the Scope 3 route."
  },
  "2A-0": {
   "n": 22,
   "stage": 2,
   "type": "info",
   "text": "Stage 2: Organizational Boundary",
   "iso": "ISO 14064-1 §5.1",
   "req": false,
   "next": "2A-1",
   "kind": "info",
   "code": "info",
   "reason": "Information screen: not a question."
  },
  "2A-1": {
   "n": 23,
   "stage": 2,
   "type": "text",
   "text": "How many physical facilities do you have? (auto-filled from B4)",
   "iso": "ISO 14064-1 §5.1",
   "req": true,
   "next": "2A-2",
   "loopNext": "2A-2",
   "kind": "required",
   "code": "loop_source",
   "reason": "Number of facilities: the facility loop (2A-2, 2A-3, 4A-1) is asked once per facility."
  },
  "2A-2": {
   "n": 24,
   "stage": 2,
   "type": "compound",
   "text": "[Facility N] What is the name and country of this facility?",
   "iso": "ISO 14064-1 §5.1",
   "req": true,
   "next": "2A-3",
   "loopNext": "2A-3",
   "loop": true,
   "kind": "required",
   "code": "loop_item",
   "reason": "Answered item by item for the items its loop source defined (2A-1); not deferrable one by one.",
   "ls": "2A-1"
  },
  "2A-3": {
   "n": 25,
   "stage": 2,
   "type": "text",
   "text": "[Facility N] What type of activity does this facility carry out?",
   "iso": "ISO 14064-1 §5.1",
   "req": true,
   "next": "2A-4",
   "loopNext": "2A-4",
   "loop": true,
   "kind": "required",
   "code": "loop_item",
   "reason": "Answered item by item for the items its loop source defined (2A-1); not deferrable one by one.",
   "ls": "2A-1"
  },
  "2A-4": {
   "n": 26,
   "stage": 2,
   "type": "compound",
   "text": "What is the name and country of your subsidiary or affiliate?",
   "iso": "ISO 14064-1 §5.1",
   "req": false,
   "next": "2A-5",
   "show": {
    "questionId": "C1",
    "includesValue": "yes"
   },
   "kind": "conditional",
   "code": "boundary",
   "reason": "Subsidiary / affiliate entities: part of the organizational boundary.",
   "then": "required"
  },
  "2A-5": {
   "n": 27,
   "stage": 2,
   "type": "text",
   "text": "What is your equity share in this subsidiary? (%)",
   "iso": "ISO 14064-1 §5.1",
   "req": false,
   "next": "2B-OC1",
   "show": {
    "questionId": "D3",
    "includesValue": "equity_share"
   },
   "kind": "conditional",
   "code": "boundary",
   "reason": "Equity share in the subsidiary: decides how much of it is included (equity-share approach).",
   "then": "required"
  },
  "2B-OC1": {
   "n": 28,
   "stage": 2,
   "type": "single_select",
   "text": "Do you set the operational policies at your facilities?",
   "iso": "ISO 14064-1 §5.1",
   "req": true,
   "next": "2B-OC2",
   "nbv": {
    "yes": "2B-OC2",
    "no": "2B-OC1a"
   },
   "show": {
    "questionId": "D3",
    "includesValue": "operational_control"
   },
   "kind": "conditional",
   "code": "gate",
   "reason": "Its answer chooses the next question (yes / no); without it the route is a guess.",
   "then": "required"
  },
  "2B-OC1a": {
   "n": "28a",
   "stage": 2,
   "type": "compound",
   "text": "At which facilities do you not set the operating policies?",
   "iso": "ISO 14064-1 §5.1",
   "req": true,
   "next": "2B-FC1",
   "kind": "conditional",
   "code": "boundary",
   "reason": "Facilities outside operational control: excluded from the boundary.",
   "then": "required"
  },
  "2B-OC2": {
   "n": 29,
   "stage": 2,
   "type": "single_select",
   "text": "Who manages the day-to-day operations at your facilities?",
   "iso": "ISO 14064-1 §5.1",
   "req": true,
   "next": "2B-FC1",
   "show": {
    "questionId": "2B-OC1",
    "includesValue": "yes"
   },
   "kind": "conditional",
   "code": "boundary",
   "reason": "Who manages day-to-day operations: operational-control test.",
   "then": "required"
  },
  "2B-FC1": {
   "n": 30,
   "stage": 2,
   "type": "single_select",
   "text": "Are your facilities included in your consolidated financial statements?",
   "iso": "ISO 14064-1 §5.1",
   "req": true,
   "next": "2B-FC2",
   "nbv": {
    "yes": "2B-FC2",
    "no": "2B-EQ1"
   },
   "show": {
    "questionId": "D3",
    "includesValue": "financial_control"
   },
   "kind": "conditional",
   "code": "gate",
   "reason": "Its answer chooses the next question (yes / no); without it the route is a guess.",
   "then": "required"
  },
  "2B-FC2": {
   "n": 31,
   "stage": 2,
   "type": "single_select",
   "text": "Do you have the authority to set financial and operating policies at your facilities?",
   "iso": "ISO 14064-1 §5.1",
   "req": true,
   "next": "2B-EQ1",
   "show": {
    "questionId": "2B-FC1",
    "includesValue": "yes"
   },
   "kind": "conditional",
   "code": "boundary",
   "reason": "Authority over financial and operating policies: financial-control test.",
   "then": "required"
  },
  "2B-EQ1": {
   "n": 32,
   "stage": 2,
   "type": "text",
   "text": "[Each asset] Your equity share in this asset (auto-filled from 2A-5)",
   "iso": "ISO 14064-1 §5.1",
   "req": false,
   "next": "2C-1",
   "show": {
    "questionId": "D3",
    "includesValue": "equity_share"
   },
   "kind": "conditional",
   "code": "boundary",
   "reason": "Equity share per asset: decides the included share (equity-share approach).",
   "then": "required"
  },
  "2C-1": {
   "n": 33,
   "stage": 2,
   "type": "single_select",
   "text": "Why are you leaving these facilities out of the inventory boundary?",
   "iso": "ISO 14064-1 §5.1",
   "req": false,
   "next": "2C-2",
   "show": {
    "questionId": "2B-OC1",
    "equals": "no"
   },
   "kind": "conditional",
   "code": "deferrable",
   "reason": "Data input or documentation: its answer changes neither the route, the boundary nor the method; it can be supplied later.",
   "then": "deferrable"
  },
  "2C-2": {
   "n": 34,
   "stage": 2,
   "type": "single_select",
   "text": "What is the estimated emission size of these facilities?",
   "iso": "ISO 14064-1 §5.1",
   "req": false,
   "next": "2C-3",
   "show": {
    "questionId": "2B-OC1",
    "equals": "no"
   },
   "kind": "conditional",
   "code": "deferrable",
   "reason": "Data input or documentation: its answer changes neither the route, the boundary nor the method; it can be supplied later.",
   "then": "deferrable"
  },
  "2C-3": {
   "n": 35,
   "stage": 2,
   "type": "single_select",
   "text": "Do you plan to include these facilities in future reports?",
   "iso": "ISO 14064-1 §5.1",
   "req": false,
   "next": "SCOPE-GROUPING",
   "show": {
    "questionId": "2B-OC1",
    "equals": "no"
   },
   "kind": "conditional",
   "code": "deferrable",
   "reason": "Data input or documentation: its answer changes neither the route, the boundary nor the method; it can be supplied later.",
   "then": "deferrable"
  },
  "SCOPE-GROUPING": {
   "n": 36,
   "stage": 2,
   "type": "single_select",
   "text": "How would you like to answer the Scope 1 and Scope 2 questions?",
   "iso": "ISO 14064-1 §5.2",
   "req": true,
   "next": "3-GİRİŞ",
   "kind": "required",
   "code": "structure",
   "reason": "Decides whether Scope 1 and 2 are answered as one flow or Scope 2 starts its own section; unanswered it was silently treated as \"together\"."
  },
  "3-GİRİŞ": {
   "n": 37,
   "stage": 3,
   "type": "info",
   "text": "Scope 1 Introduction — Let's identify your direct emission sources.",
   "iso": "ISO 14064-1 §5.2",
   "req": false,
   "next": "3A-0",
   "kind": "info",
   "code": "info",
   "reason": "Information screen: not a question."
  },
  "3A-0": {
   "n": 38,
   "stage": 3,
   "type": "single_select",
   "text": "Do you have any stationary combustion equipment?",
   "iso": "ISO 14064-1 §5.2",
   "req": true,
   "next": "3B-0",
   "nbv": {
    "yes": "3A-1",
    "no": "3B-0"
   },
   "kind": "required",
   "code": "gate",
   "reason": "Its answer chooses the next question (yes / no); without it the route is a guess."
  },
  "3A-1": {
   "n": 39,
   "stage": 3,
   "type": "multi_select",
   "text": "Which stationary combustion equipment do you have?",
   "iso": "ISO 14064-1 §5.2",
   "req": true,
   "next": "3A-1a",
   "loopNext": "3A-2",
   "kind": "conditional",
   "code": "loop_source",
   "reason": "Stationary combustion equipment: the equipment loop is asked per item.",
   "then": "required"
  },
  "3A-1a": {
   "n": 40,
   "stage": 3,
   "type": "text",
   "text": "[EQ-3A-99] What is the equipment name and fuel type?",
   "iso": "ISO 14064-1 §5.2",
   "req": false,
   "next": "3A-2",
   "show": {
    "questionId": "3A-1",
    "includesValue": "EQ-3A-99"
   },
   "kind": "conditional",
   "code": "loop_source",
   "reason": "Name and fuel of equipment that is not in the list: needed before its loop items can be asked.",
   "then": "required"
  },
  "3A-2": {
   "n": 41,
   "stage": 3,
   "type": "compound",
   "text": "[Equipment name] — How many units and at which site?",
   "iso": "ISO 14064-1 §5.2",
   "req": true,
   "next": "3A-2b",
   "loopNext": "3A-2b",
   "loop": true,
   "kind": "conditional",
   "code": "loop_item",
   "reason": "Answered item by item for the items its loop source defined (3A-1); not deferrable one by one.",
   "then": "required",
   "ls": "3A-1"
  },
  "3A-2b": {
   "n": "41b",
   "stage": 3,
   "type": "single_select",
   "text": "[Equipment name] — Do you have operational control over the facility where this equipment is located?",
   "iso": "ISO 14064-1 §5.2",
   "req": true,
   "next": "3A-3",
   "loopNext": "3A-3",
   "loop": true,
   "kind": "conditional",
   "code": "loop_item",
   "reason": "Answered item by item for the items its loop source defined (3A-1); not deferrable one by one.",
   "then": "required",
   "ls": "3A-1"
  },
  "3A-3": {
   "n": 42,
   "stage": 3,
   "type": "equipment_loop",
   "text": "[Equipment name] — What is the technical capacity?",
   "iso": "ISO 14064-1 §5.2",
   "req": false,
   "next": "3A-4",
   "loopNext": "3A-4",
   "loop": true,
   "kind": "conditional",
   "code": "loop_item",
   "reason": "Answered item by item for the items its loop source defined (3A-1); not deferrable one by one.",
   "then": "required",
   "ls": "3A-1"
  },
  "3A-4": {
   "n": 43,
   "stage": 3,
   "type": "multi_select",
   "text": "[Equipment name] — What fuel types does this equipment use?",
   "iso": "ISO 14064-1 §5.2",
   "req": true,
   "next": "3A-5",
   "loopNext": "3A-5",
   "loop": true,
   "kind": "conditional",
   "code": "loop_item",
   "reason": "Answered item by item for the items its loop source defined (3A-1); not deferrable one by one.",
   "then": "required",
   "ls": "3A-1"
  },
  "3A-5": {
   "n": 44,
   "stage": 3,
   "type": "fuel_loop",
   "text": "[Equipment] — [Fuel type] — What was the total consumption in the reporting year?",
   "iso": "ISO 14064-1 §5.2",
   "req": true,
   "next": "3A-5bio",
   "loopNext": "3A-5bio",
   "loop": true,
   "kind": "conditional",
   "code": "loop_item",
   "reason": "Answered item by item for the items its loop source defined (3A-4); not deferrable one by one.",
   "then": "required",
   "ls": "3A-4"
  },
  "3A-5bio": {
   "n": "44a",
   "stage": 3,
   "type": "single_select",
   "text": "Which biomass do you burn?",
   "iso": "ISO 14064-1 §5.2",
   "req": true,
   "next": "3A-6",
   "show": {
    "questionId": "3A-5",
    "hasKey": "biomass"
   },
   "kind": "conditional",
   "code": "methodology",
   "reason": "Which biomass is burned: selects the factor and the biogenic treatment.",
   "then": "required"
  },
  "3A-6": {
   "n": 45,
   "stage": 3,
   "type": "single_select",
   "text": "[Fuel type] — How was this consumption data obtained?",
   "iso": "ISO 14064-1 §5.2",
   "req": true,
   "next": "3A-6a",
   "loopNext": "3A-6a",
   "loop": true,
   "kind": "conditional",
   "code": "loop_item",
   "reason": "Answered item by item for the items its loop source defined (3A-4); not deferrable one by one.",
   "then": "required",
   "ls": "3A-4"
  },
  "3A-6a": {
   "n": 46,
   "stage": 3,
   "type": "text",
   "text": "[If estimated] What estimation method and source was used?",
   "iso": "ISO 14064-1 §5.2",
   "req": true,
   "next": "3A-EF",
   "show": {
    "questionId": "3A-6",
    "inValues": [
     "engineering_estimate",
     "sector_average"
    ]
   },
   "kind": "conditional",
   "code": "methodology",
   "reason": "Estimation method and source for estimated consumption: the data-quality basis recorded for the ISO report.",
   "then": "required"
  },
  "3A-EF": {
   "n": 47,
   "stage": 3,
   "type": "single_select",
   "text": "Do you have a supplier emission factor document for your fuels?",
   "iso": "ISO 14064-1 §5.2",
   "req": true,
   "next": "3B-0",
   "nbv": {
    "yes": "3A-EF-a",
    "no": "3B-0"
   },
   "kind": "conditional",
   "code": "gate",
   "reason": "Its answer chooses the next question (yes / no); without it the route is a guess.",
   "then": "required"
  },
  "3A-EF-a": {
   "n": "47a",
   "stage": 3,
   "type": "compound",
   "text": "Enter supplier emission factor document details",
   "iso": "ISO 14064-1 §5.2",
   "req": true,
   "next": "3B-0",
   "show": {
    "questionId": "3A-EF",
    "equals": "yes"
   },
   "kind": "conditional",
   "code": "deferrable",
   "reason": "Data input or documentation: its answer changes neither the route, the boundary nor the method; it can be supplied later.",
   "then": "deferrable"
  },
  "3B-0": {
   "n": 48,
   "stage": 3,
   "type": "single_select",
   "text": "Does your company own or control any vehicles, machinery or vessels?",
   "iso": "ISO 14064-1 §5.2",
   "req": true,
   "nbv": {
    "yes": "3B-1",
    "no": "3C-0"
   },
   "kind": "required",
   "code": "gate",
   "reason": "Its answer chooses the next question (yes / no); without it the route is a guess."
  },
  "3B-1": {
   "n": 49,
   "stage": 3,
   "type": "multi_select",
   "text": "What types of vehicles does your company have?",
   "iso": "ISO 14064-1 §5.2",
   "req": true,
   "next": "3B-2",
   "loopNext": "3B-2",
   "kind": "conditional",
   "code": "loop_source",
   "reason": "Vehicle types: the vehicle loop is asked per type.",
   "then": "required"
  },
  "3B-2": {
   "n": 50,
   "stage": 3,
   "type": "single_select",
   "text": "[Vehicle type] — What is the ownership status?",
   "iso": "ISO 14064-1 §5.2",
   "req": true,
   "next": "3B-3",
   "loopNext": "3B-3",
   "loop": true,
   "kind": "conditional",
   "code": "loop_item",
   "reason": "Answered item by item for the items its loop source defined (3B-1); not deferrable one by one.",
   "then": "required",
   "ls": "3B-1"
  },
  "3B-3": {
   "n": 51,
   "stage": 3,
   "type": "compound",
   "text": "[Vehicle type] — How many units, at which site, and what size/tonnage band?",
   "iso": "ISO 14064-1 §5.2",
   "req": true,
   "next": "3B-4",
   "loopNext": "3B-4",
   "loop": true,
   "kind": "conditional",
   "code": "loop_item",
   "reason": "Answered item by item for the items its loop source defined (3B-1); not deferrable one by one.",
   "then": "required",
   "ls": "3B-1"
  },
  "3B-4": {
   "n": 52,
   "stage": 3,
   "type": "single_select",
   "text": "[Vehicle type] — What is the model year or Euro emission standard?",
   "iso": "ISO 14064-1 §5.2",
   "req": false,
   "next": "3B-5",
   "loopNext": "3B-5",
   "loop": true,
   "kind": "conditional",
   "code": "loop_item",
   "reason": "Answered item by item for the items its loop source defined (3B-1); not deferrable one by one.",
   "then": "required",
   "ls": "3B-1"
  },
  "3B-5": {
   "n": 53,
   "stage": 3,
   "type": "single_select",
   "text": "[Vehicle type] — What fuel type does this vehicle use?",
   "iso": "ISO 14064-1 §5.2",
   "req": true,
   "next": "3B-6",
   "loopNext": "3B-6",
   "loop": true,
   "kind": "conditional",
   "code": "loop_item",
   "reason": "Answered item by item for the items its loop source defined (3B-1); not deferrable one by one.",
   "then": "required",
   "ls": "3B-1"
  },
  "3B-6": {
   "n": 54,
   "stage": 3,
   "type": "single_select",
   "text": "[Vehicle type] — Activity data: fuel consumption or distance?",
   "iso": "ISO 14064-1 §5.2",
   "req": true,
   "next": "3B-7",
   "loopNext": "3B-7",
   "loop": true,
   "kind": "conditional",
   "code": "loop_item",
   "reason": "Answered item by item for the items its loop source defined (3B-1); not deferrable one by one.",
   "then": "required",
   "ls": "3B-1"
  },
  "3B-7": {
   "n": "54a",
   "stage": 3,
   "type": "equipment_loop",
   "text": "[Vehicle type] — What is the total amount for the reporting year?",
   "iso": "ISO 14064-1 §5.2",
   "req": true,
   "next": "3B-EF",
   "loopNext": "3B-EF",
   "loop": true,
   "kind": "conditional",
   "code": "loop_item",
   "reason": "Answered item by item for the items its loop source defined (3B-1); not deferrable one by one.",
   "then": "required",
   "ls": "3B-1"
  },
  "3B-EF": {
   "n": 55,
   "stage": 3,
   "type": "single_select",
   "text": "Do you have a supplier or manufacturer emission factor document for your vehicles?",
   "iso": "ISO 14064-1 §5.2",
   "req": true,
   "next": "3C-0",
   "nbv": {
    "yes": "3B-EF-a",
    "no": "3C-0"
   },
   "kind": "conditional",
   "code": "gate",
   "reason": "Its answer chooses the next question (yes / no); without it the route is a guess.",
   "then": "required"
  },
  "3B-EF-a": {
   "n": "55a",
   "stage": 3,
   "type": "compound",
   "text": "Enter vehicle emission factor document details",
   "iso": "ISO 14064-1 §5.2",
   "req": true,
   "next": "3C-0",
   "show": {
    "questionId": "3B-EF",
    "equals": "yes"
   },
   "kind": "conditional",
   "code": "deferrable",
   "reason": "Data input or documentation: its answer changes neither the route, the boundary nor the method; it can be supplied later.",
   "then": "deferrable"
  },
  "3C-0": {
   "n": 56,
   "stage": 3,
   "type": "single_select",
   "text": "Do you have any non-combustion industrial process emissions?",
   "iso": "ISO 14064-1 §5.2",
   "req": false,
   "next": "3D-0",
   "nbv": {
    "yes": "3C-1",
    "no": "3D-0"
   },
   "show": {
    "questionId": "B1",
    "inValues": [
     "NACE_A",
     "NACE_B",
     "NACE_C",
     "NACE_D",
     "NACE_E",
     "NACE_F"
    ]
   },
   "kind": "conditional",
   "code": "gate",
   "reason": "Its answer chooses the next question (yes / no); without it the route is a guess.",
   "then": "required"
  },
  "3C-1": {
   "n": 57,
   "stage": 3,
   "type": "multi_select",
   "text": "Which process equipment do you operate?",
   "iso": "ISO 14064-1 §5.2",
   "req": true,
   "next": "3C-2",
   "loopNext": "3C-2",
   "kind": "conditional",
   "code": "loop_source",
   "reason": "Process equipment: the process loop is asked per item.",
   "then": "required"
  },
  "3C-2": {
   "n": 58,
   "stage": 3,
   "type": "compound",
   "text": "[Process name] — What is the production quantity and measurement method?",
   "iso": "ISO 14064-1 §5.2",
   "req": true,
   "next": "3C-EF",
   "loopNext": "3C-EF",
   "loop": true,
   "kind": "conditional",
   "code": "loop_item",
   "reason": "Answered item by item for the items its loop source defined (3C-1); not deferrable one by one.",
   "then": "required",
   "ls": "3C-1"
  },
  "3C-EF": {
   "n": 59,
   "stage": 3,
   "type": "single_select",
   "text": "Do you have a facility-specific emission factor for your processes?",
   "iso": "ISO 14064-1 §5.2",
   "req": true,
   "next": "3D-0",
   "nbv": {
    "yes": "3C-EF-a",
    "no": "3D-0"
   },
   "kind": "conditional",
   "code": "gate",
   "reason": "Its answer chooses the next question (yes / no); without it the route is a guess.",
   "then": "required"
  },
  "3C-EF-a": {
   "n": "59a",
   "stage": 3,
   "type": "compound",
   "text": "Enter facility-specific emission factor details",
   "iso": "ISO 14064-1 §5.2",
   "req": true,
   "next": "3D-0",
   "show": {
    "questionId": "3C-EF",
    "equals": "yes"
   },
   "kind": "conditional",
   "code": "deferrable",
   "reason": "Data input or documentation: its answer changes neither the route, the boundary nor the method; it can be supplied later.",
   "then": "deferrable"
  },
  "3D-0": {
   "n": 60,
   "stage": 3,
   "type": "multi_select",
   "text": "Which fugitive emission sources do you have?",
   "iso": "ISO 14064-1 §5.2",
   "req": true,
   "next": "3D-2",
   "loopNext": "3D-2",
   "exclusive": [
    "none"
   ],
   "kind": "required",
   "code": "loop_source",
   "reason": "Fugitive sources: the refrigerant loop is asked per source."
  },
  "3D-2": {
   "n": 61,
   "stage": 3,
   "type": "compound",
   "text": "[Equipment] — How many units, at which site, and which refrigerant/gas?",
   "iso": "ISO 14064-1 §5.2",
   "req": true,
   "next": "3D-4",
   "loopNext": "3D-4",
   "loop": true,
   "kind": "required",
   "code": "loop_item",
   "reason": "Answered item by item for the items its loop source defined (3D-0); not deferrable one by one.",
   "ls": "3D-0"
  },
  "3D-4": {
   "n": 62,
   "stage": 3,
   "type": "compound",
   "text": "[Equipment] — What is the annual refill quantity and system capacity?",
   "iso": "ISO 14064-1 §5.2",
   "req": true,
   "next": "3D-4-zero-decision",
   "loopNext": "3D-4-zero-decision",
   "loop": true,
   "kind": "required",
   "code": "loop_item",
   "reason": "Answered item by item for the items its loop source defined (3D-0); not deferrable one by one.",
   "ls": "3D-0"
  },
  "3D-4-zero-decision": {
   "n": "62a",
   "stage": 3,
   "type": "single_select",
   "text": "Annual refill was entered as 0 for some equipment. How should leakage emissions be calculated for those sources?",
   "iso": "ISO 14064-1 §5.2",
   "req": true,
   "next": "3D-EF",
   "show": {
    "questionId": "3D-4",
    "field": "refill_kg",
    "equals": 0
   },
   "kind": "conditional",
   "code": "methodology",
   "reason": "How a zero refill is treated in the leakage calculation.",
   "then": "required"
  },
  "3D-EF": {
   "n": 63,
   "stage": 3,
   "type": "single_select",
   "text": "GWP reference: Do you approve IPCC AR6 (2021)?",
   "iso": "ISO 14064-1 §5.2",
   "req": true,
   "next": "TY-1",
   "loopNext": "TY-1",
   "loop": true,
   "kind": "required",
   "code": "loop_item",
   "reason": "Answered item by item for the items its loop source defined (3D-0); not deferrable one by one.",
   "ls": "3D-0"
  },
  "TY-1": {
   "n": 64,
   "stage": 3,
   "type": "single_select",
   "text": "Scope 1 summary: Are the identified sources and quantities correct?",
   "iso": "ISO 14064-1 §5.2",
   "req": true,
   "nbv": {
    "confirmed": "4-GİRİŞ",
    "edit": "TY-edit",
    "add_source": "TY-2"
   },
   "kind": "required",
   "code": "gate",
   "reason": "Its answer chooses the next question (confirmed / edit / add_source); without it the route is a guess."
  },
  "TY-edit": {
   "n": "63b",
   "stage": 3,
   "type": "section_picker",
   "text": "Which Scope 1 section would you like to edit?",
   "iso": "ISO 14064-1 §5.2",
   "req": true,
   "nbv": {
    "3A-0": "3A-0",
    "3B-0": "3B-0",
    "3C-0": "3C-0",
    "3D-0": "3D-0"
   },
   "kind": "info",
   "code": "navigation",
   "reason": "Section picker: navigation back into a section, not an answer."
  },
  "TY-2": {
   "n": 65,
   "stage": 3,
   "type": "text",
   "text": "Describe the missed emission source.",
   "iso": "ISO 14064-1 §5.2",
   "req": false,
   "next": "4-GİRİŞ",
   "show": {
    "questionId": "TY-1",
    "equals": "add_source"
   },
   "kind": "conditional",
   "code": "deferrable",
   "reason": "Data input or documentation: its answer changes neither the route, the boundary nor the method; it can be supplied later.",
   "then": "deferrable"
  },
  "4-GİRİŞ": {
   "n": 66,
   "stage": 4,
   "type": "info",
   "text": "Scope 2 Introduction — Let's calculate the emissions from your purchased energy.",
   "iso": "ISO 14064-1 §5.3",
   "req": false,
   "next": "4A-0",
   "kind": "info",
   "code": "info",
   "reason": "Information screen: not a question."
  },
  "4A-0": {
   "n": 67,
   "stage": 4,
   "type": "single_select",
   "text": "Do you purchase electricity from the grid?",
   "iso": "ISO 14064-1 §5.3",
   "req": true,
   "nbv": {
    "yes": "4A-1",
    "no": "4A-EV"
   },
   "kind": "required",
   "code": "gate",
   "reason": "Its answer chooses the next question (yes / no); without it the route is a guess."
  },
  "4A-1": {
   "n": 68,
   "stage": 4,
   "type": "text",
   "text": "[Site name] — What is the annual electricity consumption?",
   "iso": "ISO 14064-1 §5.3",
   "req": true,
   "next": "4A-2",
   "loopNext": "4A-1a",
   "loop": true,
   "kind": "conditional",
   "code": "loop_item",
   "reason": "Answered item by item for the items its loop source defined (2A-1); not deferrable one by one.",
   "then": "required",
   "ls": "2A-1"
  },
  "4A-1a": {
   "n": 69,
   "stage": 4,
   "type": "text",
   "text": "[If invoice amount entered] What is the unit electricity price? (Optional)",
   "iso": "ISO 14064-1 §5.3",
   "req": false,
   "next": "4A-2",
   "show": {
    "questionId": "4A-1",
    "unitIn": [
     "TL"
    ]
   },
   "kind": "conditional",
   "code": "deferrable",
   "reason": "Data input or documentation: its answer changes neither the route, the boundary nor the method; it can be supplied later.",
   "then": "deferrable"
  },
  "4A-2": {
   "n": 70,
   "stage": 4,
   "type": "single_select",
   "text": "Are any of your sites in a shared or rented building?",
   "iso": "ISO 14064-1 §5.3",
   "req": true,
   "nbv": {
    "no": "4A-3",
    "yes": "4A-2s"
   },
   "kind": "conditional",
   "code": "gate",
   "reason": "Its answer chooses the next question (no / yes); without it the route is a guess.",
   "then": "required"
  },
  "4A-2s": {
   "n": "70a",
   "stage": 4,
   "type": "compound",
   "text": "Which facilities are in a shared or leased building?",
   "iso": "ISO 14064-1 §5.3",
   "req": true,
   "next": "4A-2a",
   "show": {
    "questionId": "4A-2",
    "equals": "yes"
   },
   "kind": "conditional",
   "code": "structure",
   "reason": "Facilities in shared or leased buildings: defines the allocation sub-flow (4A-2a, 4A-2b, 4A-2c).",
   "then": "required"
  },
  "4A-2a": {
   "n": 71,
   "stage": 4,
   "type": "single_select",
   "text": "[Shared building] Can you obtain a consumption allocation document from building management?",
   "iso": "ISO 14064-1 §5.3",
   "req": true,
   "next": "4A-3",
   "nbv": {
    "yes": "4A-2b",
    "no": "4A-2c"
   },
   "show": {
    "questionId": "4A-2",
    "equals": "yes"
   },
   "kind": "conditional",
   "code": "gate",
   "reason": "Its answer chooses the next question (yes / no); without it the route is a guess.",
   "then": "required"
  },
  "4A-2b": {
   "n": 72,
   "stage": 4,
   "type": "text",
   "text": "What annual consumption share (kWh) has building management declared for you?",
   "iso": "ISO 14064-1 §5.3",
   "req": true,
   "next": "4A-3",
   "show": {
    "questionId": "4A-2a",
    "equals": "yes"
   },
   "kind": "conditional",
   "code": "deferrable",
   "reason": "Data input or documentation: its answer changes neither the route, the boundary nor the method; it can be supplied later.",
   "then": "deferrable"
  },
  "4A-2c": {
   "n": 73,
   "stage": 4,
   "type": "compound",
   "text": "[No document] What is the company's net floor area and the building's total area?",
   "iso": "ISO 14064-1 §5.3",
   "req": true,
   "next": "4A-3",
   "show": {
    "questionId": "4A-2a",
    "equals": "no"
   },
   "kind": "conditional",
   "code": "deferrable",
   "reason": "Data input or documentation: its answer changes neither the route, the boundary nor the method; it can be supplied later.",
   "then": "deferrable"
  },
  "4A-3": {
   "n": 74,
   "stage": 4,
   "type": "single_select",
   "text": "[Site name] — Do you have on-site renewable energy generation?",
   "iso": "ISO 14064-1 §5.3",
   "req": true,
   "nbv": {
    "yes": "4A-3a",
    "no": "4A-EF"
   },
   "kind": "conditional",
   "code": "gate",
   "reason": "Its answer chooses the next question (yes / no); without it the route is a guess.",
   "then": "required"
  },
  "4A-3a": {
   "n": 75,
   "stage": 4,
   "type": "compound",
   "text": "[On-site generation] How much electricity do you generate per year, and do you sell any to the grid?",
   "iso": "ISO 14064-1 §5.3",
   "req": true,
   "next": "4A-EF",
   "show": {
    "questionId": "4A-3",
    "equals": "yes"
   },
   "kind": "conditional",
   "code": "deferrable",
   "reason": "Data input or documentation: its answer changes neither the route, the boundary nor the method; it can be supplied later.",
   "then": "deferrable"
  },
  "4A-EF": {
   "n": 76,
   "stage": 4,
   "type": "single_select",
   "text": "Does your electricity supplier have an official emission declaration?",
   "iso": "ISO 14064-1 §5.3",
   "req": true,
   "next": "4A-EV",
   "nbv": {
    "yes": "4A-EF-a",
    "no": "4A-EV"
   },
   "kind": "conditional",
   "code": "gate",
   "reason": "Its answer chooses the next question (yes / no); without it the route is a guess.",
   "then": "required"
  },
  "4A-EF-a": {
   "n": "76a",
   "stage": 4,
   "type": "compound",
   "text": "Enter the supplier emission declaration details",
   "iso": "ISO 14064-1 §5.3",
   "req": true,
   "next": "4A-EV",
   "show": {
    "questionId": "4A-EF",
    "equals": "yes"
   },
   "kind": "conditional",
   "code": "deferrable",
   "reason": "Data input or documentation: its answer changes neither the route, the boundary nor the method; it can be supplied later.",
   "then": "deferrable"
  },
  "4A-EV": {
   "n": "76b",
   "stage": 4,
   "type": "compound",
   "text": "How much electricity did your electric vehicles use for charging in the year?",
   "iso": "ISO 14064-1 §5.3",
   "req": true,
   "next": "4B-0",
   "show": {
    "questionId": "3B-5",
    "equals": "electric"
   },
   "kind": "conditional",
   "code": "deferrable",
   "reason": "Data input or documentation: its answer changes neither the route, the boundary nor the method; it can be supplied later.",
   "then": "deferrable"
  },
  "4B-0": {
   "n": 77,
   "stage": 4,
   "type": "single_select",
   "text": "Do you purchase heat, steam, cooling or compressed air from external sources?",
   "iso": "ISO 14064-1 §5.3",
   "req": true,
   "nbv": {
    "yes": "4B-1",
    "no": "4C-1"
   },
   "kind": "required",
   "code": "gate",
   "reason": "Its answer chooses the next question (yes / no); without it the route is a guess."
  },
  "4B-1": {
   "n": 78,
   "stage": 4,
   "type": "multi_select",
   "text": "Which types of energy do you purchase?",
   "iso": "ISO 14064-1 §5.3",
   "req": true,
   "next": "4B-2",
   "kind": "conditional",
   "code": "loop_source",
   "reason": "Purchased energy types: the energy loop is asked per type.",
   "then": "required"
  },
  "4B-2": {
   "n": "78a",
   "stage": 4,
   "type": "fuel_loop",
   "text": "[Energy type] — What is the annual consumption quantity?",
   "iso": "ISO 14064-1 §5.3",
   "req": true,
   "next": "4B-EF",
   "loopNext": "4B-EF",
   "loop": true,
   "kind": "conditional",
   "code": "loop_item",
   "reason": "Answered item by item for the items its loop source defined (4B-1); not deferrable one by one.",
   "then": "required",
   "ls": "4B-1"
  },
  "4B-EF": {
   "n": 79,
   "stage": 4,
   "type": "single_select",
   "text": "Does the supplier of your purchased heat, steam or cooling have an emission declaration?",
   "iso": "ISO 14064-1 §5.3",
   "req": true,
   "next": "4C-1",
   "nbv": {
    "yes": "4B-EF-a",
    "no": "4C-1"
   },
   "kind": "conditional",
   "code": "gate",
   "reason": "Its answer chooses the next question (yes / no); without it the route is a guess.",
   "then": "required"
  },
  "4B-EF-a": {
   "n": "79a",
   "stage": 4,
   "type": "compound",
   "text": "Enter the supplier emission declaration details",
   "iso": "ISO 14064-1 §5.3",
   "req": true,
   "next": "4C-1",
   "show": {
    "questionId": "4B-EF",
    "equals": "yes"
   },
   "kind": "conditional",
   "code": "deferrable",
   "reason": "Data input or documentation: its answer changes neither the route, the boundary nor the method; it can be supplied later.",
   "then": "deferrable"
  },
  "4C-1": {
   "n": 80,
   "stage": 4,
   "type": "single_select",
   "text": "Scope 2 summary: Are the identified energy sources and quantities correct?",
   "iso": "ISO 14064-1 §5.3",
   "req": true,
   "nbv": {
    "confirmed": "K3C1-0",
    "edit": "4C-edit",
    "add_source": "4C-edit",
    "skip_to_report": "6-GİRİŞ"
   },
   "kind": "required",
   "code": "gate",
   "reason": "Its answer chooses the next question (confirmed / edit / add_source / skip_to_report); without it the route is a guess."
  },
  "4C-edit": {
   "n": "80a",
   "stage": 4,
   "type": "section_picker",
   "text": "Which Scope 2 section would you like to edit?",
   "iso": "ISO 14064-1 §5.3",
   "req": true,
   "nbv": {
    "4A-0": "4A-0",
    "4B-0": "4B-0"
   },
   "kind": "info",
   "code": "navigation",
   "reason": "Section picker: navigation back into a section, not an answer."
  },
  "K3C1-0": {
   "n": 81,
   "stage": 5,
   "type": "single_select",
   "text": "Does your company purchase goods or services from external suppliers?",
   "iso": "ISO 14064-1 §5.4",
   "req": true,
   "nbv": {
    "yes": "K3C1-1",
    "no": "K3C2-0"
   },
   "kind": "conditional",
   "code": "gate",
   "reason": "Its answer chooses the next question (yes / no); without it the route is a guess.",
   "then": "required"
  },
  "K3C1-1": {
   "n": 82,
   "stage": 5,
   "type": "multi_select",
   "text": "Which categories of goods and services do you purchase?",
   "iso": "ISO 14064-1 §5.4",
   "req": true,
   "next": "K3C1-2",
   "kind": "conditional",
   "code": "loop_source",
   "reason": "Purchased goods and service categories: asked per category.",
   "then": "required"
  },
  "K3C1-2": {
   "n": 83,
   "stage": 5,
   "type": "text",
   "text": "[Category] — What is the annual spend?",
   "iso": "ISO 14064-1 §5.4",
   "req": true,
   "next": "K3C1-3",
   "loopNext": "K3C1-3",
   "loop": true,
   "kind": "conditional",
   "code": "loop_item",
   "reason": "Answered item by item for the items its loop source defined (K3C1-1); not deferrable one by one.",
   "then": "required",
   "ls": "K3C1-1"
  },
  "K3C1-3": {
   "n": 84,
   "stage": 5,
   "type": "single_select",
   "text": "[Category] — Do you know the quantity you bought (tonnes, units, etc.)?",
   "iso": "ISO 14064-1 §5.4",
   "req": false,
   "next": "K3C1-4",
   "nbv": {
    "yes": "K3C1-3a",
    "no": "K3C1-4"
   },
   "kind": "conditional",
   "code": "gate",
   "reason": "Its answer chooses the next question (yes / no); without it the route is a guess.",
   "then": "required"
  },
  "K3C1-3a": {
   "n": "84a",
   "stage": 5,
   "type": "equipment_loop",
   "text": "[Category] — What quantity was purchased in the reporting year?",
   "iso": "ISO 14064-1 §5.4",
   "req": false,
   "next": "K3C1-3m",
   "loopNext": "K3C1-3m",
   "loop": true,
   "show": {
    "questionId": "K3C1-3",
    "equals": "yes"
   },
   "kind": "conditional",
   "code": "loop_item",
   "reason": "Answered item by item for the items its loop source defined (K3C1-1); not deferrable one by one.",
   "then": "required",
   "ls": "K3C1-1"
  },
  "K3C1-3m": {
   "n": "84b",
   "stage": 5,
   "type": "single_select",
   "text": "[Category] — Which material makes up most of it by weight?",
   "iso": "ISO 14064-1 §5.4",
   "req": false,
   "next": "K3C1-4",
   "loopNext": "K3C1-4",
   "loop": true,
   "show": {
    "questionId": "K3C1-3",
    "equals": "yes"
   },
   "kind": "conditional",
   "code": "loop_item",
   "reason": "Answered item by item for the items its loop source defined (K3C1-1); not deferrable one by one.",
   "then": "required",
   "ls": "K3C1-1",
   "lio": [
    "SC-01",
    "SC-02"
   ]
  },
  "K3C1-4": {
   "n": 85,
   "stage": 5,
   "type": "single_select",
   "text": "[Category] — Do any suppliers have emission declarations?",
   "iso": "ISO 14064-1 §5.4",
   "req": false,
   "next": "K3C2-0",
   "nbv": {
    "yes": "K3C1-4a",
    "no": "K3C2-0"
   },
   "kind": "conditional",
   "code": "gate",
   "reason": "Its answer chooses the next question (yes / no); without it the route is a guess.",
   "then": "required"
  },
  "K3C1-4a": {
   "n": "85a",
   "stage": 5,
   "type": "compound",
   "text": "Enter the supplier emission declaration details",
   "iso": "ISO 14064-1 §5.4",
   "req": true,
   "next": "K3C2-0",
   "show": {
    "questionId": "K3C1-4",
    "equals": "yes"
   },
   "kind": "conditional",
   "code": "deferrable",
   "reason": "Data input or documentation: its answer changes neither the route, the boundary nor the method; it can be supplied later.",
   "then": "deferrable"
  },
  "K3C2-0": {
   "n": 86,
   "stage": 5,
   "type": "single_select",
   "text": "Did you purchase any capital goods during this reporting year?",
   "iso": "ISO 14064-1 §5.4",
   "req": true,
   "nbv": {
    "yes": "K3C2-1",
    "no": "K3C3-INFO"
   },
   "kind": "conditional",
   "code": "gate",
   "reason": "Its answer chooses the next question (yes / no); without it the route is a guess.",
   "then": "required"
  },
  "K3C2-1": {
   "n": 87,
   "stage": 5,
   "type": "compound",
   "text": "What capital goods did you buy — category, purchase year and amount spent?",
   "iso": "ISO 14064-1 §5.4",
   "req": true,
   "next": "K3C3-INFO",
   "kind": "conditional",
   "code": "deferrable",
   "reason": "Data input or documentation: its answer changes neither the route, the boundary nor the method; it can be supplied later.",
   "then": "deferrable"
  },
  "K3C3-INFO": {
   "n": 88,
   "stage": 5,
   "type": "single_select",
   "text": "Should Category 3 (fuel- and energy-related activities) be calculated this way?",
   "iso": "ISO 14064-1 §5.4",
   "req": true,
   "next": "K3C4-0",
   "nbv": {
    "confirmed": "K3C4-0",
    "custom": "K3C3-custom"
   },
   "kind": "conditional",
   "code": "gate",
   "reason": "Its answer chooses the next question (confirmed / custom); without it the route is a guess.",
   "then": "required"
  },
  "K3C3-custom": {
   "n": "88a",
   "stage": 5,
   "type": "compound",
   "text": "Enter the WTT / T&D factor you want to use",
   "iso": "ISO 14064-1 §5.4",
   "req": true,
   "next": "K3C4-0",
   "show": {
    "questionId": "K3C3-INFO",
    "equals": "custom"
   },
   "kind": "conditional",
   "code": "methodology",
   "reason": "The custom WTT / T&D factor chosen for category 3.",
   "then": "required"
  },
  "K3C4-0": {
   "n": 89,
   "stage": 5,
   "type": "single_select",
   "text": "Are goods or raw materials transported to you from external suppliers?",
   "iso": "ISO 14064-1 §5.4",
   "req": true,
   "nbv": {
    "yes": "K3C4-1",
    "no": "K3C5-0"
   },
   "kind": "conditional",
   "code": "gate",
   "reason": "Its answer chooses the next question (yes / no); without it the route is a guess.",
   "then": "required"
  },
  "K3C4-1": {
   "n": 90,
   "stage": 5,
   "type": "single_select",
   "text": "What level of upstream transport data do you have?",
   "iso": "ISO 14064-1 §5.4",
   "req": true,
   "nbv": {
    "S1": "K3C4-2c",
    "S2": "K3C4-2",
    "S3": "K3C4-2b"
   },
   "kind": "conditional",
   "code": "gate",
   "reason": "Its answer chooses the next question (S1 / S2 / S3); without it the route is a guess.",
   "then": "required"
  },
  "K3C4-2c": {
   "n": "90a",
   "stage": 5,
   "type": "compound",
   "text": "Enter the details of the logistics company's GLEC / ISO 14083 emission report",
   "iso": "ISO 14064-1 §5.4",
   "req": true,
   "next": "K3C4-2",
   "show": {
    "questionId": "K3C4-1",
    "equals": "S1"
   },
   "kind": "conditional",
   "code": "deferrable",
   "reason": "Data input or documentation: its answer changes neither the route, the boundary nor the method; it can be supplied later.",
   "then": "deferrable"
  },
  "K3C4-2": {
   "n": "90b",
   "stage": 5,
   "type": "compound",
   "text": "Which transport mode was used, how many tonnes were carried and over how many km?",
   "iso": "ISO 14064-1 §5.4",
   "req": true,
   "next": "K3C5-0",
   "kind": "conditional",
   "code": "deferrable",
   "reason": "Data input or documentation: its answer changes neither the route, the boundary nor the method; it can be supplied later.",
   "then": "deferrable"
  },
  "K3C4-2b": {
   "n": "90c",
   "stage": 5,
   "type": "text",
   "text": "What is the total annual logistics/freight invoice amount?",
   "iso": "ISO 14064-1 §5.4",
   "req": true,
   "next": "K3C5-0",
   "show": {
    "questionId": "K3C4-1",
    "equals": "S3"
   },
   "kind": "conditional",
   "code": "deferrable",
   "reason": "Data input or documentation: its answer changes neither the route, the boundary nor the method; it can be supplied later.",
   "then": "deferrable"
  },
  "K3C5-0": {
   "n": 91,
   "stage": 5,
   "type": "single_select",
   "text": "Do your operations generate waste?",
   "iso": "ISO 14064-1 §5.4",
   "req": true,
   "nbv": {
    "yes": "K3C5-1",
    "no": "K3C6-0"
   },
   "kind": "conditional",
   "code": "gate",
   "reason": "Its answer chooses the next question (yes / no); without it the route is a guess.",
   "then": "required"
  },
  "K3C5-1": {
   "n": 92,
   "stage": 5,
   "type": "single_select",
   "text": "How much do you know about your waste data?",
   "iso": "ISO 14064-1 §5.4",
   "req": true,
   "nbv": {
    "S1": "K3C5-2c",
    "S2_type": "K3C5-2",
    "S2_total": "K3C5-2b",
    "S3": "K3C6-0"
   },
   "kind": "conditional",
   "code": "gate",
   "reason": "Its answer chooses the next question (S1 / S2_type / S2_total / S3); without it the route is a guess.",
   "then": "required"
  },
  "K3C5-2c": {
   "n": "92a",
   "stage": 5,
   "type": "compound",
   "text": "Enter the details of the disposal company emission declaration",
   "iso": "ISO 14064-1 §5.4",
   "req": true,
   "next": "K3C5-2",
   "show": {
    "questionId": "K3C5-1",
    "equals": "S1"
   },
   "kind": "conditional",
   "code": "deferrable",
   "reason": "Data input or documentation: its answer changes neither the route, the boundary nor the method; it can be supplied later.",
   "then": "deferrable"
  },
  "K3C5-2": {
   "n": "92b",
   "stage": 5,
   "type": "compound",
   "text": "Which type of waste, how much of it, and how was it disposed of?",
   "iso": "ISO 14064-1 §5.4",
   "req": true,
   "next": "K3C6-0",
   "kind": "conditional",
   "code": "deferrable",
   "reason": "Data input or documentation: its answer changes neither the route, the boundary nor the method; it can be supplied later.",
   "then": "deferrable"
  },
  "K3C5-2b": {
   "n": "92c",
   "stage": 5,
   "type": "text",
   "text": "What is the total annual waste quantity (kg)?",
   "iso": "ISO 14064-1 §5.4",
   "req": true,
   "next": "K3C6-0",
   "show": {
    "questionId": "K3C5-1",
    "equals": "S2_total"
   },
   "kind": "conditional",
   "code": "deferrable",
   "reason": "Data input or documentation: its answer changes neither the route, the boundary nor the method; it can be supplied later.",
   "then": "deferrable"
  },
  "K3C6-0": {
   "n": 93,
   "stage": 5,
   "type": "single_select",
   "text": "Do your employees travel for business purposes?",
   "iso": "ISO 14064-1 §5.4",
   "req": true,
   "nbv": {
    "yes": "K3C6-1",
    "no": "K3C7-0"
   },
   "kind": "conditional",
   "code": "gate",
   "reason": "Its answer chooses the next question (yes / no); without it the route is a guess.",
   "then": "required"
  },
  "K3C6-1": {
   "n": 94,
   "stage": 5,
   "type": "single_select",
   "text": "What business travel data do you have?",
   "iso": "ISO 14064-1 §5.4",
   "req": true,
   "nbv": {
    "S1": "K3C6-2c",
    "S2": "K3C6-2",
    "S3": "K3C6-2b"
   },
   "kind": "conditional",
   "code": "gate",
   "reason": "Its answer chooses the next question (S1 / S2 / S3); without it the route is a guess.",
   "then": "required"
  },
  "K3C6-2c": {
   "n": "94a",
   "stage": 5,
   "type": "compound",
   "text": "Enter the details of the travel agency / platform emission report",
   "iso": "ISO 14064-1 §5.4",
   "req": true,
   "next": "K3C6-2",
   "show": {
    "questionId": "K3C6-1",
    "equals": "S1"
   },
   "kind": "conditional",
   "code": "deferrable",
   "reason": "Data input or documentation: its answer changes neither the route, the boundary nor the method; it can be supplied later.",
   "then": "deferrable"
  },
  "K3C6-2": {
   "n": "94b",
   "stage": 5,
   "type": "compound",
   "text": "For each trip: how did you travel, how far (or how many hotel nights) and, for flights, in which cabin class?",
   "iso": "ISO 14064-1 §5.4",
   "req": true,
   "next": "K3C7-0",
   "kind": "conditional",
   "code": "deferrable",
   "reason": "Data input or documentation: its answer changes neither the route, the boundary nor the method; it can be supplied later.",
   "then": "deferrable"
  },
  "K3C6-2b": {
   "n": "94c",
   "stage": 5,
   "type": "text",
   "text": "What is the total annual business travel spend?",
   "iso": "ISO 14064-1 §5.4",
   "req": true,
   "next": "K3C7-0",
   "show": {
    "questionId": "K3C6-1",
    "equals": "S3"
   },
   "kind": "conditional",
   "code": "deferrable",
   "reason": "Data input or documentation: its answer changes neither the route, the boundary nor the method; it can be supplied later.",
   "then": "deferrable"
  },
  "K3C7-0": {
   "n": 95,
   "stage": 5,
   "type": "single_select",
   "text": "How do employees commute? Has a commute survey been conducted?",
   "iso": "ISO 14064-1 §5.4",
   "req": true,
   "next": "K3C7-1",
   "kind": "conditional",
   "code": "methodology",
   "reason": "Commute survey or estimate: decides the commuting method.",
   "then": "required"
  },
  "K3C7-1": {
   "n": "95a",
   "stage": 5,
   "type": "compound",
   "text": "How many of your employees work full-time in the office, hybrid, or remotely?",
   "iso": "ISO 14064-1 §5.4",
   "req": true,
   "next": "K3C7-2",
   "kind": "conditional",
   "code": "structure",
   "reason": "Full-time / hybrid / remote counts: decide which commuting follow-ups apply.",
   "then": "required"
  },
  "K3C7-2": {
   "n": "95b",
   "stage": 5,
   "type": "text",
   "text": "How many days per week do hybrid employees come to the office?",
   "iso": "ISO 14064-1 §5.4",
   "req": true,
   "next": "K3C7-3",
   "show": {
    "questionId": "K3C7-1",
    "field": "hybrid_count",
    "greaterThan": 0
   },
   "kind": "conditional",
   "code": "deferrable",
   "reason": "Data input or documentation: its answer changes neither the route, the boundary nor the method; it can be supplied later.",
   "then": "deferrable"
  },
  "K3C7-3": {
   "n": "95c",
   "stage": 5,
   "type": "compound",
   "text": "What percentage of your employees commute by each means of transport?",
   "iso": "ISO 14064-1 §5.4",
   "req": true,
   "next": "K3C7-6",
   "kind": "conditional",
   "code": "structure",
   "reason": "Commute mode shares: decide whether the shuttle ownership question applies.",
   "then": "required"
  },
  "K3C7-6": {
   "n": "95d",
   "stage": 5,
   "type": "single_select",
   "text": "Who owns the staff shuttle buses?",
   "iso": "ISO 14064-1 §5.4",
   "req": true,
   "next": "K3C7-4",
   "show": {
    "questionId": "K3C7-3",
    "field": "shuttle_pct",
    "greaterThan": 0
   },
   "kind": "conditional",
   "code": "methodology",
   "reason": "Who owns the staff shuttle buses: decides whether the emissions are Scope 1 or Scope 3.",
   "then": "required"
  },
  "K3C7-4": {
   "n": "95e",
   "stage": 5,
   "type": "text",
   "text": "What is the average one-way distance from home to work (km)?",
   "iso": "ISO 14064-1 §5.4",
   "req": true,
   "next": "K3C7-5",
   "kind": "conditional",
   "code": "deferrable",
   "reason": "Data input or documentation: its answer changes neither the route, the boundary nor the method; it can be supplied later.",
   "then": "deferrable"
  },
  "K3C7-5": {
   "n": "95f",
   "stage": 5,
   "type": "text",
   "text": "How many employees who commute by private car use an electric vehicle?",
   "iso": "ISO 14064-1 §5.4",
   "req": false,
   "next": "K3C8-0",
   "kind": "conditional",
   "code": "deferrable",
   "reason": "Data input or documentation: its answer changes neither the route, the boundary nor the method; it can be supplied later.",
   "then": "deferrable"
  },
  "K3C8-0": {
   "n": 96,
   "stage": 5,
   "type": "single_select",
   "text": "Do you lease any buildings or long-term equipment?",
   "iso": "ISO 14064-1 §5.4",
   "req": true,
   "nbv": {
    "yes": "K3C8-1",
    "no": "K3C9-0"
   },
   "kind": "conditional",
   "code": "gate",
   "reason": "Its answer chooses the next question (yes / no); without it the route is a guess.",
   "then": "required"
  },
  "K3C8-1": {
   "n": 97,
   "stage": 5,
   "type": "compound",
   "text": "What do you lease, how large is it (m²), and does the building owner declare its energy use?",
   "iso": "ISO 14064-1 §5.4",
   "req": true,
   "next": "K3C9-0",
   "kind": "conditional",
   "code": "deferrable",
   "reason": "Data input or documentation: its answer changes neither the route, the boundary nor the method; it can be supplied later.",
   "then": "deferrable"
  },
  "K3C9-0": {
   "n": 98,
   "stage": 5,
   "type": "single_select",
   "text": "Are goods shipped to customers or distribution channels?",
   "iso": "ISO 14064-1 §5.4",
   "req": true,
   "nbv": {
    "yes": "K3C9-1",
    "no": "K3C10-0"
   },
   "kind": "conditional",
   "code": "gate",
   "reason": "Its answer chooses the next question (yes / no); without it the route is a guess.",
   "then": "required"
  },
  "K3C9-1": {
   "n": "98a",
   "stage": 5,
   "type": "compound",
   "text": "Which transport mode was used, how many tonnes were carried and over how many km?",
   "iso": "ISO 14064-1 §5.4",
   "req": true,
   "next": "K3C10-0",
   "kind": "conditional",
   "code": "deferrable",
   "reason": "Data input or documentation: its answer changes neither the route, the boundary nor the method; it can be supplied later.",
   "then": "deferrable"
  },
  "K3C10-0": {
   "n": 99,
   "stage": 5,
   "type": "single_select",
   "text": "Are your sold products further processed by customers?",
   "iso": "ISO 14064-1 §5.4",
   "req": false,
   "next": "K3C11-0",
   "nbv": {
    "yes": "K3C10-1",
    "no": "K3C11-0"
   },
   "show": {
    "questionId": "B1",
    "inValues": [
     "NACE_A",
     "NACE_B",
     "NACE_C",
     "NACE_D",
     "NACE_E",
     "NACE_F"
    ]
   },
   "kind": "conditional",
   "code": "gate",
   "reason": "Its answer chooses the next question (yes / no); without it the route is a guess.",
   "then": "required"
  },
  "K3C10-1": {
   "n": "99a",
   "stage": 5,
   "type": "compound",
   "text": "Which product is processed by customers, and how much was sold?",
   "iso": "ISO 14064-1 §5.4",
   "req": true,
   "next": "K3C11-0",
   "show": {
    "questionId": "K3C10-0",
    "equals": "yes"
   },
   "kind": "conditional",
   "code": "deferrable",
   "reason": "Data input or documentation: its answer changes neither the route, the boundary nor the method; it can be supplied later.",
   "then": "deferrable"
  },
  "K3C11-0": {
   "n": 100,
   "stage": 5,
   "type": "single_select",
   "text": "Do your sold products generate emissions during use?",
   "iso": "ISO 14064-1 §5.4",
   "req": true,
   "nbv": {
    "yes": "K3C11-1",
    "no": "K3C12-0"
   },
   "kind": "conditional",
   "code": "gate",
   "reason": "Its answer chooses the next question (yes / no); without it the route is a guess.",
   "then": "required"
  },
  "K3C11-1": {
   "n": 101,
   "stage": 5,
   "type": "compound",
   "text": "Which product did you sell, how much of it, and for how many years is it used on average?",
   "iso": "ISO 14064-1 §5.4",
   "req": true,
   "next": "K3C12-0",
   "kind": "conditional",
   "code": "deferrable",
   "reason": "Data input or documentation: its answer changes neither the route, the boundary nor the method; it can be supplied later.",
   "then": "deferrable"
  },
  "K3C12-0": {
   "n": 102,
   "stage": 5,
   "type": "single_select",
   "text": "Are your sold products physical goods (not services)?",
   "iso": "ISO 14064-1 §5.4",
   "req": true,
   "nbv": {
    "yes": "K3C12-1",
    "no": "K3C13-0"
   },
   "kind": "conditional",
   "code": "gate",
   "reason": "Its answer chooses the next question (yes / no); without it the route is a guess.",
   "then": "required"
  },
  "K3C12-1": {
   "n": "102a",
   "stage": 5,
   "type": "compound",
   "text": "What product do you sell, what are its unit weight and main material, and how is it disposed of at the end of its life?",
   "iso": "ISO 14064-1 §5.4",
   "req": true,
   "next": "K3C13-0",
   "kind": "conditional",
   "code": "deferrable",
   "reason": "Data input or documentation: its answer changes neither the route, the boundary nor the method; it can be supplied later.",
   "then": "deferrable"
  },
  "K3C13-0": {
   "n": 103,
   "stage": 5,
   "type": "single_select",
   "text": "Do you lease any assets to others?",
   "iso": "ISO 14064-1 §5.4",
   "req": true,
   "nbv": {
    "yes": "K3C13-1",
    "no": "K3C14-0"
   },
   "kind": "conditional",
   "code": "gate",
   "reason": "Its answer chooses the next question (yes / no); without it the route is a guess.",
   "then": "required"
  },
  "K3C13-1": {
   "n": "103a",
   "stage": 5,
   "type": "compound",
   "text": "What asset do you lease out, and can you get energy data from the tenant?",
   "iso": "ISO 14064-1 §5.4",
   "req": true,
   "next": "K3C14-0",
   "kind": "conditional",
   "code": "deferrable",
   "reason": "Data input or documentation: its answer changes neither the route, the boundary nor the method; it can be supplied later.",
   "then": "deferrable"
  },
  "K3C14-0": {
   "n": 104,
   "stage": 5,
   "type": "single_select",
   "text": "Does your franchise network have emission data?",
   "iso": "ISO 14064-1 §5.4",
   "req": false,
   "next": "K3C15-0",
   "nbv": {
    "yes": "K3C14-1",
    "no": "K3C14-2",
    "na": "K3C15-0"
   },
   "show": {
    "questionId": "C3",
    "equals": "yes"
   },
   "kind": "conditional",
   "code": "gate",
   "reason": "Its answer chooses the next question (yes / no / na); without it the route is a guess.",
   "then": "required"
  },
  "K3C14-1": {
   "n": "104a",
   "stage": 5,
   "type": "compound",
   "text": "What total emissions do your franchisees report?",
   "iso": "ISO 14064-1 §5.4",
   "req": true,
   "next": "K3C15-0",
   "kind": "conditional",
   "code": "deferrable",
   "reason": "Data input or documentation: its answer changes neither the route, the boundary nor the method; it can be supplied later.",
   "then": "deferrable"
  },
  "K3C14-2": {
   "n": "104b",
   "stage": 5,
   "type": "compound",
   "text": "How many franchise outlets do you have and what is their total area?",
   "iso": "ISO 14064-1 §5.4",
   "req": true,
   "next": "K3C15-0",
   "kind": "conditional",
   "code": "deferrable",
   "reason": "Data input or documentation: its answer changes neither the route, the boundary nor the method; it can be supplied later.",
   "then": "deferrable"
  },
  "K3C15-0": {
   "n": 105,
   "stage": 5,
   "type": "single_select",
   "text": "Do you have financial investments?",
   "iso": "ISO 14064-1 §5.4",
   "req": false,
   "nbv": {
    "yes": "K3C15-1",
    "no": "K3-TY"
   },
   "kind": "conditional",
   "code": "gate",
   "reason": "Its answer chooses the next question (yes / no); without it the route is a guess.",
   "then": "required"
  },
  "K3C15-1": {
   "n": 106,
   "stage": 5,
   "type": "compound",
   "text": "What is the asset class and amount of your investment, and what is the investee company worth?",
   "iso": "ISO 14064-1 §5.4",
   "req": true,
   "next": "K3-TY",
   "kind": "conditional",
   "code": "deferrable",
   "reason": "Data input or documentation: its answer changes neither the route, the boundary nor the method; it can be supplied later.",
   "then": "deferrable"
  },
  "K3-TY": {
   "n": 107,
   "stage": 5,
   "type": "single_select",
   "text": "Scope 3 summary: Are all categories and quantities correct?",
   "iso": "ISO 14064-1 §5.4",
   "req": true,
   "nbv": {
    "confirmed": "6-GİRİŞ",
    "edit": "K3-TY-edit",
    "add_category": "K3-TY-edit"
   },
   "kind": "conditional",
   "code": "gate",
   "reason": "Its answer chooses the next question (confirmed / edit / add_category); without it the route is a guess.",
   "then": "required"
  },
  "K3-TY-edit": {
   "n": "107a",
   "stage": 5,
   "type": "section_picker",
   "text": "Which Scope 3 category do you want to go to?",
   "iso": "ISO 14064-1 §5.4",
   "req": true,
   "nbv": {
    "K3C1-0": "K3C1-0",
    "K3C2-0": "K3C2-0",
    "K3C3-INFO": "K3C3-INFO",
    "K3C4-0": "K3C4-0",
    "K3C5-0": "K3C5-0",
    "K3C6-0": "K3C6-0",
    "K3C7-0": "K3C7-0",
    "K3C8-0": "K3C8-0",
    "K3C9-0": "K3C9-0",
    "K3C10-0": "K3C10-0",
    "K3C11-0": "K3C11-0",
    "K3C12-0": "K3C12-0",
    "K3C13-0": "K3C13-0",
    "K3C14-0": "K3C14-0",
    "K3C15-0": "K3C15-0"
   },
   "kind": "info",
   "code": "navigation",
   "reason": "Section picker: navigation back into a section, not an answer."
  },
  "6-GİRİŞ": {
   "n": 108,
   "stage": 6,
   "type": "info",
   "text": "Stage 6 Introduction — Final steps: data quality, exclusions, exceptions and ISO compliance checks.",
   "iso": "ISO 14064-1 §5.1",
   "req": false,
   "next": "6A-1",
   "kind": "info",
   "code": "info",
   "reason": "Information screen: not a question."
  },
  "6A-1": {
   "n": 109,
   "stage": 6,
   "type": "single_select",
   "text": "Is there a facility, activity or emission source you have not included (not reported) in your inventory?",
   "iso": "ISO 14064-1 §5.1",
   "req": true,
   "nbv": {
    "yes": "6A-1a",
    "none_flagged": "6B-OV"
   },
   "kind": "required",
   "code": "gate",
   "reason": "Its answer chooses the next question (yes / none_flagged); without it the route is a guess."
  },
  "6A-1a": {
   "n": "109a",
   "stage": 6,
   "type": "compound",
   "text": "Which facility, activity or source was excluded?",
   "iso": "ISO 14064-1 §5.1",
   "req": true,
   "next": "6A-3",
   "kind": "conditional",
   "code": "deferrable",
   "reason": "Data input or documentation: its answer changes neither the route, the boundary nor the method; it can be supplied later.",
   "then": "deferrable"
  },
  "6A-2": {
   "n": 110,
   "stage": 6,
   "type": "single_select",
   "text": "What is the main reason for the exclusion?",
   "iso": "ISO 14064-1 §5.1",
   "req": true,
   "next": "6A-3",
   "kind": "conditional",
   "code": "deferrable",
   "reason": "Data input or documentation: its answer changes neither the route, the boundary nor the method; it can be supplied later.",
   "then": "deferrable",
   "unreachable": true
  },
  "6A-3": {
   "n": 111,
   "stage": 6,
   "type": "text",
   "text": "Describe your exclusion justification (business justification).",
   "iso": "ISO 14064-1 §5.1",
   "req": true,
   "next": "6A-5",
   "kind": "conditional",
   "code": "deferrable",
   "reason": "Data input or documentation: its answer changes neither the route, the boundary nor the method; it can be supplied later.",
   "then": "deferrable"
  },
  "6A-4": {
   "n": 112,
   "stage": 6,
   "type": "single_select",
   "text": "What is the estimated emission share of the excluded source?",
   "iso": "ISO 14064-1 §5.1",
   "req": true,
   "next": "6A-5",
   "kind": "conditional",
   "code": "deferrable",
   "reason": "Data input or documentation: its answer changes neither the route, the boundary nor the method; it can be supplied later.",
   "then": "deferrable",
   "unreachable": true
  },
  "6A-5": {
   "n": 113,
   "stage": 6,
   "type": "text",
   "text": "Do you plan to include this source in future inventories? (Optional)",
   "iso": "ISO 14064-1 §5.1",
   "req": false,
   "next": "6A-6",
   "kind": "conditional",
   "code": "deferrable",
   "reason": "Data input or documentation: its answer changes neither the route, the boundary nor the method; it can be supplied later.",
   "then": "deferrable"
  },
  "6A-6": {
   "n": 114,
   "stage": 6,
   "type": "single_select",
   "text": "Is the cumulative emission share of all exclusions below the ISO 14064-1 §5.1 threshold?",
   "iso": "ISO 14064-1 §5.1",
   "req": true,
   "nbv": {
    "ok": "6B-OV",
    "go_back": "6A-1"
   },
   "kind": "conditional",
   "code": "gate",
   "reason": "Its answer chooses the next question (ok / go_back); without it the route is a guess.",
   "then": "required"
  },
  "6B-OV": {
   "n": 115,
   "stage": 6,
   "type": "single_select",
   "text": "Would you like to add the assumptions you made in your inventory to the report?",
   "iso": "ISO 14064-1 §7.3",
   "req": true,
   "next": "6C-1",
   "nbv": {
    "approve_all": "6C-1",
    "review_detail": "6B-2"
   },
   "kind": "required",
   "code": "gate",
   "reason": "Its answer chooses the next question (approve_all / review_detail); without it the route is a guess."
  },
  "6C-1": {
   "n": 116,
   "stage": 6,
   "type": "single_select",
   "text": "Are there any areas in your inventory scope where you applied a deviation (exception) from the standard methodology?",
   "iso": "ISO 14064-1 §5.2",
   "req": true,
   "nbv": {
    "none": "6D-1",
    "ef_deviation": "6C-2",
    "boundary_deviation": "6C-2",
    "methodology_deviation": "6C-2",
    "multiple": "6C-2"
   },
   "exclusive": [
    "none"
   ],
   "kind": "required",
   "code": "gate",
   "reason": "Its answer chooses the next question (none / ef_deviation / boundary_deviation / methodology_deviation / multiple); without it the route is a guess."
  },
  "6C-2": {
   "n": 117,
   "stage": 6,
   "type": "compound",
   "text": "Enter the details of the exception and the materiality assessment.",
   "iso": "ISO 14064-1 §5.2",
   "req": true,
   "next": "6C-3",
   "kind": "conditional",
   "code": "deferrable",
   "reason": "Data input or documentation: its answer changes neither the route, the boundary nor the method; it can be supplied later.",
   "then": "deferrable"
  },
  "6C-3": {
   "n": 118,
   "stage": 6,
   "type": "text",
   "text": "Do you have an improvement commitment for this exception in the future period? (Optional)",
   "iso": "ISO 14064-1 §5.2",
   "req": false,
   "next": "6D-1",
   "kind": "conditional",
   "code": "deferrable",
   "reason": "Data input or documentation: its answer changes neither the route, the boundary nor the method; it can be supplied later.",
   "then": "deferrable"
  },
  "6D-1": {
   "n": 119,
   "stage": 6,
   "type": "single_select",
   "text": "Including all exclusions and exceptions, does the total uncertainty and data gap remain below 5% of your inventory?",
   "iso": "ISO 14064-1 §5.1",
   "req": true,
   "nbv": {
    "ok": "6E-1",
    "go_back": "6A-1"
   },
   "kind": "required",
   "code": "gate",
   "reason": "Its answer chooses the next question (ok / go_back); without it the route is a guess."
  },
  "6E-1": {
   "n": 120,
   "stage": 6,
   "type": "text",
   "text": "Are there any planned improvements to reduce data quality and uncertainty? (Optional)",
   "iso": "ISO 14064-1 §7.3",
   "req": false,
   "next": "6F-1",
   "kind": "deferrable",
   "code": "deferrable",
   "reason": "Planned data-quality improvements (optional text)."
  },
  "6F-1": {
   "n": 121,
   "stage": 6,
   "type": "multi_select",
   "text": "Were there any significant changes in your organizational structure during the reporting period?",
   "iso": "ISO 14064-1 §5.4",
   "req": true,
   "next": "6F-2",
   "nbv": {
    "none": "7-GİRİŞ"
   },
   "exclusive": [
    "none"
   ],
   "kind": "required",
   "code": "gate",
   "reason": "Its answer chooses the next question (none); without it the route is a guess."
  },
  "6F-2": {
   "n": 122,
   "stage": 6,
   "type": "single_select",
   "text": "Does the impact of structural changes on total emissions exceed 5%?",
   "iso": "ISO 14064-1 §5.4",
   "req": true,
   "nbv": {
    "yes": "6F-3",
    "no": "7-GİRİŞ"
   },
   "kind": "conditional",
   "code": "gate",
   "reason": "Its answer chooses the next question (yes / no); without it the route is a guess.",
   "then": "required"
  },
  "6F-3": {
   "n": 123,
   "stage": 6,
   "type": "single_select",
   "text": "What is your base year recalculation decision?",
   "iso": "ISO 14064-1 §5.4",
   "req": true,
   "next": "7-GİRİŞ",
   "kind": "conditional",
   "code": "methodology",
   "reason": "Base year recalculation decision.",
   "then": "required"
  },
  "7-GİRİŞ": {
   "n": 124,
   "stage": 7,
   "type": "info",
   "text": "Stage 7 Introduction — Report Generation and Sign-Off",
   "iso": "ISO 14064-1 §7.5",
   "req": false,
   "next": "7C-1",
   "kind": "info",
   "code": "info",
   "reason": "Information screen: not a question."
  },
  "7C-1": {
   "n": 125,
   "stage": 7,
   "type": "single_select",
   "text": "Before signing: are you sure the information you entered is complete?",
   "iso": "ISO 14064-1 §7.5",
   "req": true,
   "nbv": {
    "all_complete": "7C-2",
    "fix_missing": "7C-edit"
   },
   "kind": "required",
   "code": "gate",
   "reason": "Its answer chooses the next question (all_complete / fix_missing); without it the route is a guess."
  },
  "7C-edit": {
   "n": "125a",
   "stage": 7,
   "type": "section_picker",
   "text": "Which stage do you want to fix?",
   "iso": "ISO 14064-1 §7.5",
   "req": true,
   "nbv": {
    "2A-0": "2A-0",
    "3A-0": "3A-0",
    "4A-0": "4A-0",
    "K3C1-0": "K3C1-0",
    "6A-1": "6A-1"
   },
   "kind": "info",
   "code": "navigation",
   "reason": "Section picker: navigation back into a section, not an answer."
  },
  "7C-2": {
   "n": 126,
   "stage": 7,
   "type": "compound",
   "text": "Report Sign-Off — Enter your authorized signature and declaration.",
   "iso": "ISO 14064-1 §7.5",
   "req": true,
   "next": "7A-INFO",
   "kind": "required",
   "code": "sign_off",
   "reason": "Signature and declaration: the act that completes the inventory."
  },
  "7A-INFO": {
   "n": 127,
   "stage": 7,
   "type": "info",
   "text": "Your Report is Ready",
   "iso": "ISO 14064-1 §7.5",
   "req": false,
   "next": "7B-INFO",
   "kind": "info",
   "code": "info",
   "reason": "Information screen: not a question."
  },
  "7B-INFO": {
   "n": 128,
   "stage": 7,
   "type": "single_select",
   "text": "GHG Inventory Complete",
   "iso": "ISO 14064-1 §7.5",
   "req": true,
   "nbv": {
    "view_assumptions": "6B-2"
   },
   "kind": "required",
   "code": "gate",
   "reason": "Its answer chooses the next question (view_assumptions); without it the route is a guess."
  },
  "6B-0": {
   "n": 129,
   "stage": 6,
   "type": "info",
   "text": "Assumptions Detail — Methodological Assumptions Review",
   "iso": "ISO 14064-1 §7.3",
   "req": false,
   "next": "6B-1",
   "kind": "info",
   "code": "info",
   "reason": "Information screen: not a question."
  },
  "6B-1": {
   "n": 130,
   "stage": 6,
   "type": "single_select",
   "text": "How would you like to review the system assumptions?",
   "iso": "ISO 14064-1 §7.3",
   "req": true,
   "next": "6B-2",
   "kind": "conditional",
   "code": "deferrable",
   "reason": "Data input or documentation: its answer changes neither the route, the boundary nor the method; it can be supplied later.",
   "then": "deferrable",
   "unreachable": true
  },
  "6B-2": {
   "n": "115a",
   "stage": 6,
   "type": "single_select",
   "text": "Type A — Impact Direction: How do the emission factors used affect your actual emissions?",
   "iso": "ISO 14064-1 §7.3",
   "req": true,
   "next": "6B-3",
   "kind": "conditional",
   "code": "deferrable",
   "reason": "Data input or documentation: its answer changes neither the route, the boundary nor the method; it can be supplied later.",
   "then": "deferrable"
  },
  "6B-3": {
   "n": "115b",
   "stage": 6,
   "type": "text",
   "text": "Type B — Methodology Assumption: Confirm or describe the methodological approach used in the calculation. (Optional)",
   "iso": "ISO 14064-1 §7.3",
   "req": false,
   "next": "6B-4",
   "kind": "conditional",
   "code": "deferrable",
   "reason": "Data input or documentation: its answer changes neither the route, the boundary nor the method; it can be supplied later.",
   "then": "deferrable"
  },
  "6B-4": {
   "n": "115c",
   "stage": 6,
   "type": "text",
   "text": "Type C — Boundary Decision: Confirm or describe the decisions made regarding inventory boundary. (Optional)",
   "iso": "ISO 14064-1 §7.3",
   "req": false,
   "next": "6B-5",
   "kind": "conditional",
   "code": "deferrable",
   "reason": "Data input or documentation: its answer changes neither the route, the boundary nor the method; it can be supplied later.",
   "then": "deferrable"
  },
  "6B-5": {
   "n": "115d",
   "stage": 6,
   "type": "single_select",
   "text": "All assumptions have been reviewed. Do you confirm the methodological assumptions?",
   "iso": "ISO 14064-1 §7.3",
   "req": true,
   "nbv": {
    "confirmed": "6C-1",
    "edit": "6B-2"
   },
   "kind": "conditional",
   "code": "gate",
   "reason": "Its answer chooses the next question (confirmed / edit); without it the route is a guess.",
   "then": "required"
  }
 },
 "loopSources": {
  "2A-1": {
   "num": true,
   "ex": []
  },
  "3A-1": {
   "num": false,
   "ex": []
  },
  "3A-4": {
   "num": false,
   "ex": []
  },
  "3B-1": {
   "num": false,
   "ex": []
  },
  "3C-1": {
   "num": false,
   "ex": []
  },
  "3D-0": {
   "num": false,
   "ex": [
    "none"
   ]
  },
  "4B-1": {
   "num": false,
   "ex": []
  },
  "K3C1-1": {
   "num": false,
   "ex": []
  }
 }
};
