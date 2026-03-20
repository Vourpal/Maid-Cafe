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
    active BOOLEAN NOT NULL DEFAULT TRUE
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
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
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
