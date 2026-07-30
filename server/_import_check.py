"""Temporary verification helper: imports the whole app with the DB pool
stubbed so every route/query import and name reference is resolved."""

import os
from unittest import mock

os.environ.setdefault("SECRET_KEY", "import-check")
os.environ.setdefault("DATABASE_URL", "postgresql://stub/stub")

import psycopg2.pool  # noqa: E402

with mock.patch.object(psycopg2.pool, "ThreadedConnectionPool", mock.MagicMock()):
    import main  # noqa: F401

rules = sorted(
    f"{sorted(r.methods - {'HEAD', 'OPTIONS'})} {r.rule}"
    for r in main.app.url_map.iter_rules()
)
print(f"IMPORT OK — {len(rules)} routes")
for rule in rules:
    print(" ", rule)
