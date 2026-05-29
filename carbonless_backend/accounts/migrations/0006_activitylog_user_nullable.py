"""
Fix #25: Make ActivityLog.user nullable (SET_NULL) so audit records survive
user deletion.  The previous CASCADE silently destroyed the entire audit trail
the moment user.delete() was called — including the 'account_deleted' log entry
that was written immediately before the delete.

Also adds 'account_deleted' to ACTION_CHOICES (model-level change only — choices
are not stored in the DB schema so no separate SQL operation is needed).
"""
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('accounts', '0005_userprofile_language_preference_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='activitylog',
            name='user',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='activity_logs',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
