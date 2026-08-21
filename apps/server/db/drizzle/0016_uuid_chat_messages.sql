CREATE EXTENSION IF NOT EXISTS "pgcrypto";

BEGIN;

-- chat_messages: add UUID column
ALTER TABLE chat_messages ADD COLUMN id_new text;
UPDATE chat_messages SET id_new = gen_random_uuid()::text;

-- attachments: add new message_id column (text)
ALTER TABLE attachments ADD COLUMN message_id_new text;

-- Drop FK from attachments.message_id → chat_messages.id (must precede child-table UPDATE)
ALTER TABLE attachments DROP CONSTRAINT IF EXISTS attachments_message_id_chat_messages_id_fk;

-- Propagate: fill attachments.message_id_new from chat_messages.id_new
UPDATE attachments a
SET message_id_new = cm.id_new
FROM chat_messages cm
WHERE a.message_id = cm.id;

-- Swap chat_messages PK
ALTER TABLE chat_messages DROP CONSTRAINT chat_messages_pkey;
ALTER TABLE chat_messages DROP COLUMN id;
ALTER TABLE chat_messages RENAME COLUMN id_new TO id;
ALTER TABLE chat_messages ALTER COLUMN id SET NOT NULL;
ALTER TABLE chat_messages ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE chat_messages ADD PRIMARY KEY (id);
DROP SEQUENCE IF EXISTS chat_messages_id_seq;

-- Swap attachments.message_id
ALTER TABLE attachments DROP COLUMN message_id;
ALTER TABLE attachments RENAME COLUMN message_id_new TO message_id;

-- Re-add FK
ALTER TABLE attachments ADD CONSTRAINT attachments_message_id_chat_messages_id_fk
  FOREIGN KEY (message_id) REFERENCES chat_messages(id);

COMMIT;
