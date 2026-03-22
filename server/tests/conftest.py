import pytest
from main import app

@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client
    

@pytest.fixture
def make_user(client):
    created = []

    def _make(first_name, last_name, email, username, password):
        res = client.post("/users", json={
            "first_name": first_name,
            "last_name": last_name,
            "email": email,
            "username": username,
            "password": password,
        })
        user = res.get_json()

        # log in to get a token
        login_res = client.post("/auth/login", json={
            "email": email,
            "password": password
        })
        token = login_res.get_json()["data"]["token"]  # adjust to your response shape
        user["token"] = token

        created.append(user)
        return user

    yield _make

    for user in created:
        if user.get("data") and user["data"].get("id"):
            client.delete(
                f"/users/{user['data']['id']}",
                headers={"Authorization": f"Bearer {user['token']}"}
            )