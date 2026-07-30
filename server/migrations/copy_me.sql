-- ============================================================================
--  MAID-CAFE — ADMIN FEATURE SET
--  Copy this entire file into a DBeaver SQL Editor and run it with
--  Execute Script  (Alt+X).   NOT Ctrl+Enter — that only runs one statement.
--
--  Safe to run as many times as you like:
--    * every statement is guarded with IF NOT EXISTS
--    * nothing is dropped, renamed, or overwritten
--    * no existing rows are modified
--    * the whole thing runs in one transaction, so it either fully
--      applies or fully rolls back
--
--  After it finishes, scroll to the bottom for the verification result.
-- ============================================================================

BEGIN;


-- ============================================================================
--  SECTION 1 — SAFETY NET
--  Columns the new admin dashboard and staff directory read. These are all
--  already in schema.sql, so on an up-to-date database every statement here
--  is a no-op. They exist so this file also works on an older database that
--  never had the newer columns applied.
-- ============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS active     BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS admin      BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS type       VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS availability JSONB DEFAULT '{}'::jsonb;

-- maid/butler constraint, added only if it is not already present.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'user_type_check'
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT user_type_check
            CHECK (type IN ('maid', 'butler') OR type IS NULL);
    END IF;
END $$;

ALTER TABLE events      ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'draft';
ALTER TABLE attendances ADD COLUMN IF NOT EXISTS notes           VARCHAR(255);
ALTER TABLE attendances ADD COLUMN IF NOT EXISTS role            VARCHAR(10);
ALTER TABLE attendances ADD COLUMN IF NOT EXISTS seats_available INT;
ALTER TABLE practices   ADD COLUMN IF NOT EXISTS late  BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE practices   ADD COLUMN IF NOT EXISTS notes VARCHAR;


-- ============================================================================
--  SECTION 2 — TASKS
--  The tasks table is defined in schema.sql but never had any routes, so it
--  may not exist in this database yet. The task feature needs it, plus a
--  created_at column for stable ordering.
-- ============================================================================

CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    assigned_to INTEGER,
    created_by INTEGER NOT NULL,
    due_date TIMESTAMP,
    event_id INTEGER,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    FOREIGN KEY (created_by)  REFERENCES users(id),
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (event_id)    REFERENCES events(id) ON DELETE CASCADE
);

-- Covers the case where tasks already existed without created_at.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();


-- ============================================================================
--  SECTION 3 — AUDIT LOG
--  Required. Every administrative mutation writes a row here, so without
--  this table creating an event, editing a member, assigning a task, etc.
--  will fail.
--
--  actor_label is denormalised deliberately: if the acting admin is deleted
--  later, the log still shows who made the change.
--  changes holds a {field: {from, to}} diff as JSONB.
-- ============================================================================

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


-- ============================================================================
--  SECTION 4 — LINKS TITLE COLUMN
--  Pre-existing bug, unrelated to the admin work: link_queries.py reads and
--  writes links.title, but schema.sql never defined it. No-op if the column
--  was already added by hand.
-- ============================================================================

ALTER TABLE links ADD COLUMN IF NOT EXISTS title TEXT;


-- ============================================================================
--  SECTION 5 — INDEXES
--  Performance only. The reliability reports join practices against
--  practice_sessions and attendances against events for every member, and
--  the audit log is always ordered by recency.
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity     ON audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor      ON audit_log (actor_id);

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks (assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_event_id    ON tasks (event_id);
CREATE INDEX IF NOT EXISTS idx_tasks_completed   ON tasks (completed);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date    ON tasks (due_date);

CREATE INDEX IF NOT EXISTS idx_practices_user_id      ON practices (user_id);
CREATE INDEX IF NOT EXISTS idx_practices_session_id   ON practices (practice_session_id);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_date ON practice_sessions (date);
CREATE INDEX IF NOT EXISTS idx_attendances_event_id   ON attendances (event_id);
CREATE INDEX IF NOT EXISTS idx_attendances_user_id    ON attendances (user_id);
CREATE INDEX IF NOT EXISTS idx_links_category         ON links (category);


COMMIT;


-- ============================================================================
--  VERIFICATION
--  Every column below should read TRUE. Anything FALSE means that statement
--  did not run — almost always because Ctrl+Enter was used instead of Alt+X.
-- ============================================================================

SELECT
    to_regclass('public.audit_log') IS NOT NULL AS audit_log_exists,
    to_regclass('public.tasks')     IS NOT NULL AS tasks_exists,
    EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_name = 'tasks' AND column_name = 'created_at') AS tasks_created_at,
    EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_name = 'users' AND column_name = 'active')     AS users_active,
    EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_name = 'links' AND column_name = 'title')      AS links_title,
    (SELECT COUNT(*) FROM pg_indexes
     WHERE tablename IN ('audit_log', 'tasks', 'practices',
                         'practice_sessions', 'attendances', 'links')) AS index_count;


-- ============================================================================
--  ONE LAST THING — you need at least one admin account.
--  There is no UI for creating the first one (promoting a member requires
--  already being an admin), so if nobody is flagged yet, check:
--
--      SELECT id, username, email, admin FROM users ORDER BY id;
--
--  and promote yourself by username:
--
--      UPDATE users SET admin = TRUE WHERE username = 'your_username';
--
--  Left commented out on purpose so running this file cannot hand out admin
--  access by accident.
-- ============================================================================
