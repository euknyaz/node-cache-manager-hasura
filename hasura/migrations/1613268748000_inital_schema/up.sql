CREATE TABLE "public"."cache" (
    "key"          TEXT NOT NULL PRIMARY KEY,
    value          TEXT NULL,
    compressed     BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at     TIMESTAMPTZ,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);