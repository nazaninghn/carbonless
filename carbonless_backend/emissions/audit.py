"""
Company change-history rows (Settings → Geçmiş) for what is not an emission
entry edited by hand: inventory answers, their approval, a finished
inventory and reduction targets.

The text is stored in both languages (metadata detail_tr / detail_en) since
it is built from question labels and summaries that already exist in both;
`company_history` shows the reader's one.
"""
import logging

logger = logging.getLogger(__name__)


def log_company_activity(user, company_id, action, detail_tr, detail_en,
                         target_type='', target_id='', request=None, **extra):
    """One history row; never lets a failure break what is being saved."""
    try:
        from accounts.models import ActivityLog
        ActivityLog.objects.create(
            user=user if getattr(user, 'pk', None) else None, action=action, detail=detail_en,
            ip_address=request.META.get('REMOTE_ADDR') if request is not None else None,
            target_type=target_type, target_id=str(target_id or ''),
            metadata={'company_id': company_id, 'detail_tr': detail_tr, 'detail_en': detail_en, **extra},
        )
    except Exception:
        logger.exception('Could not write a company history row (%s)', action)


def answer_text(year, step, entries, lang):
    """'2025 envanteri · Soru 68 · Elektrik · 150.000 kWh' — the answer's rows
    in the words the approval notice uses."""
    from questionnaire.step_entries import question_label
    from .notifications import _summary
    where = f'{year} envanteri · {question_label(step, "tr")}' if lang == 'tr' \
        else f'{year} inventory · {question_label(step, "en")}'
    entries = list(entries)
    return f'{where} · {_summary(entries, lang)}' if entries else where


def log_answer_change(user, company, year, step, before, after, status_after):
    """An inventory answer changed what it reports: before → after."""
    from .notifications import _summary
    texts = {}
    for lang in ('tr', 'en'):
        head = answer_text(year, step, [], lang)
        old = _summary(before, lang) if before else ''
        new = _summary(after, lang) if after else ''
        if old and new:
            body = f'{old} → {new}'
        elif new:
            body = new
        else:
            body = f'{old} → ' + ('kaldırıldı' if lang == 'tr' else 'removed')
        texts[lang] = f'{head} · {body}'
    log_company_activity(user, company.pk, 'questionnaire_changed', texts['tr'], texts['en'],
                         target_type='CarbonReport', target_id=f'{year}-{step}',
                         status_after=status_after)
