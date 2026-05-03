-- HR Suite v1 — leave requests + attendance.

CREATE TABLE IF NOT EXISTS leave_requests (
  id            SERIAL PRIMARY KEY,
  vendor_id     INTEGER NOT NULL REFERENCES vendors(id),
  employee_id   INTEGER NOT NULL REFERENCES users(id),
  type          VARCHAR(20) NOT NULL DEFAULT 'annual',
  status        VARCHAR(20) NOT NULL DEFAULT 'pending',
  from_date     TIMESTAMP NOT NULL,
  to_date       TIMESTAMP NOT NULL,
  reason        TEXT,
  reviewed_by   INTEGER REFERENCES users(id),
  reviewed_at   TIMESTAMP,
  review_note   TEXT,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_leave_requests_vendor   ON leave_requests(vendor_id, status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON leave_requests(employee_id);

CREATE TABLE IF NOT EXISTS attendance_records (
  id              SERIAL PRIMARY KEY,
  vendor_id       INTEGER NOT NULL REFERENCES vendors(id),
  employee_id     INTEGER NOT NULL REFERENCES users(id),
  check_in_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  check_out_at    TIMESTAMP,
  check_in_lat    NUMERIC(9, 6),
  check_in_lng    NUMERIC(9, 6),
  notes           TEXT
);
CREATE INDEX IF NOT EXISTS idx_attendance_vendor   ON attendance_records(vendor_id, check_in_at);
CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance_records(employee_id, check_in_at);
