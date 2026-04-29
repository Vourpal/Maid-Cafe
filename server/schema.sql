-- ================================================
-- Maid Cafe Database Schema
-- ================================================

-- Users
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

-- Events
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

-- Attendances
-- ON DELETE CASCADE: deleting an event automatically deletes all its attendances
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

-- Tasks
-- ON DELETE CASCADE: deleting an event automatically deletes all its tasks
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    assigned_to INTEGER,
    created_by INTEGER NOT NULL,
    due_date TIMESTAMP,
    event_id INTEGER,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (assigned_to) REFERENCES users(id),
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS practice_sessions (
    id SERIAL PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    location VARCHAR(100),
    date TIMESTAMPTZ NOT NULL,
    notes VARCHAR(255)
);

-- practices

CREATE TABLE IF NOT EXISTS practices (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    practice_session_id INTEGER NOT NULL,
    attended BOOLEAN NOT NULL DEFAULT TRUE,
    late BOOLEAN NOT NULL DEFAULT FALSE,
    notes VARCHAR,

    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (practice_session_id) REFERENCES practice_sessions(id) ON DELETE CASCADE,

    CONSTRAINT unique_user_practice UNIQUE (user_id, practice_session_id)
);

CREATE TABLE IF NOT EXISTS routines (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS practice_session_routines (
    id SERIAL PRIMARY KEY,
    practice_session_id INTEGER NOT NULL,
    routine_id INTEGER NOT NULL,

    FOREIGN KEY (routine_id) REFERENCES routines(id) ON DELETE CASCADE,
    FOREIGN KEY (practice_session_id) REFERENCES practice_sessions(id) ON DELETE CASCADE,

    UNIQUE (practice_session_id, routine_id)
);

CREATE TABLE  IF NOT EXISTS invite_codes (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  created_by INTEGER REFERENCES users(id),

  max_uses INTEGER DEFAULT 1,
  uses INTEGER DEFAULT 0,

  expires_at TIMESTAMP NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS links(
    id SERIAL PRIMARY KEY,
    category TEXT NOT NULL,
    link_url TEXT NOT NULL,
    UNIQUE(category, link_url)
);

CREATE INDEX idx_links_category ON links(category);