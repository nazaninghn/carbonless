"""Questions the user marked "I don't know — answer later".

Adds `CarbonReport.pending_questions`, a nullable JSON list of question (step) ids.
Additive only: no existing row, answer, status or entry is touched, and NULL (what
instances still running the previous code insert) means the same as an empty list.
Reverse drops the column.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('questionnaire', '0012_one_inventory_per_year'),
    ]

    operations = [
        migrations.AddField(
            model_name='carbonreport',
            name='pending_questions',
            field=models.JSONField(blank=True, default=list, null=True),
        ),
    ]
