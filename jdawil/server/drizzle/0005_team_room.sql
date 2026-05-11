-- Team Room: private channel per vendor for owner + employees.
-- Tables: messages (chat), tasks (todo board), read cursors (unread badge).

CREATE TABLE IF NOT EXISTS team_messages (
  id              SERIAL PRIMARY KEY,
  vendor_id       INTEGER NOT NULL REFERENCES vendors(id),
  author_id       INTEGER NOT NULL REFERENCES users(id),
  body            TEXT NOT NULL,
  attachment_url  TEXT,
  attachment_type VARCHAR(30),
  pinned          BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at      TIMESTAMP,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_messages_vendor
  ON team_messages(vendor_id, created_at);

CREATE TABLE IF NOT EXISTS team_tasks (
  id              SERIAL PRIMARY KEY,
  vendor_id       INTEGER NOT NULL REFERENCES vendors(id),
  created_by_id   INTEGER NOT NULL REFERENCES users(id),
  assignee_id     INTEGER REFERENCES users(id),
  title           VARCHAR(200) NOT NULL,
  description     TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'open',
  priority        VARCHAR(10) NOT NULL DEFAULT 'normal',
  due_at          TIMESTAMP,
  completed_at    TIMESTAMP,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_tasks_vendor
  ON team_tasks(vendor_id, status);
CREATE INDEX IF NOT EXISTS idx_team_tasks_assignee
  ON team_tasks(assignee_id, status);

CREATE TABLE IF NOT EXISTS team_read_cursors (
  id                     SERIAL PRIMARY KEY,
  vendor_id              INTEGER NOT NULL REFERENCES vendors(id),
  user_id                INTEGER NOT NULL REFERENCES users(id),
  last_read_message_id   INTEGER,
  updated_at             TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_team_read_cursors_unique
  ON team_read_cursors(vendor_id, user_id);
