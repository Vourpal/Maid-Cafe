import jwt
import datetime
#think i have to put this in an env file?
SECRET_KEY = "a8f3c9e1b7d4f6a2c1e9d8b3f4a6c7e1"

def create_token(user_id: int):
    payload = {
        "user_id": user_id,
        "exp": datetime.datetime.now() + datetime.timedelta(days=1)
    }

    token  = jwt.encode(payload, SECRET_KEY, algorithms=["HS256"])
    return token

def verify_token (token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload["user_id"]
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None