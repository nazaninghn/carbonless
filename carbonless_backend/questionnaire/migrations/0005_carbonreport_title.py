from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("questionnaire", "0004_workspace_reportfield"),
    ]

    operations = [
        migrations.AddField(
            model_name="carbonreport",
            name="title",
            field=models.CharField(blank=True, default="", max_length=200),
        ),
    ]
