from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


class Subscription(models.Model):
    """User subscription — tracks Stripe billing state"""

    class Plan(models.TextChoices):
        FREE = 'free', 'Free'
        PRO = 'pro', 'Pro'

    class Status(models.TextChoices):
        ACTIVE = 'active', 'Active'
        CANCELED = 'canceled', 'Canceled'
        PAST_DUE = 'past_due', 'Past Due'
        TRIALING = 'trialing', 'Trialing'
        INCOMPLETE = 'incomplete', 'Incomplete'

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='subscription')
    plan = models.CharField(max_length=10, choices=Plan.choices, default=Plan.FREE)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)

    # Stripe IDs
    stripe_customer_id = models.CharField(max_length=100, blank=True, db_index=True)
    stripe_subscription_id = models.CharField(max_length=100, blank=True, db_index=True)
    stripe_price_id = models.CharField(max_length=100, blank=True)

    # Billing period
    current_period_start = models.DateTimeField(null=True, blank=True)
    current_period_end = models.DateTimeField(null=True, blank=True)
    cancel_at_period_end = models.BooleanField(default=False)

    # Usage tracking
    ai_messages_this_month = models.IntegerField(default=0)
    ai_messages_reset_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} — {self.plan} ({self.status})"

    @property
    def is_pro(self):
        return self.plan == self.Plan.PRO and self.status in (
            self.Status.ACTIVE, self.Status.TRIALING
        )

    @property
    def ai_message_limit(self):
        """Monthly AI message limit based on plan"""
        if self.is_pro:
            return 999999  # Unlimited
        return 5  # Free plan: 5 messages/month

    @property
    def can_send_ai_message(self):
        """Check if user can send another AI message"""
        self._reset_monthly_counter_if_needed()
        return self.ai_messages_this_month < self.ai_message_limit

    def increment_ai_usage(self):
        """Record an AI message usage"""
        self._reset_monthly_counter_if_needed()
        self.ai_messages_this_month += 1
        self.save(update_fields=['ai_messages_this_month'])

    def _reset_monthly_counter_if_needed(self):
        """Reset counter on the 1st of each month"""
        now = timezone.now()
        if not self.ai_messages_reset_at or self.ai_messages_reset_at.month != now.month:
            self.ai_messages_this_month = 0
            self.ai_messages_reset_at = now
            self.save(update_fields=['ai_messages_this_month', 'ai_messages_reset_at'])

    @property
    def can_generate_report(self):
        return self.is_pro

    @property
    def can_use_questionnaire(self):
        return self.is_pro

    class Meta:
        ordering = ['-created_at']
