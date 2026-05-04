-- PDPL consents + employee documents + quotations.

CREATE TABLE IF NOT EXISTS pdpl_consents (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER REFERENCES users(id),
  anon_id           VARCHAR(64),
  vendor_id         INTEGER REFERENCES vendors(id),
  scope             VARCHAR(40) NOT NULL,
  granted           BOOLEAN NOT NULL,
  document_version  VARCHAR(30),
  ip                VARCHAR(50),
  user_agent        TEXT,
  created_at        TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pdpl_consents_user   ON pdpl_consents(user_id, scope);
CREATE INDEX IF NOT EXISTS idx_pdpl_consents_vendor ON pdpl_consents(vendor_id, scope);

CREATE TABLE IF NOT EXISTS employee_documents (
  id                SERIAL PRIMARY KEY,
  vendor_id         INTEGER NOT NULL REFERENCES vendors(id),
  employee_id       INTEGER NOT NULL REFERENCES users(id),
  category          VARCHAR(30) NOT NULL,
  title             VARCHAR(200) NOT NULL,
  file_url          TEXT NOT NULL,
  expires_at        TIMESTAMP,
  notes             TEXT,
  uploaded_by_id    INTEGER NOT NULL REFERENCES users(id),
  created_at        TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_employee_documents_vendor   ON employee_documents(vendor_id);
CREATE INDEX IF NOT EXISTS idx_employee_documents_employee ON employee_documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_documents_expiry   ON employee_documents(expires_at);

CREATE TABLE IF NOT EXISTS quotations (
  id                       SERIAL PRIMARY KEY,
  vendor_id                INTEGER NOT NULL REFERENCES vendors(id),
  created_by_id            INTEGER NOT NULL REFERENCES users(id),
  customer_id              INTEGER REFERENCES users(id),
  recipient_name           VARCHAR(200) NOT NULL,
  recipient_phone          VARCHAR(30),
  recipient_email          VARCHAR(200),
  quote_number             VARCHAR(30) NOT NULL UNIQUE,
  title                    VARCHAR(200) NOT NULL,
  scope                    TEXT NOT NULL,
  items                    JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal_sar             NUMERIC(12, 2) NOT NULL DEFAULT 0,
  vat_sar                  NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_sar                NUMERIC(12, 2) NOT NULL DEFAULT 0,
  valid_until              TIMESTAMP,
  terms_text               TEXT,
  notes_to_customer        TEXT,
  status                   VARCHAR(20) NOT NULL DEFAULT 'draft',
  public_share_token       VARCHAR(64) NOT NULL,
  accepted_signature_name  VARCHAR(200),
  accepted_at              TIMESTAMP,
  accepted_ip              VARCHAR(50),
  accepted_user_agent      TEXT,
  sent_at                  TIMESTAMP,
  viewed_at                TIMESTAMP,
  rejected_at              TIMESTAMP,
  rejection_reason         TEXT,
  created_at               TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_quotations_vendor ON quotations(vendor_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_quotations_token ON quotations(public_share_token);
