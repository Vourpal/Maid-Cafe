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
CREATE TABLE IF NOT EXISTS routines (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    notes TEXT,

    CONSTRAINT unique_routine_name UNIQUE (name)
);

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