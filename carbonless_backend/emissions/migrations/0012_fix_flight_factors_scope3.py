from django.db import migrations

FLIGHT_SLUGS = [
    "flight-domestic",
    "flight-short",
    "flight-medium",
    "flight-long",
]


def fix_flight_factors_scope3(apps, schema_editor):
    EmissionFactor = apps.get_model("emissions", "EmissionFactor")

    EmissionFactor.objects.filter(
        slug__in=FLIGHT_SLUGS,
    ).update(
        scope="scope3",
        category="business_travel",
    )


def reverse_flight_factors_scope3(apps, schema_editor):
    # Safe reverse: do nothing.
    # We do not want to accidentally put factors back into the wrong scope.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("emissions", "0011_add_processing_sold_use_of_sold_categories"),
    ]

    operations = [
        migrations.RunPython(
            fix_flight_factors_scope3,
            reverse_flight_factors_scope3,
        ),
    ]
