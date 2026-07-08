"""
Report Generation from Completed Questionnaire Sessions

When a questionnaire completes, this module:
1. Extracts structured data from answers
2. Creates/updates CarbonReport
3. Generates summary with recommendations
4. Triggers dashboard sync
"""

import logging
from django.utils import timezone
from questionnaire.models import CarbonReport, ReportStep
from emissions.models import EmissionEntry
from django.db.models import Sum

logger = logging.getLogger(__name__)


def generate_report_from_session(session, user):
    """
    Generate a CarbonReport when QuestionnaireSession completes.

    Args:
        session: Completed QuestionnaireSession instance
        user: User who completed the survey

    Returns:
        CarbonReport instance (created or updated)
    """
    try:
        from companies.utils import get_current_company
        company = get_current_company(user)
        if not company:
            logger.warning(f"No company found for user {user.id}")
            return None

        # Extract key data from answers
        answers = session.answers or {}

        # Try to find existing report for this year
        reporting_year = extract_reporting_year(answers)
        report = CarbonReport.objects.filter(
            company=company,
            reporting_year=reporting_year,
            status=CarbonReport.Status.COMPLETED
        ).first()

        if not report:
            # Create new report
            report = CarbonReport.objects.create(
                company=company,
                created_by=user,
                status=CarbonReport.Status.COMPLETED,
                reporting_year=reporting_year,
                current_step='COMPLETED',
                ef_database=extract_ef_database(answers),
                boundary_approach=extract_boundary_approach(answers),
                scope3_approach=extract_scope3_approach(answers),
                has_previous_report=extract_previous_report(answers),
                baseline_year=extract_baseline_year(answers),
                purposes=extract_purposes(answers),
            )
            logger.info(f"Created CarbonReport {report.id} for company {company.id}")

        # Generate report summary
        summary = build_report_summary(report, user)

        # Trigger dashboard sync
        try:
            from chat.dashboard_sync import notify_dashboard_entry_saved
            notify_dashboard_entry_saved(user.id, None)
        except Exception as e:
            logger.warning(f"Dashboard sync failed: {e}")

        return report

    except Exception as e:
        logger.error(f"Report generation failed: {e}")
        return None


def extract_reporting_year(answers):
    """Extract reporting year from questionnaire answers."""
    # S1 contains period information
    s1_data = answers.get('S1', {})
    if isinstance(s1_data, dict):
        # Try to extract year from input
        year_input = s1_data.get('input')
        if year_input and isinstance(year_input, int):
            return year_input
    return timezone.now().year


def extract_ef_database(answers):
    """Extract emission factor database preference."""
    s7_data = answers.get('S7', {})
    if isinstance(s7_data, dict):
        selected = s7_data.get('selected')
        if selected == 'C7.1':
            return 'DEFRA_TUIK'  # National sources
        elif selected == 'C7.2':
            return 'DEFRA'
        elif selected == 'C7.3':
            return 'IPCC_AR6'
    return 'DEFRA'


def extract_boundary_approach(answers):
    """Extract organizational boundary approach."""
    # Check answers for boundary-related questions
    return 'operational_control'  # Default


def extract_scope3_approach(answers):
    """Extract Scope 3 approach preference."""
    return 'materiality'  # Default


def extract_previous_report(answers):
    """Check if company has previous carbon reports."""
    s3_data = answers.get('S3', {})
    if isinstance(s3_data, dict):
        selected = s3_data.get('selected')
        if selected == 'C3.1':
            return True
        elif selected == 'C3.2':
            return False
    return None


def extract_baseline_year(answers):
    """Extract baseline year if set."""
    s4_data = answers.get('S4', {})
    if isinstance(s4_data, dict):
        year_input = s4_data.get('input')
        if year_input and isinstance(year_input, int):
            return year_input
    return None


def extract_purposes(answers):
    """Extract reporting purposes."""
    s5_data = answers.get('S5', {})
    if isinstance(s5_data, dict):
        selected = s5_data.get('selected', [])
        if isinstance(selected, list):
            return selected
    return []


def build_report_summary(report, user):
    """Build a text summary of the completed report."""
    try:
        from companies.utils import get_current_company
        company = get_current_company(user)

        # Get emission entries for this company/year
        entries = EmissionEntry.objects.filter(
            company=company,
            year=report.reporting_year or timezone.now().year
        ).select_related('emission_factor')

        total_co2e = entries.aggregate(Sum('calculated_co2e_kg'))['calculated_co2e_kg__sum'] or 0

        summary = {
            'report_id': report.id,
            'company': company.legal_entity_name,
            'reporting_year': report.reporting_year,
            'status': 'Questionnaire Complete',
            'total_emissions_kg': float(total_co2e),
            'total_emissions_tonnes': float(total_co2e / 1000),
            'entry_count': entries.count(),
            'message': f"✅ Questionnaire setup complete for {company.legal_entity_name} ({report.reporting_year or 'current year'}). "
                      f"Ready to log emissions via Chat. Current total: {total_co2e/1000:.2f} tCO₂e",
        }

        return summary

    except Exception as e:
        logger.error(f"Report summary build failed: {e}")
        return {
            'status': 'Complete',
            'message': '✅ Questionnaire setup complete. You can now log emissions via Chat.'
        }
