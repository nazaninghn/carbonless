from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('questionnaire', '0012_one_inventory_per_year')]
    operations = [migrations.AddField(
        model_name='carbonreport', name='applied_factors',
        field=models.JSONField(blank=True, default=dict, null=True))]
