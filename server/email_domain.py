import requests
import os
import resend
from dotenv import load_dotenv


load_dotenv()

RESEND_KEY = os.getenv("RESEND_KEY")

response = requests.post(
    "https://api.resend.com/domains",
    headers={
        "Authorization": f"Bearer {RESEND_KEY}",
        "Content-Type": "application/json",
    },
    json={"name": "mail.yourdomain.com"},
)

print(response.status_code)
print(response.json())
