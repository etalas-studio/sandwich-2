CREATE EXTENSION IF NOT EXISTS "pgcrypto";

BEGIN;

ALTER TABLE subscriptions ADD COLUMN id_new text;
UPDATE subscriptions SET id_new = gen_random_uuid()::text;

ALTER TABLE subscriptions DROP CONSTRAINT subscriptions_pkey;
ALTER TABLE subscriptions DROP COLUMN id;
ALTER TABLE subscriptions RENAME COLUMN id_new TO id;
ALTER TABLE subscriptions ALTER COLUMN id SET NOT NULL;
ALTER TABLE subscriptions ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE subscriptions ADD PRIMARY KEY (id);
DROP SEQUENCE IF EXISTS subscriptions_id_seq;

COMMIT;
