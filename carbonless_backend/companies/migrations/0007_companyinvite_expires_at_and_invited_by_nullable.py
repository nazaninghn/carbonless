"""
Fix #30: Add CompanyInvite.expires_at so invites expire after 7 days.
Fix #31: CompanyInvite.invited_by changes from CASCADE to SET_NULL so deleting
the inviter doesn't cascade-delete the invite (recipients already have the
token URL in their email — it should remain valid after the inviter leaves).
"""
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('companies', '0006_companyinvite'),
    ]

    operations = [
        # Fix #31 — invited_by: CASCADE → SET_NULL
        migrations.AlterField(
            model_name='companyinvite',
            name='invited_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='sent_invites',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        # Fix #30 — add expires_at (nullable for backward compat with existing rows)
        migrations.AddField(
            model_name='companyinvite',
            name='expires_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
