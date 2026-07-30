-- ================================================================
-- Migration 001 — Admin feature set
--
-- Adds the audit log, gives tasks a created_at for stable ordering,
-- and indexes the columns the new admin reports filter/sort on.
--
-- Apply with:
--   psql "$DATABASE_URL" -f migrations/001_admin_features.sql
--
-- Safe to run more than once (all statements are idempotent).
-- ================================================================

-- ======================
-- AUDIT LOG
-- ======================
-- actor_label is denormalised on purpose: if the acting user is later
-- deleted, the log still shows who performed the action.
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    actor_label VARCHAR(150),
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INTEGER,
    summary VARCHAR(255),
    changes JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at
    ON audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity
    ON audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor
    ON audit_log (actor_id);

-- ======================
-- TASKS
-- ======================
ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks (assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_event_id ON tasks (event_id);
CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks (completed);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks (due_date);

-- ======================
-- REPORTING INDEXES
-- ======================
CREATE INDEX IF NOT EXISTS idx_practices_user_id ON practices (user_id);
CREATE INDEX IF NOT EXISTS idx_practices_session_id
    ON practices (practice_session_id);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_date
    ON practice_sessions (date);
CREATE INDEX IF NOT EXISTS idx_attendances_event_id ON attendances (event_id);
CREATE INDEX IF NOT EXISTS idx_attendances_user_id ON attendances (user_id);
