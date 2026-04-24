def test_login_returns_token_and_me_with_bearer(client):
    r = client.post("/api/auth/session", json={"email": "token_user@example.test"})
    assert r.status_code == 200
    data = r.json()
    assert "token" in data and data["token"]

    r2 = client.get("/api/me", headers={"Authorization": f"Bearer {data['token']}"})
    assert r2.status_code == 200
    body = r2.json()
    assert body["email"] == "token_user@example.test"


def test_me_401_without_bearer(client):
    r = client.get("/api/me")
    assert r.status_code == 401


def test_logout_revokes_token(client):
    r = client.post("/api/auth/session", json={"email": "logout_user@example.test"})
    tok = r.json()["token"]
    r_del = client.delete("/api/auth/session", headers={"Authorization": f"Bearer {tok}"})
    assert r_del.status_code == 204
    r_me = client.get("/api/me", headers={"Authorization": f"Bearer {tok}"})
    assert r_me.status_code == 401
