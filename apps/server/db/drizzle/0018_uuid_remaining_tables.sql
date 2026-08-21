CREATE EXTENSION IF NOT EXISTS "pgcrypto";

BEGIN;

-- conversation_documents
ALTER TABLE conversation_documents ADD COLUMN id_new text;
UPDATE conversation_documents SET id_new = gen_random_uuid()::text;
ALTER TABLE conversation_documents DROP CONSTRAINT conversation_documents_pkey;
ALTER TABLE conversation_documents DROP COLUMN id;
ALTER TABLE conversation_documents RENAME COLUMN id_new TO id;
ALTER TABLE conversation_documents ALTER COLUMN id SET NOT NULL;
ALTER TABLE conversation_documents ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE conversation_documents ADD PRIMARY KEY (id);
DROP SEQUENCE IF EXISTS conversation_documents_id_seq;

-- document_files
ALTER TABLE document_files ADD COLUMN id_new text;
UPDATE document_files SET id_new = gen_random_uuid()::text;
ALTER TABLE document_files DROP CONSTRAINT document_files_pkey;
ALTER TABLE document_files DROP COLUMN id;
ALTER TABLE document_files RENAME COLUMN id_new TO id;
ALTER TABLE document_files ALTER COLUMN id SET NOT NULL;
ALTER TABLE document_files ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE document_files ADD PRIMARY KEY (id);
DROP SEQUENCE IF EXISTS document_files_id_seq;

-- usage
ALTER TABLE usage ADD COLUMN id_new text;
UPDATE usage SET id_new = gen_random_uuid()::text;
ALTER TABLE usage DROP CONSTRAINT usage_pkey;
ALTER TABLE usage DROP COLUMN id;
ALTER TABLE usage RENAME COLUMN id_new TO id;
ALTER TABLE usage ALTER COLUMN id SET NOT NULL;
ALTER TABLE usage ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE usage ADD PRIMARY KEY (id);
DROP SEQUENCE IF EXISTS usage_id_seq;

-- user_preferences
ALTER TABLE user_preferences ADD COLUMN id_new text;
UPDATE user_preferences SET id_new = gen_random_uuid()::text;
ALTER TABLE user_preferences DROP CONSTRAINT user_preferences_pkey;
ALTER TABLE user_preferences DROP COLUMN id;
ALTER TABLE user_preferences RENAME COLUMN id_new TO id;
ALTER TABLE user_preferences ALTER COLUMN id SET NOT NULL;
ALTER TABLE user_preferences ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE user_preferences ADD PRIMARY KEY (id);
DROP SEQUENCE IF EXISTS user_preferences_id_seq;

COMMIT;
