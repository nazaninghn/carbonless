"""Small display helpers shared by the admin lists (styles: static/css/admin-theme.css)."""
from django.utils import timezone
from django.utils.html import format_html

SCOPE_TONE = {'scope1': 'ink', 'scope2': 'lime', 'scope3': 'soft'}
STATUS_TONE = {'pending': 'wait', 'approved': 'ok', 'rejected': 'no', 'submitted': 'wait', 'draft': 'soft'}


def tag(text, tone='soft'):
    """A pill label; `tone` is one of ink, lime, soft, wait, ok, no, late."""
    return format_html('<span class="cl-tag is-{}">{}</span>', tone, text)


def scope_tag(scope):
    return tag((scope or '').replace('scope', 'Scope '), SCOPE_TONE.get(scope, 'soft'))


def status_tag(status, label=None):
    return tag(label or str(status).replace('_', ' ').capitalize(), STATUS_TONE.get(status, 'soft'))


def waited(created, still_open=True):
    """How long an item has been waiting ("3 d", "5 h"); red from the seventh day while it is still open."""
    if not created:
        return '—'
    delta = timezone.now() - created
    hours = int(delta.total_seconds() // 3600)
    text = f'{delta.days} d' if delta.days >= 1 else f'{hours} h' if hours else '< 1 h'
    return tag(text, 'late' if still_open and delta.days >= 7 else 'soft')
