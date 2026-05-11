-- Marketing attribution + leads.

CREATE TABLE IF NOT EXISTS marketing_attribution (
  id                       SERIAL PRIMARY KEY,
  anon_id                  VARCHAR(64) NOT NULL UNIQUE,
  landing_path             TEXT,
  referrer                 TEXT,
  utm_source               VARCHAR(100),
  utm_medium               VARCHAR(100),
  utm_campaign             VARCHAR(200),
  utm_term                 VARCHAR(200),
  utm_content              VARCHAR(200),
  gclid                    VARCHAR(200),
  fbclid                   VARCHAR(200),
  ttclid                   VARCHAR(200),
  ip                       VARCHAR(50),
  user_agent               TEXT,
  converted_to_vendor_id   INTEGER REFERENCES vendors(id),
  converted_at             TIMESTAMP,
  visit_count              INTEGER NOT NULL DEFAULT 1,
  first_seen_at            TIMESTAMP NOT NULL DEFAULT NOW(),
  last_seen_at             TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_marketing_attribution_utm
  ON marketing_attribution(utm_source, utm_campaign);

CREATE TABLE IF NOT EXISTS leads (
  id                       SERIAL PRIMARY KEY,
  channel                  VARCHAR(20) NOT NULL,
  name                     VARCHAR(120),
  phone                    VARCHAR(30),
  email                    VARCHAR(200),
  message                  TEXT,
  industry                 VARCHAR(50),
  best_time_to_call        VARCHAR(50),
  status                   VARCHAR(20) NOT NULL DEFAULT 'new',
  utm_source               VARCHAR(100),
  utm_medium               VARCHAR(100),
  utm_campaign             VARCHAR(200),
  utm_term                 VARCHAR(200),
  utm_content              VARCHAR(200),
  ip                       VARCHAR(50),
  user_agent               TEXT,
  notes                    TEXT,
  converted_to_vendor_id   INTEGER REFERENCES vendors(id),
  created_at               TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_leads_channel ON leads(channel, status);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at);
