from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Fix #76: Add composite indexes for the two hot query paths:

      • list_sessions  → ChatSession.filter(user=…).order_by('-updated_at')
      • send_message   → ChatMessage.filter(session=…).order_by('-created_at')[:20]

    Without these, both queries do a full-table scan as the message/session
    count grows, doubling API latency on every chat turn.
    """

    dependencies = [
        ('chat', '0001_initial'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='chatsession',
            index=models.Index(
                fields=['user', '-updated_at'],
                name='chat_session_user_updated_idx',
            ),
        ),
        migrations.AddIndex(
            model_name='chatmessage',
            index=models.Index(
                fields=['session', '-created_at'],
                name='chat_msg_session_created_idx',
            ),
        ),
    ]
