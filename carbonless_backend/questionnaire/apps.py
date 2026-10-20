from django.apps import AppConfig

class QuestionnaireConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'questionnaire'

    def ready(self):
        from . import signals  # noqa: F401  (registers the Facility pre_save receiver)
