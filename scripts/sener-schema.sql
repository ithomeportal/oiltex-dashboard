-- SENER permit workspace — one-time schema (run by a privileged role, NOT the
-- runtime role: oiltex_rw has no CREATE on the shared defaultdb by design).
-- Idempotent. Apply with: node --env-file=.env.local scripts/sener-apply-schema.mjs

CREATE TABLE IF NOT EXISTS sener_workspaces (
  workspace_id   VARCHAR(100) PRIMARY KEY,
  workspace_json JSONB        NOT NULL,
  revision       BIGINT       NOT NULL DEFAULT 0 CHECK (revision >= 0),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_by     VARCHAR(320)
);

-- Every saved revision, for audit and recovery (Manus kept none).
CREATE TABLE IF NOT EXISTS sener_workspace_history (
  id             BIGSERIAL    PRIMARY KEY,
  workspace_id   VARCHAR(100) NOT NULL,
  revision       BIGINT       NOT NULL,
  workspace_json JSONB        NOT NULL,
  updated_by     VARCHAR(320),
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, revision)
);

-- Originals, content-addressed. Bytes live in UploadThing under file_key.
CREATE TABLE IF NOT EXISTS sener_files (
  file_hash     CHAR(64)     PRIMARY KEY CHECK (file_hash ~ '^[a-f0-9]{64}$'),
  file_key      VARCHAR(512) NOT NULL UNIQUE,
  original_name VARCHAR(300) NOT NULL,
  mime_type     VARCHAR(128) NOT NULL,
  size_bytes    BIGINT       NOT NULL CHECK (size_bytes >= 0),
  uploaded_by   VARCHAR(320),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Keys uploaded through senerUploader, recorded server-side by UploadThing's
-- onUploadComplete. POST /api/sener/files/[hash] only accepts (or deletes) a
-- key listed here for the SAME user — a client-supplied key alone could
-- otherwise point at any file in the shared UploadThing app (tickets, Argus).
CREATE TABLE IF NOT EXISTS sener_uploads (
  file_key    VARCHAR(512) PRIMARY KEY,
  uploaded_by VARCHAR(320) NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- OTP brute-force guard (src/app/api/auth/verify-code).
ALTER TABLE auth_codes ADD COLUMN IF NOT EXISTS failed_attempts INTEGER NOT NULL DEFAULT 0;

GRANT SELECT, INSERT, UPDATE ON sener_workspaces TO oiltex_rw;
GRANT SELECT, INSERT ON sener_workspace_history TO oiltex_rw;
GRANT USAGE, SELECT ON SEQUENCE sener_workspace_history_id_seq TO oiltex_rw;
GRANT SELECT, INSERT ON sener_files TO oiltex_rw;
GRANT SELECT, INSERT, DELETE ON sener_uploads TO oiltex_rw;
