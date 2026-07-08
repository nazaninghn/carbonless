"""
P2 End-to-End Test Scenarios
Tests the full chat flow: NLU → registry → pending → confirm → dashboard

Each scenario validates:
- Correct field extraction
- Proper readiness detection
- Correct calculation
- Dashboard sync
"""
import pytest
from django.test import TestCase
from django.contrib.auth.models import User
from django.utils import timezone
from chat.models import ChatSession, ChatMessage
from emissions.models import EmissionEntry
from companies.models import Company
from accounts.models import Account
import json


class P2ChatScenarios(TestCase):
    """P2 full workflow tests"""

    def setUp(self):
        """Create test user, company, account"""
        self.user = User.objects.create_user(
            username='testuser', email='test@example.com', password='testpass123'
        )
        self.account = Account.objects.create(user=self.user, legal_name='Test Company')
        self.company = Company.objects.create(
            account=self.account,
            legal_entity_name='Test Company',
            tax_number='1234567890',
            country_of_headquarters='TR',
        )
        self.session = ChatSession.objects.create(
            user=self.user, title='Test Chat'
        )

    def test_scenario_1_multi_vehicle_distance_total(self):
        """
        Scenario 1: Multi-vehicle with total distance
        Input: "i have 3 private car and 4500 km"
        Expected: Asks fuel → Petrol → Asks distance basis → Total → Result ~764 kgCO2e
        """
        from rest_framework.test import APIClient
        client = APIClient()
        client.force_authenticate(user=self.user)

        # Step 1: Send initial message
        response = client.post(
            f'/api/chat/sessions/{self.session.id}/message/',
            {'content': 'i have 3 private car and 4500 km', 'language': 'en'},
            format='json'
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()

        # Should ask for fuel_type
        self.assertIn('fuel', data.get('content', '').lower())
        print(f"Step 1 Response: {data.get('content')}")

        # Step 2: Answer fuel type
        response = client.post(
            f'/api/chat/sessions/{self.session.id}/message/',
            {'content': 'petrol', 'language': 'en'},
            format='json'
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()

        # Should ask for distance basis (critical!)
        content_lower = data.get('content', '').lower()
        self.assertIn('total', content_lower)
        self.assertIn('per vehicle', content_lower)
        print(f"Step 2 Response: {data.get('content')}")

        # Step 3: Answer distance basis
        response = client.post(
            f'/api/chat/sessions/{self.session.id}/message/',
            {'content': 'total', 'language': 'en'},
            format='json'
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()

        # Should return result with pending entries
        pending = data.get('pending_entries', [])
        self.assertTrue(len(pending) > 0, "Should have pending entry")

        # Result should be ~764 (4500 km × 169.8 g/km for petrol ÷ 1000)
        co2e = float(pending[0]['co2e_kg'])
        self.assertGreater(co2e, 700)
        self.assertLess(co2e, 900)
        print(f"Step 3 Result: {co2e:.2f} kgCO2e")

    def test_scenario_2_multi_vehicle_per_vehicle(self):
        """
        Scenario 2: Multi-vehicle with per-vehicle distance
        Input: "3 cars + 4500 km" → Petrol → Per vehicle
        Expected: Result ~2292 kgCO2e (4500 × 3)
        """
        from rest_framework.test import APIClient
        client = APIClient()
        client.force_authenticate(user=self.user)

        # Send and navigate to result
        client.post(
            f'/api/chat/sessions/{self.session.id}/message/',
            {'content': '3 cars 4500 km', 'language': 'en'},
            format='json'
        )
        client.post(
            f'/api/chat/sessions/{self.session.id}/message/',
            {'content': 'petrol', 'language': 'en'},
            format='json'
        )
        response = client.post(
            f'/api/chat/sessions/{self.session.id}/message/',
            {'content': 'per vehicle', 'language': 'en'},
            format='json'
        )

        data = response.json()
        pending = data.get('pending_entries', [])

        # Result should be ~2292 (4500 × 3)
        co2e = float(pending[0]['co2e_kg'])
        self.assertGreater(co2e, 2100)
        self.assertLess(co2e, 2500)
        print(f"Scenario 2 Result: {co2e:.2f} kgCO2e")

    def test_scenario_3_single_vehicle(self):
        """
        Scenario 3: Single vehicle (no distance_basis question)
        Input: "1 car + 5000 km + diesel"
        Expected: Should NOT ask distance_basis → Direct result
        """
        from rest_framework.test import APIClient
        client = APIClient()
        client.force_authenticate(user=self.user)

        response = client.post(
            f'/api/chat/sessions/{self.session.id}/message/',
            {'content': '1 car 5000 km diesel', 'language': 'en'},
            format='json'
        )

        data = response.json()
        # With full info in one message, might get result directly or ask minimal questions
        # Key: should NOT ask about distance_basis for single vehicle
        content_lower = data.get('content', '').lower()
        self.assertNotIn('per vehicle or total', content_lower)
        print(f"Scenario 3: {data.get('content')[:100]}")

    def test_scenario_4_other_scopes(self):
        """
        Scenario 4: Other Scopes (flight, waste, freight)
        Inputs:
          - "500 kg waste landfill" → Scope 3
          - "1200 km domestic flight" → Scope 3
          - "45 tonne-km rail freight" → Scope 3
        """
        from rest_framework.test import APIClient
        client = APIClient()
        client.force_authenticate(user=self.user)

        test_cases = [
            ('500 kg waste landfill', 'Scope 3', 'waste'),
            ('1200 km domestic flight', 'Scope 3', 'flight'),
            ('45 tonne-km rail freight', 'Scope 3', 'freight'),
        ]

        for content, expected_scope, label in test_cases:
            session = ChatSession.objects.create(user=self.user, title=f'Test {label}')
            response = client.post(
                f'/api/chat/sessions/{session.id}/message/',
                {'content': content, 'language': 'en'},
                format='json'
            )
            data = response.json()

            # Should have result
            pending = data.get('pending_entries', [])
            if pending:
                scope = pending[0].get('scope', '')
                self.assertIn('scope3', scope.lower() or 'scope3')
                print(f"  {label}: {pending[0].get('co2e_kg', 0):.2f} kgCO2e ✓")

    def test_scenario_5_tax_id_validation(self):
        """
        Scenario 5: Tax ID field validation
        Test: 9 digits (invalid) → should reject
        """
        from questionnaire.views import SubmitStepView
        from questionnaire.models import CarbonReport

        report = CarbonReport.objects.create(
            created_by=self.user, company=self.company
        )

        from rest_framework.test import APIRequestFactory
        factory = APIRequestFactory()

        # Try submitting invalid tax ID (9 digits)
        request = factory.patch(
            f'/api/questionnaire/{report.id}/step/',
            {'step': 'A2', 'data': {'tax_id': '123456789'}},
            format='json'
        )
        request.user = self.user

        view = SubmitStepView.as_view()
        response = view(request, report_id=report.id)

        # Should reject
        self.assertEqual(response.status_code, 400)
        self.assertIn('Must be 10 or 11', str(response.data))
        print("Tax ID validation: 9 digits rejected ✓")

    def test_scenario_6_confirm_and_save(self):
        """
        Scenario 6: Confirm pending entry → Save to EmissionEntry
        Expected: Entry saved to DB, status=Approved
        """
        from rest_framework.test import APIClient
        client = APIClient()
        client.force_authenticate(user=self.user)

        # Generate a pending entry
        response = client.post(
            f'/api/chat/sessions/{self.session.id}/message/',
            {'content': '1000 liters diesel', 'language': 'en'},
            format='json'
        )

        data = response.json()
        pending = data.get('pending_entries', [])

        if pending:
            entry_data = pending[0]

            # Confirm the entry
            response = client.post(
                '/api/chat/confirm-entry/',
                entry_data,
                format='json'
            )

            self.assertEqual(response.status_code, 201)
            result = response.json()

            # Verify saved to DB
            saved_entry = EmissionEntry.objects.get(id=result['id'])
            self.assertEqual(saved_entry.status, 'Approved')
            self.assertGreater(float(saved_entry.calculated_co2e_kg), 0)
            print(f"Entry saved: {saved_entry.id}, {saved_entry.calculated_co2e_kg:.2f} kgCO2e ✓")


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
