-- ================================================
-- Maid Cafe Database Schema (UPDATED)
-- ================================================

-- ======================
-- USERS
-- ======================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    admin BOOLEAN NOT NULL DEFAULT FALSE,
    active BOOLEAN NOT NULL DEFAULT TRUE,

    type VARCHAR(20),
    availability JSONB DEFAULT '{}'::jsonb,

    CONSTRAINT user_type_check
    CHECK (type IN ('maid', 'butler') OR type IS NULL)
);

-- ======================
-- EVENTS
-- ======================
CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    created_by INTEGER NOT NULL,
    location VARCHAR(100),
    max_attendees INT,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',

    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- ======================
-- ATTENDANCES (EVENTS)
-- ======================
CREATE TABLE IF NOT EXISTS attendances (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    event_id INTEGER NOT NULL,
    status VARCHAR(100) NOT NULL,
    notes VARCHAR(255),
    role VARCHAR(10),
    seats_available INT,

    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,

    UNIQUE (user_id, event_id)
);

-- ======================
-- TASKS
-- ======================
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

    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks (assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_event_id ON tasks (event_id);
CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks (completed);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks (due_date);

-- ======================
-- AUDIT LOG
-- ======================
-- actor_label is denormalised so the log survives deletion of the actor.
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

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log (actor_id);

-- ======================
-- PRACTICE SESSIONS
-- ======================
CREATE TABLE IF NOT EXISTS practice_sessions (
    id SERIAL PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    location VARCHAR(100),
    date TIMESTAMPTZ NOT NULL,
    notes VARCHAR(255)
);

-- ======================
-- PRACTICES (ATTENDANCE PER SESSION)
-- ======================
CREATE TABLE IF NOT EXISTS practices (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    practice_session_id INTEGER NOT NULL,
    attended BOOLEAN NOT NULL DEFAULT TRUE,
    late BOOLEAN NOT NULL DEFAULT FALSE,
    notes VARCHAR,

    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (practice_session_id)
        REFERENCES practice_sessions(id)
        ON DELETE CASCADE,

    CONSTRAINT unique_user_practice
        UNIQUE (user_id, practice_session_id)
);

-- ======================
-- ROUTINES (GLOBAL CATALOG)
-- ======================
-- duration_seconds/bpm are stored as plain integers rather than an interval so
-- the client can format them however it likes without parsing.
CREATE TABLE IF NOT EXISTS routines (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    notes TEXT,

    music_url TEXT,
    video_url TEXT,
    duration_seconds INTEGER,
    bpm INTEGER,
    formation_notes TEXT,
    difficulty VARCHAR(20),
    member_count INTEGER,

    CONSTRAINT unique_routine_name UNIQUE (name),
    CONSTRAINT routine_difficulty_check
        CHECK (difficulty IN ('easy', 'medium', 'hard') OR difficulty IS NULL)
);

-- ======================
-- ROUTINE PROFICIENCY
-- ======================
-- Which member knows which routine, and how well. One row per pair.
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

CREATE INDEX IF NOT EXISTS idx_proficiency_user ON routine_proficiency (user_id);
CREATE INDEX IF NOT EXISTS idx_proficiency_routine ON routine_proficiency (routine_id);

-- ======================
-- PRACTICE ↔ ROUTINES (JOIN TABLE)
-- ======================
CREATE TABLE IF NOT EXISTS practice_session_routines (
    id SERIAL PRIMARY KEY,
    practice_session_id INTEGER NOT NULL,
    routine_id INTEGER NOT NULL,

    FOREIGN KEY (routine_id)
        REFERENCES routines(id)
        ON DELETE CASCADE,

    FOREIGN KEY (practice_session_id)
        REFERENCES practice_sessions(id)
        ON DELETE CASCADE,

    UNIQUE (practice_session_id, routine_id)
);

-- ======================
-- INVITE CODES
-- ======================
CREATE TABLE IF NOT EXISTS invite_codes (
    id SERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    created_by INTEGER REFERENCES users(id),

    max_uses INTEGER DEFAULT 1,
    uses INTEGER DEFAULT 0,

    expires_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ======================
-- LINKS
-- ======================
CREATE TABLE IF NOT EXISTS links (
    id SERIAL PRIMARY KEY,
    category TEXT NOT NULL,
    link_url TEXT NOT NULL,

    UNIQUE(category, link_url)
);

-- ======================
-- INDEXES
-- ======================
CREATE INDEX IF NOT EXISTS idx_links_category ON links(category);

-- Reporting / admin query support
CREATE INDEX IF NOT EXISTS idx_practices_user_id ON practices (user_id);
CREATE INDEX IF NOT EXISTS idx_practices_session_id ON practices (practice_session_id);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_date ON practice_sessions (date);
CREATE INDEX IF NOT EXISTS idx_attendances_event_id ON attendances (event_id);
CREATE INDEX IF NOT EXISTS idx_attendances_user_id ON attendances (user_id);

-- ======================
-- POSITIONS (JOB CATALOG)
-- ======================
-- A lookup table rather than a CHECK constraint / enum: the job list is
-- operational data that changes with the venue (a cafe with a stage needs MC
-- and Performer, one without does not), and editing it must not require a
-- migration. It also gives assignments a real FK, so renaming "Server" to
-- "Waitstaff" updates every historical assignment at once.
CREATE TABLE IF NOT EXISTS positions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(60) NOT NULL UNIQUE,
    description VARCHAR(255),
    color VARCHAR(20),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ======================
-- EVENT ASSIGNMENTS (SHIFTS)
-- ======================
-- Deliberately NO unique constraint on (event_id, user_id): one person may hold
-- several positions at the same event so it can be run as shifts, e.g. Server
-- 10am-1pm then Cashier 1pm-4pm. NULL starts_at/ends_at means "the whole event".
--
-- attendances.role is VARCHAR(10) and already means the carpool role
-- (Driver/Passenger), so job assignments live here instead of reusing it.
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
CREATE INDEX IF NOT EXISTS idx_event_assignments_user ON event_assignments (user_id);
CREATE INDEX IF NOT EXISTS idx_event_assignments_pos ON event_assignments (position_id);

-- Starter job list, so a fresh database can assign shifts immediately. Matches
-- the seed in migrations/copy_me.sql; ON CONFLICT keeps re-runs harmless and
-- preserves any edits made to these rows.
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

-- ======================
-- COSTUMES & PROPS
-- ======================
-- owner_id NULL means the group owns the item rather than an individual.
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

-- Check-out log. returned_at NULL means the item is still out with someone, so
-- availability is derived from this table plus condition rather than kept in a
-- separate status column that could disagree with it.
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
CREATE INDEX IF NOT EXISTS idx_costume_items_owner ON costume_items (owner_id);
CREATE INDEX IF NOT EXISTS idx_costume_assign_item ON costume_assignments (item_id);
CREATE INDEX IF NOT EXISTS idx_costume_assign_user ON costume_assignments (user_id);
CREATE INDEX IF NOT EXISTS idx_costume_assign_event ON costume_assignments (event_id);
-- "What is still out" is the query that runs on every list load.
CREATE INDEX IF NOT EXISTS idx_costume_assign_open
    ON costume_assignments (item_id) WHERE returned_at IS NULL;

-- ======================
-- MENU CATALOG
-- ======================
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

-- ======================
-- EVENT MENU (CATALOG ↔ EVENT)
-- ======================
-- The menu actually being served at one event. price_override covers one-off
-- convention pricing without editing the catalog entry.
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
CREATE INDEX IF NOT EXISTS idx_event_menu_event ON event_menu_items (event_id);
CREATE INDEX IF NOT EXISTS idx_event_menu_assigned ON event_menu_items (assigned_to);

-- ======================
-- ANNOUNCEMENTS
-- ======================
-- Shown on the home page. expires_at lets time-sensitive notices drop off by
-- themselves; pinned keeps a standing notice at the top.
-- author_label is denormalised for the same reason as audit_log.actor_label.
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
