import pytest

@pytest.mark.parametrize(
    "first_name, last_name, email, username, password",
    [
        ("Bruno", "Oros", "BrunoOros@hotmail.com", "brunooros", "mabi"),
        ("Lully", "Lullerson", "LullyLullerson@gmail.com", "lullylullerson", "racism"),
    ],
)
def test_login_success(
    client, make_user, first_name, last_name, email, username, password
):
    make_user(first_name, last_name, email, username, password)

    res = client.post("/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200
    assert res.get_json()["success"]

def test_signup(client, make_user):
    users = [
        make_user(
            f"Bruno{i}", f"Oros{i}", f"test{i}@test.com", f"user{i}", f"password{i}"
        )
        for i in range(3)
    ]

    for user in users:
        assert user["success"] is True
        assert "id" in user["data"]


@pytest.mark.parametrize(
    "first_name, last_name, email, username, password",
    [
        ("Bruno", "Oros", "BrunoOros@hotmail.com", "brunooros", "mabi"),
        ("Lully", "Lullerson", "LullyLullerson@gmail.com", "lullylullerson", "racism"),
    ],
)
def test_user_info(client,make_user, first_name, last_name, email, username, password):
    user = make_user(first_name,last_name,email,username,password)

    res = client.get(f"/users/{user["data"]["id"]}")

    assert res.status_code == 200


def test_user_not_found(client):

    res = client.get("/users/999999")

    assert res.status_code == 404

def test_duplicate_email(client, make_user):
    make_user("Bruno", "Oros", "bruno@test.com", "brunooros", "abc123")
    res = client.post("/users", json={
        "first_name": "Bruno",
        "last_name": "Oros",
        "email": "bruno@test.com",      # same email
        "username": "differentusername", # different username
        "password": "abc123"
    })
    assert res.status_code == 409
    assert res.get_json()["error"]["code"] == "DUPLICATE_EMAIL"



@pytest.mark.parametrize("missing_field", [
    "first_name",
    "last_name", 
    "email",
    "username",
    "password",
])
def test_missing_field(client, missing_field):
    data = {
        "first_name": "Bruno",
        "last_name": "Oros",
        "email": "bruno@test.com",
        "username": "brunooros",
        "password": "abc123",
    }
    del data[missing_field]  # remove one field at a time
    
    res = client.post("/users", json=data)
    assert res.status_code == 422