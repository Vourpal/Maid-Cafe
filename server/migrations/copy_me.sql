-- ============================================================================
--  MAID-CAFE — FULL SCHEMA SETUP
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
--  Sections 1-5  : admin panel (staff management, tasks, audit log)
--  Sections 6-10 : event positions, routine detail, costumes, menu,
--                  announcements
--
--  After it finishes, scroll to the bottom for the verification result.
-- ============================================================================

BEGIN;


-- ============================================================================
--  SECTION 1 — SAFETY NET
--  Columns the admin dashboard and staff directory read. These are all already
--  in schema.sql, so on an up-to-date database every statement here is a
--  no-op. They exist so this file also works against an older database that
--  never had the newer columns applied.
-- ============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS active       BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS admin        BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS type         VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS availability JSONB DEFAULT '{}'::jsonb;

-- maid/butler constraint, added only if it is not already present.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_type_check') THEN
        ALTER TABLE users
            ADD CONSTRAINT user_type_check
            CHECK (type IN ('maid', 'butler') OR type IS NULL);
    END IF;
END $$;

ALTER TABLE events      ADD COLUMN IF NOT EXISTS status          VARCHAR(20) NOT NULL DEFAULT 'draft';
ALTER TABLE attendances ADD COLUMN IF NOT EXISTS notes           VARCHAR(255);
ALTER TABLE attendances ADD COLUMN IF NOT EXISTS role            VARCHAR(10);
ALTER TABLE attendances ADD COLUMN IF NOT EXISTS seats_available INT;
ALTER TABLE practices   ADD COLUMN IF NOT EXISTS late            BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE practices   ADD COLUMN IF NOT EXISTS notes           VARCHAR;


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
--  Required. Every administrative mutation writes a row here, so without this
--  table creating an event, editing a member, assigning a task, etc. will fail.
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
--  SECTION 5 — INDEXES FOR THE ADMIN PANEL
--  Performance only. The reliability reports join practices against
--  practice_sessions and attendances against events for every member, and the
--  audit log is always ordered by recency.
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


-- ============================================================================
--  SECTION 6 — EVENT POSITIONS / SHIFTS
--  attendances.role is VARCHAR(10) and already means Driver/Passenger for
--  carpooling, so job assignments get their own tables rather than overloading
--  it. positions is a reusable catalog; event_assignments is one row per
--  person-per-job-per-shift.
-- ============================================================================

CREATE TABLE IF NOT EXISTS positions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(60) NOT NULL UNIQUE,
    description VARCHAR(255),
    color VARCHAR(20),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Deliberately NO unique constraint on (event_id, user_id, position_id):
-- a shift-based event can legitimately have the same person in the same role
-- twice at different times. starts_at/ends_at NULL means "the whole event".
CREATE TABLE IF NOT EXISTS event_assignments (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    position_id INTEGER NOT NULL REFERENCES positions(id) ON DELETE RESTRICT,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    notes VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_assignments_event ON event_assignments (event_id);
CREATE INDEX IF NOT EXISTS idx_event_assignments_user  ON event_assignments (user_id);
CREATE INDEX IF NOT EXISTS idx_event_assignments_pos   ON event_assignments (position_id);

-- Starter job list. ON CONFLICT keeps re-runs harmless and preserves any
-- edits you have made to these rows.
INSERT INTO positions (name, description, color) VALUES
    ('Greeter',      'Welcomes guests and manages the queue', 'rose'),
    ('Server',       'Takes orders and serves tables',        'pink'),
    ('Cashier',      'Handles payments and the register',     'amber'),
    ('Kitchen',      'Food and drink preparation',            'orange'),
    ('MC',           'Hosts and announces during the event',  'purple'),
    ('Performer',    'Performs routines',                     'violet'),
    ('Photographer', 'Event photography',                     'blue'),
    ('Setup',        'Before-event setup crew',               'emerald'),
    ('Teardown',     'After-event teardown crew',             'teal'),
    ('Floater',      'Covers wherever help is needed',        'gray')
ON CONFLICT (name) DO NOTHING;


-- ============================================================================
--  SECTION 7 — ROUTINE DETAIL & PROFICIENCY
--  routines previously held only name + notes.
-- ============================================================================

ALTER TABLE routines
    ADD COLUMN IF NOT EXISTS music_url TEXT,
    ADD COLUMN IF NOT EXISTS video_url TEXT,
    ADD COLUMN IF NOT EXISTS duration_seconds INTEGER,
    ADD COLUMN IF NOT EXISTS bpm INTEGER,
    ADD COLUMN IF NOT EXISTS formation_notes TEXT,
    ADD COLUMN IF NOT EXISTS difficulty VARCHAR(20),
    ADD COLUMN IF NOT EXISTS member_count INTEGER;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'routine_difficulty_check') THEN
        ALTER TABLE routines
            ADD CONSTRAINT routine_difficulty_check
            CHECK (difficulty IN ('easy', 'medium', 'hard') OR difficulty IS NULL);
    END IF;
END $$;

-- Who can perform what. routines.member_count versus the number of
-- can_perform/lead rows here is what drives the readiness check.
CREATE TABLE IF NOT EXISTS routine_proficiency (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    routine_id INTEGER NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
    level VARCHAR(20) NOT NULL DEFAULT 'learning',
    notes VARCHAR(255),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (user_id, routine_id),
    CONSTRAINT proficiency_level_check
        CHECK (level IN ('learning', 'can_perform', 'lead'))
);

CREATE INDEX IF NOT EXISTS idx_proficiency_user    ON routine_proficiency (user_id);
CREATE INDEX IF NOT EXISTS idx_proficiency_routine ON routine_proficiency (routine_id);


-- ============================================================================
--  SECTION 8 — COSTUMES & PROPS
--  owner_id NULL means the group owns it rather than an individual.
--  costume_assignments is a check-out log: returned_at NULL means the item is
--  still out with someone. Availability is derived from that rather than
--  stored as a separate status column, so the two can never disagree.
-- ============================================================================

CREATE TABLE IF NOT EXISTS costume_items (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(30) NOT NULL DEFAULT 'costume',
    description VARCHAR(255),
    size VARCHAR(20),
    color VARCHAR(40),
    owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    condition VARCHAR(20) NOT NULL DEFAULT 'good',
    quantity INTEGER NOT NULL DEFAULT 1,
    storage_location VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT costume_category_check
        CHECK (category IN ('costume', 'prop', 'accessory', 'wig', 'other')),
    CONSTRAINT costume_condition_check
        CHECK (condition IN ('good', 'needs_repair', 'needs_cleaning', 'retired'))
);

CREATE TABLE IF NOT EXISTS costume_assignments (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES costume_items(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
    checked_out_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    due_back_at TIMESTAMPTZ,
    returned_at TIMESTAMPTZ,
    notes VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_costume_items_category ON costume_items (category);
CREATE INDEX IF NOT EXISTS idx_costume_items_owner    ON costume_items (owner_id);
CREATE INDEX IF NOT EXISTS idx_costume_assign_item    ON costume_assignments (item_id);
CREATE INDEX IF NOT EXISTS idx_costume_assign_user    ON costume_assignments (user_id);
CREATE INDEX IF NOT EXISTS idx_costume_assign_event   ON costume_assignments (event_id);
-- Partial index: "what is still out" is the query that runs constantly.
CREATE INDEX IF NOT EXISTS idx_costume_assign_open
    ON costume_assignments (item_id) WHERE returned_at IS NULL;


-- ============================================================================
--  SECTION 9 — MENU MANAGEMENT
--  menu_items is the reusable catalog; event_menu_items is the menu actually
--  being served at one event, with prep assignment and an optional
--  event-specific price.
-- ============================================================================

CREATE TABLE IF NOT EXISTS menu_items (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(30) NOT NULL DEFAULT 'food',
    description VARCHAR(255),
    price NUMERIC(8, 2),
    allergens VARCHAR(255),
    dietary VARCHAR(100),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT menu_category_check
        CHECK (category IN ('food', 'drink', 'dessert', 'special', 'other'))
);

CREATE TABLE IF NOT EXISTS event_menu_items (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
    quantity_planned INTEGER,
    price_override NUMERIC(8, 2),
    notes VARCHAR(255),

    UNIQUE (event_id, menu_item_id)
);

CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items (category);
CREATE INDEX IF NOT EXISTS idx_event_menu_event    ON event_menu_items (event_id);
CREATE INDEX IF NOT EXISTS idx_event_menu_assigned ON event_menu_items (assigned_to);


-- ============================================================================
--  SECTION 10 — ANNOUNCEMENTS
--  Shown on the home page. expires_at lets time-sensitive notices drop off by
--  themselves; pinned keeps a standing notice at the top.
--  author_label is denormalised for the same reason as audit_log.actor_label.
-- ============================================================================

CREATE TABLE IF NOT EXISTS announcements (
    id SERIAL PRIMARY KEY,
    title VARCHAR(120) NOT NULL,
    body TEXT NOT NULL,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    author_label VARCHAR(150),
    priority VARCHAR(20) NOT NULL DEFAULT 'normal',
    pinned BOOLEAN NOT NULL DEFAULT FALSE,
    published BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at TIMESTAMPTZ,
    event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,

    CONSTRAINT announcement_priority_check
        CHECK (priority IN ('normal', 'important', 'urgent'))
);

CREATE INDEX IF NOT EXISTS idx_announcements_feed
    ON announcements (published, pinned DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_event ON announcements (event_id);


COMMIT;


-- ============================================================================
--  VERIFICATION
--  Every boolean column below should read TRUE, and seeded_positions should be
--  10 or more. Anything FALSE means that statement did not run — almost always
--  because Ctrl+Enter was used instead of Alt+X.
-- ============================================================================

SELECT
    to_regclass('public.audit_log')           IS NOT NULL AS audit_log,
    to_regclass('public.tasks')               IS NOT NULL AS tasks,
    to_regclass('public.positions')           IS NOT NULL AS positions,
    to_regclass('public.event_assignments')   IS NOT NULL AS event_assignments,
    to_regclass('public.routine_proficiency') IS NOT NULL AS routine_proficiency,
    to_regclass('public.costume_items')       IS NOT NULL AS costume_items,
    to_regclass('public.costume_assignments') IS NOT NULL AS costume_assignments,
    to_regclass('public.menu_items')          IS NOT NULL AS menu_items,
    to_regclass('public.event_menu_items')    IS NOT NULL AS event_menu_items,
    to_regclass('public.announcements')       IS NOT NULL AS announcements,
    EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_name = 'tasks' AND column_name = 'created_at')   AS tasks_created_at,
    EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_name = 'routines' AND column_name = 'music_url') AS routine_detail,
    EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_name = 'users' AND column_name = 'active')       AS users_active,
    EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_name = 'links' AND column_name = 'title')        AS links_title,
    (SELECT COUNT(*) FROM positions) AS seeded_positions;


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
