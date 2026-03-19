import jwt
import datetime
import os
from dotenv import load_dotenv # type: ignore

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")

def create_token(user_id: int, remember_me: bool):
    days = 30 if remember_me else 1
    payload = {
        "user_id": user_id,
        "exp": datetime.datetime.now() + datetime.timedelta(days=days)
    }

    token  = jwt.encode(payload, SECRET_KEY, algorithm="HS256")

    if isinstance(token,bytes):
        token = token.decode("utf-8")
    return token

def verify_token (token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload["user_id"]
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None