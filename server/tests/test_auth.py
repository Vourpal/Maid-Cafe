import pytest


def test_home(client):
    res = client.get("/")
    assert res.status_code == 200

    data = res.get_json()
    assert data["success"]





