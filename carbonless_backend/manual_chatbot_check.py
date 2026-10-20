import os
import sys
import json
import requests

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'carbonless_api.settings')
import django
django.setup()

from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth.models import User

# Get token
admin = User.objects.get(username='admin')
refresh = RefreshToken.for_user(admin)
token = str(refresh.access_token)

BASE_URL = "http://localhost:8000/api/questionnaire"
headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json"
}

print("\n" + "="*60)
print("🧪 Testing Questionnaire Chatbot API")
print("="*60)

# Test 1: Start Report
print("\n\n📝 Test 1: POST /api/questionnaire/start/")
print("-" * 60)
try:
    response = requests.post(
        f"{BASE_URL}/start/",
        json={"company_id": 2},
        headers=headers
    )
    print(f"Status: {response.status_code}")
    result = response.json()
    print(json.dumps(result, indent=2, ensure_ascii=False))
    
    if response.status_code in [200, 201]:
        report_id = result.get('report_id')
        print(f"\n✅ Report created/resumed: {report_id}")
        
        # Test 2: Submit Step A1
        print("\n\n📝 Test 2: PATCH /api/questionnaire/{report_id}/step/")
        print("-" * 60)
        
        step_data = {
            "step": "A1",
            "data": {
                "legal_name": "Carbonless Test Company"
            }
        }
        
        response2 = requests.patch(
            f"{BASE_URL}/{report_id}/step/",
            json=step_data,
            headers=headers
        )
        
        print(f"Status: {response2.status_code}")
        result2 = response2.json()
        print(json.dumps(result2, indent=2, ensure_ascii=False))
        
        if response2.status_code == 200:
            print(f"\n✅ Step A1 submitted successfully!")
            print(f"Next step: {result2.get('next_step')}")
            print(f"Bot messages: {result2.get('bot_messages')}")
            
            # Test 3: Get Report Status
            print("\n\n📝 Test 3: GET /api/questionnaire/{report_id}/")
            print("-" * 60)
            
            response3 = requests.get(
                f"{BASE_URL}/{report_id}/",
                headers=headers
            )
            
            print(f"Status: {response3.status_code}")
            result3 = response3.json()
            print(json.dumps(result3, indent=2, ensure_ascii=False))
            
            if response3.status_code == 200:
                print(f"\n✅ Report status retrieved!")
                print(f"Progress: {result3.get('progress')}")
except Exception as e:
    print(f"❌ Error: {str(e)}")
    import traceback
    traceback.print_exc()

print("\n" + "="*60)
print("✅ Tests completed!")
print("="*60)
