"""
Report Summary Builder

Builds the JSON summary returned by GET /api/questionnaire/report/<id>/ —
company info, reporting year, and current emissions totals for a CarbonReport.
"""

import logging
from django.utils import timezone
from emissions.models import EmissionEntry
from django.db.models import Sum

logger = logging.getLogger(__name__)


def build_report_summary(report, user):
    """Build a text summary of the completed report."""
    try:
        # Handle dict-based minimal reports
        if isinstance(report, dict):
            return report

        from companies.utils import get_current_company
        company = get_current_company(user)
        if not company:
            return {
                'status': 'Complete',
                'message': '✅ Questionnaire complete. Set up company to see emissions.'
            }

        # Get emission entries for this company/year
        entries = EmissionEntry.objects.filter(
            company=company,
            year=report.reporting_year or timezone.now().year
        ).select_related('emission_factor')

        total_co2e = entries.aggregate(Sum('calculated_co2e_kg'))['calculated_co2e_kg__sum'] or 0

        summary = {
            'report_id': report.id if hasattr(report, 'id') else None,
            'company': company.legal_entity_name if company else 'Your Company',
            'reporting_year': report.reporting_year if hasattr(report, 'reporting_year') else timezone.now().year,
            'status': 'Questionnaire Complete ✅',
            'total_emissions_kg': float(total_co2e),
            'total_emissions_tonnes': float(total_co2e / 1000),
            'entry_count': entries.count(),
            'message': f"✅ Questionnaire complete for {company.legal_entity_name if company else 'your organization'} ({report.reporting_year or 'current year'}). "
                      f"Ready to log emissions via Chat.\n\n📊 Current Total: {total_co2e/1000:.2f} tCO₂e from {entries.count()} entries",
        }

        return summary

    except Exception as e:
        logger.error(f"Report summary build failed: {e}", exc_info=True)
        return {
            'status': 'Complete ✅',
            'message': '✅ Questionnaire complete! You can now log emissions via Chat or review assumptions.'
        }
