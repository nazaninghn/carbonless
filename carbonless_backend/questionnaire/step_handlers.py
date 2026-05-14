"""
Step handlers for CarbonIQ questionnaire.
Each handler saves data to report/company and returns next_step + bot_messages.
"""
import datetime

STEP_FLOW = {
    'A1': 'A2', 'A2': 'A3', 'A3': 'A4',
    'A4': 'A5', 'A5': 'A6', 'A6': 'A7',
    'A7': 'A7a', 'A7a': 'B3',
    # B order matches frontend: sector(B3) → employees(B1) → activity(B2) → ...
    'B3': 'B1', 'B1': 'B2', 'B2': 'B4',
    'B4': 'B5', 'B5': 'B6', 'B6': 'C1',
    'C1': 'C2', 'C2': 'C3', 'C3': 'D1',
    'D1': 'D3', 'D3': 'D4',
    'D4': 'PHASE2',
}

EF_MAP = {
    'TR': 'DEFRA_TUIK', 'TURKEY': 'DEFRA_TUIK',
    'GB': 'DEFRA', 'UK': 'DEFRA',
    'DE': 'DEFRA', 'FR': 'DEFRA',
    'US': 'EPA', 'USA': 'EPA',
}

NACE_CLUSTER = {
    'A': 'agriculture', 'B': 'mining', 'C': 'manufacturing',
    'D': 'energy', 'E': 'water', 'F': 'construction',
    'G': 'service', 'H': 'service', 'I': 'service',
    'J': 'service', 'K': 'finance', 'L': 'service',
    'M': 'service', 'N': 'service', 'O': 'public',
    'P': 'public', 'Q': 'public', 'R': 'service',
    'S': 'service', 'T': 'service', 'U': 'service',
}


def handle_step(report, step, data):
    handler = HANDLERS.get(step)
    if not handler:
        return {
            'next_step': STEP_FLOW.get(step, 'PHASE2'),
            'message': 'Step saved.',
            'warnings': [],
            'bot_messages': []
        }
    return handler(report, data)


def handle_A1(report, data):
    company = report.company
    company.legal_entity_name = data['legal_name']
    company.save()
    return {
        'next_step': 'A2',
        'message': f"Company \"{data['legal_name']}\" saved.",
        'warnings': [],
        'bot_messages': [
            f"✅ Got it! **{data['legal_name']}** has been registered.",
            "What is your tax identification number? (VKN / TCKN — 10 or 11 digits)"
        ]
    }


def handle_A2(report, data):
    from companies.models import Company
    tax_id = data['tax_id']
    existing = Company.objects.filter(tax_number=tax_id).exclude(id=report.company.id).first()
    if existing:
        return {
            'next_step': 'A2',
            'message': 'Duplicate tax ID.',
            'warnings': ['duplicate_tax_id'],
            'duplicate': {
                'company_name': existing.legal_entity_name,
                'company_id': existing.id,
            },
            'bot_messages': [
                f"⚠️ This tax ID is already registered for **{existing.legal_entity_name}**.",
                "Do you want to continue with a new report or update the existing one?"
            ]
        }
    report.company.tax_number = tax_id
    report.company.save()
    return {
        'next_step': 'A3',
        'message': 'Tax ID saved.',
        'warnings': [],
        'bot_messages': [
            "✅ Tax ID verified and saved.",
            "Which country and city is your company registered in?"
        ]
    }


def handle_A3(report, data):
    country = data['country'].strip()
    city = data.get('city', '')
    report.company.country_of_headquarters = country
    report.company.save()

    country_upper = country.upper()
    suggested_ef = EF_MAP.get(country_upper, 'IPCC_AR6')
    report.ef_database = suggested_ef
    report.save()

    ef_labels = {
        'DEFRA_TUIK': 'DEFRA 2023 + TÜİK',
        'DEFRA': 'DEFRA 2023',
        'EPA': 'EPA',
        'IPCC_AR6': 'IPCC AR6 2021',
    }
    return {
        'next_step': 'A4',
        'message': f"Location saved. Suggested EF: {suggested_ef}",
        'warnings': [],
        'suggested_ef': suggested_ef,
        'bot_messages': [
            f"✅ Location saved: **{city + ', ' if city else ''}{country}**.",
            f"📊 Based on your country, I suggest **{ef_labels.get(suggested_ef, suggested_ef)}** as your emission factor database. You can change this in step D1.",
            "Which reporting year are we preparing this report for? (2015–present)"
        ]
    }


def handle_A4(report, data):
    year = data['reporting_year']
    current_year = datetime.date.today().year
    warnings = []
    bot_messages = []
    if year == current_year:
        warnings.append('current_year_selected')
        bot_messages.append(
            f"⚠️ {year} is not yet complete. Some data may be estimated — this will be documented in the report."
        )
    report.reporting_year = year
    report.save()
    bot_messages.append(f"✅ Reporting year set to **{year}**.")
    bot_messages.append("Who is preparing this report? (name and/or department)")
    return {
        'next_step': 'A5',
        'message': f"Reporting year: {year}",
        'warnings': warnings,
        'bot_messages': bot_messages
    }


def handle_A5(report, data):
    report.prepared_by = data['prepared_by']
    report.save()
    return {
        'next_step': 'A6',
        'message': 'Prepared by saved.',
        'warnings': [],
        'bot_messages': [
            f"✅ Prepared by: **{data['prepared_by']}**.",
            "What is the intended use of this report? (select all that apply)\n\n"
            "Options: **internal** / **legal** / **voluntary** / **client** / **skip**"
        ]
    }


def handle_A6(report, data):
    purposes = data.get('purposes', [])
    report.purposes = purposes
    report.legal_framework = data.get('legal_framework', '')
    report.voluntary_framework = data.get('voluntary_framework', '')
    report.save()
    warnings = []
    bot_messages = []
    if 'legal' in purposes and not data.get('legal_framework'):
        warnings.append('legal_framework_missing')
        bot_messages.append(
            "ℹ️ You selected legal requirement. Which regulation? (e.g. CSRD, TCFD, Borsa İstanbul)"
        )
    elif 'voluntary' in purposes and not data.get('voluntary_framework'):
        warnings.append('voluntary_framework_missing')
        bot_messages.append(
            "ℹ️ You selected voluntary disclosure. Which framework? (CDP, GRI, TCFD, other)"
        )
    else:
        bot_messages.append("✅ Report purpose saved.")
    bot_messages.append("Have you prepared a carbon report before?")
    return {
        'next_step': 'A7',
        'message': 'Purposes saved.',
        'warnings': warnings,
        'bot_messages': bot_messages
    }


def handle_A7(report, data):
    has_prev = data.get('has_previous_report')
    report.has_previous_report = has_prev
    report.save()
    if has_prev:
        return {
            'next_step': 'A7a',
            'message': 'Has previous report.',
            'warnings': [],
            'bot_messages': [
                "✅ Great! Previous report data will enable trend comparison.",
                "What is your baseline year? (e.g. 2020)"
            ]
        }
    return {
        'next_step': 'B3',
        'message': 'First report.',
        'warnings': [],
        'bot_messages': [
            "✅ This will be your first carbon inventory year — noted in the report.",
            "What is the primary sector of your company? (NACE code or sector name)"
        ]
    }


def handle_A7a(report, data):
    baseline_year = data.get('baseline_year')
    reporting_year = report.reporting_year
    if baseline_year and reporting_year and baseline_year >= reporting_year:
        return {
            'next_step': 'A7a',
            'message': 'Invalid baseline year.',
            'warnings': ['baseline_year_invalid'],
            'bot_messages': [
                f"❌ Baseline year must be before the reporting year ({reporting_year}). Please try again."
            ]
        }
    report.baseline_year = baseline_year
    report.save()
    return {
        'next_step': 'B3',
        'message': f"Baseline year: {baseline_year}",
        'warnings': [],
        'bot_messages': [
            f"✅ Baseline year set to **{baseline_year}**.",
            "What is the primary sector of your company? (NACE code or sector name)"
        ]
    }


def handle_B3(report, data):
    """B3 = Sector / NACE — shown first in the frontend B block."""
    nace_code = data.get('nace_code', '')
    nace_label = data.get('nace_label', '')
    # Support both 'NACE_C' (frontend value) and bare letter 'C'
    if nace_code.upper().startswith('NACE_'):
        nace_letter = nace_code[5:].upper()   # 'NACE_C' → 'C'
    else:
        nace_letter = nace_code[0].upper() if nace_code else 'G'
    report.company.nace_code = nace_letter
    report.company.save()
    cluster = NACE_CLUSTER.get(nace_letter, 'service')
    bot_messages = [f"✅ Sector: **{nace_label or nace_code}** saved."]
    if cluster == 'service':
        bot_messages.append(
            "ℹ️ Service sector — process emission questions will be skipped. "
            "We'll focus on energy, travel and supply chain."
        )
    elif cluster == 'manufacturing':
        bot_messages.append(
            "ℹ️ Manufacturing sector — all Scope 1 categories including process emissions will be included."
        )
    elif cluster == 'finance':
        bot_messages.append(
            "ℹ️ Finance sector — Scope 3 Category 15 (Investments) will use PCAF standard."
        )
    bot_messages.append("What is your total number of employees?")
    return {
        'next_step': 'B1',
        'message': f"NACE: {nace_letter}",
        'warnings': [],
        'cluster': cluster,
        'bot_messages': bot_messages
    }


def handle_B1(report, data):
    """B1 = Employee range — shown second in the frontend B block."""
    band = data.get('employee_band', '')
    report.company.number_of_employees = band
    report.company.save()
    bot_messages = [f"✅ Employee range: **{band}**."]
    if band in ['1001_5000', 'over_5000']:
        bot_messages.append(
            "ℹ️ Large organization — for employee commute calculations we'll ask for location-based distribution."
        )
    bot_messages.append("Briefly describe your company's main business activities. (max 200 chars)")
    return {
        'next_step': 'B2',
        'message': f"Employees: {band}",
        'warnings': [],
        'bot_messages': bot_messages
    }


def handle_B2(report, data):
    """B2 = Activity description — shown third in the frontend B block."""
    report.company.main_activity_description = data.get('activity_description', '')
    report.company.save()
    return {
        'next_step': 'B4',
        'message': 'Activity description saved.',
        'warnings': [],
        'bot_messages': [
            "✅ Activity description saved.",
            "How many physical locations does your company operate from? (min 1)"
        ]
    }


def handle_B4(report, data):
    count = data['number_of_facilities']
    report.company.number_of_facilities = count
    report.company.save()
    bot_messages = [f"✅ Number of facilities: **{count}**."]
    if count >= 11:
        bot_messages.append(
            "ℹ️ Many locations detected. You may want to use bulk upload (Excel) instead of entering each one manually."
        )
    bot_messages.append(
        "What types of locations does your company operate? (select all that apply)\n\n"
        "Options: **office** / **factory** / **warehouse** / **field** / **datacenter** / **retail** / **other**"
    )
    return {
        'next_step': 'B5',
        'message': f"Facilities: {count}",
        'warnings': [],
        'bot_messages': bot_messages
    }


def handle_B5(report, data):
    types = data['facility_types']
    bot_messages = [f"✅ Facility types: **{', '.join(types)}**."]
    if 'factory' in types:
        bot_messages.append(
            "ℹ️ Factory selected — industrial process emissions and heavy machinery questions will be added."
        )
    if 'data_center' in types:
        bot_messages.append(
            "ℹ️ Data center selected — a PUE (Power Usage Effectiveness) question will be added in Scope 2."
        )
    bot_messages.append(
        "What is your approximate annual revenue range? (Optional)\n\n"
        "Options: **<1M** / **1-10M** / **10-100M** / **100M-1B** / **1B+** / **skip**"
    )
    return {
        'next_step': 'B6',
        'message': f"Facility types: {types}",
        'warnings': [],
        'bot_messages': bot_messages
    }


def handle_B6(report, data):
    band = data['revenue_band']
    report.company.annual_turnover_range = band
    report.company.save()
    bot_messages = []
    if band == 'skip':
        bot_messages.append(
            "ℹ️ Revenue not provided — Scope 3 materiality will be based on sector only."
        )
    elif band in ['100m_1b', 'over_1b']:
        bot_messages.append(
            "ℹ️ Large organization — we recommend reporting all 15 Scope 3 categories."
        )
    bot_messages.append("✅ Company profile complete.")
    bot_messages.append("Does your company have any subsidiaries or affiliates? (yes/no)")
    return {
        'next_step': 'C1',
        'message': f"Revenue: {band}",
        'warnings': [],
        'bot_messages': bot_messages
    }


def handle_C1(report, data):
    has_sub = data['has_subsidiaries']
    report.has_subsidiaries = has_sub
    report.company.number_of_subsidiaries = 1 if has_sub else 0
    report.company.save()
    report.save()
    bot_messages = []
    if has_sub:
        bot_messages.append(
            "ℹ️ Subsidiaries detected — in Phase 2 we'll conduct an organizational boundary test for each."
        )
    bot_messages.append("Does your company have any international operations? (yes/no)")
    return {
        'next_step': 'C2',
        'message': f"Subsidiaries: {has_sub}",
        'warnings': [],
        'bot_messages': bot_messages
    }


def handle_C2(report, data):
    has_intl = data['has_international']
    report.has_international = has_intl
    report.company.has_overseas_operations = has_intl
    report.company.save()
    report.save()
    bot_messages = []
    if has_intl:
        bot_messages.append(
            "ℹ️ International operations detected — country-specific emission factors will be applied for each facility."
        )
    bot_messages.append("Does your company have any franchise agreements or joint ventures? (yes/no)")
    return {
        'next_step': 'C3',
        'message': f"International: {has_intl}",
        'warnings': [],
        'bot_messages': bot_messages
    }


def handle_C3(report, data):
    has_jv = data['has_jv_franchise']
    report.has_jv_franchise = has_jv
    report.save()
    bot_messages = []
    if has_jv:
        bot_messages.append(
            "ℹ️ Franchise/JV detected — an operational control test will be added in Phase 2."
        )
    bot_messages.append(
        "Which emission factor database would you like to use?\n\n"
        "Options: **DEFRA** / **DEFRA_TUIK** / **IPCC_AR6** / **EPA** / **custom**\n\n"
        f"*(Suggested based on your country: **{report.ef_database or 'IPCC_AR6'}**)*"
    )
    return {
        'next_step': 'D1',
        'message': f"JV/Franchise: {has_jv}",
        'warnings': [],
        'bot_messages': bot_messages
    }


def handle_D1(report, data):
    ef_db = data['ef_database']
    report.ef_database = ef_db
    report.ef_custom_source = data.get('ef_custom_source', '')
    report.ef_custom_year = data.get('ef_custom_year')
    report.save()
    warnings = []
    bot_messages = []
    country = (report.company.country_of_headquarters or '').upper()
    if ef_db == 'EPA' and country in ['TR', 'TURKEY']:
        warnings.append('ef_country_mismatch')
        bot_messages.append(
            "⚠️ EPA database is US-based. For Turkish operations, DEFRA or IPCC AR6 may be more appropriate."
        )
    bot_messages.append(f"✅ Emission factor database set to **{ef_db}**.")
    bot_messages.append(
        "ℹ️ This version uses **location-based** Scope 2 methodology. Market-based will be added in a future update."
    )
    bot_messages.append(
        "Which organizational boundary approach will you use?\n\n"
        "Options: **operational_control** *(recommended)* / **financial_control** / **equity_share**"
    )
    return {
        'next_step': 'D3',
        'message': f"EF Database: {ef_db}",
        'warnings': warnings,
        'bot_messages': bot_messages
    }


def handle_D3(report, data):
    approach = data['boundary_approach']
    report.boundary_approach = approach
    report.save()
    labels = {
        'operational_control': 'Operational Control',
        'financial_control': 'Financial Control',
        'equity_share': 'Equity Share',
    }
    return {
        'next_step': 'D4',
        'message': f"Boundary: {approach}",
        'warnings': [],
        'bot_messages': [
            f"✅ Boundary approach: **{labels[approach]}**.",
            "How would you like to determine the scope of your Scope 3 reporting?\n\n"
            "Options: **materiality** *(recommended)* / **full_15** *(all 15 categories)* / **exclude** *(Scope 1 & 2 only)*"
        ]
    }


def handle_D4(report, data):
    approach = data['scope3_approach']
    report.scope3_approach = approach
    report.status = 'in_progress'
    report.save()
    approach_labels = {
        'materiality': 'Materiality Based',
        'full_15': 'Full 15 Categories',
        'exclude': 'Scope 1 & 2 Only',
    }
    return {
        'next_step': 'PHASE2',
        'message': f"Scope 3: {approach}",
        'warnings': [],
        'phase_complete': True,
        'bot_messages': [
            f"✅ Scope 3 approach: **{approach_labels.get(approach, approach)}**.",
            "🎉 **Phase 1 complete!** All company identification information has been saved.",
            "📋 **Summary:**",
            f"• Company: {report.company.legal_entity_name}",
            f"• Reporting year: {report.reporting_year}",
            f"• EF Database: {report.ef_database}",
            f"• Boundary: {report.boundary_approach}",
            f"• Scope 3: {approach}",
            "",
            "Now let's move to **Phase 2** — defining your organizational boundary and facilities."
        ]
    }


HANDLERS = {
    'A1': handle_A1, 'A2': handle_A2, 'A3': handle_A3,
    'A4': handle_A4, 'A5': handle_A5, 'A6': handle_A6,
    'A7': handle_A7, 'A7a': handle_A7a,
    # B order: B3=sector, B1=employees, B2=activity, B4=facilities, B5=location_types, B6=revenue
    'B3': handle_B3, 'B1': handle_B1, 'B2': handle_B2,
    'B4': handle_B4, 'B5': handle_B5, 'B6': handle_B6,
    'C1': handle_C1, 'C2': handle_C2, 'C3': handle_C3,
    'D1': handle_D1, 'D3': handle_D3, 'D4': handle_D4,
}
