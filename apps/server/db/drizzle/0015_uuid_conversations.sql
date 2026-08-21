CREATE EXTENSION IF NOT EXISTS "pgcrypto";

BEGIN;

-- 1. Add new UUID column (nullable for now)
ALTER TABLE conversations ADD COLUMN id_new text;

-- 2. Backfill: assign a stable UUID to every existing row
UPDATE conversations SET id_new = gen_random_uuid()::text;

-- 3. Propagate new IDs to FK columns in child tables
UPDATE chat_messages cm
SET conversation_id = c.id_new
FROM conversations c
WHERE cm.conversation_id = c.id;

UPDATE attachments a
SET conversation_id = c.id_new
FROM conversations c
WHERE a.conversation_id = c.id;

UPDATE conversation_documents cd
SET conversation_id = c.id_new
FROM conversations c
WHERE cd.conversation_id = c.id;

-- 4. Drop FK constraints referencing conversations.id
ALTER TABLE chat_messages DROP CONSTRAINT chat_messages_conversation_id_conversations_id_fk;
ALTER TABLE attachments DROP CONSTRAINT attachments_conversation_id_conversations_id_fk;
ALTER TABLE conversation_documents DROP CONSTRAINT conversation_documents_conversation_id_conversations_id_fk;

-- 5. Swap PKs (rename old id → id_old, new → id)
ALTER TABLE conversations DROP CONSTRAINT conversations_pkey;
ALTER TABLE conversations RENAME COLUMN id TO id_old;
ALTER TABLE conversations RENAME COLUMN id_new TO id;
ALTER TABLE conversations ALTER COLUMN id SET NOT NULL;
ALTER TABLE conversations ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE conversations ADD PRIMARY KEY (id);

-- 6. Re-add FK constraints pointing at new PK
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_conversation_id_conversations_id_fk
  FOREIGN KEY (conversation_id) REFERENCES conversations(id);

ALTER TABLE attachments ADD CONSTRAINT attachments_conversation_id_conversations_id_fk
  FOREIGN KEY (conversation_id) REFERENCES conversations(id);

ALTER TABLE conversation_documents ADD CONSTRAINT conversation_documents_conversation_id_conversations_id_fk
  FOREIGN KEY (conversation_id) REFERENCES conversations(id);

COMMIT;
