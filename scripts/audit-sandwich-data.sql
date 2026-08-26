-- ─────────────────────────────────────────────────────────────────────────────
-- SANDWICH staging data audit — prototype feedback flow
-- Run against staging DB. Queries are intentionally split per area; nothing is
-- force-joined. No writes, read-only.
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══ A. Users (recent) ═══════════════════════════════════════════════════════
SELECT id, username, email, role, created_at
FROM users
ORDER BY created_at DESC
LIMIT 20;

-- ═══ B. Conversations of type prototype (recent) ═════════════════════════════
SELECT id, user_id, title, pipeline_stage, pending_type, feedback,
       created_at, updated_at
FROM conversations
ORDER BY updated_at DESC
LIMIT 50;

-- ═══ C. Chat messages for a specific prototype conversation ═══════════════════
-- Replace :conversation_id with the id from query B
SELECT id, role, content, document_id, created_at
FROM chat_messages
WHERE conversation_id = :conversation_id
ORDER BY created_at ASC;

-- ═══ D. Documents + versions (prototype docs) ═════════════════════════════════
-- D1. Documents
SELECT id, user_id, type, title, current_version_id, created_at, updated_at
FROM documents
WHERE type = 'prototype'
ORDER BY updated_at DESC
LIMIT 50;

-- D2. Versions for a specific document (replace :document_id)
SELECT id, document_id, version_no, left(content, 300) AS content_preview,
       prompt_used, created_at
FROM document_versions
WHERE document_id = :document_id
ORDER BY version_no ASC;

-- D3. Files for a specific document + version (replace :document_id, :version_no)
SELECT id, document_id, version_no, path, left(content, 200) AS content_preview,
       created_at
FROM document_files
WHERE document_id = :document_id AND version_no = :version_no
ORDER BY path ASC;

-- ═══ E. Conversation ↔ document links (prototype) ═════════════════════════════
SELECT cd.conversation_id, cd.document_id, cd.created_at
FROM conversation_documents cd
JOIN documents d ON d.id = cd.document_id
WHERE d.type = 'prototype'
ORDER BY cd.created_at DESC
LIMIT 50;

-- ═══ F. Usage (chat + prototype counts) for a specific user ═══════════════════
-- Replace :user_id
SELECT user_id, year_month, kind, count
FROM usage
WHERE user_id = :user_id
ORDER BY year_month DESC;

-- ═══ G. Engine settings (which model per engine) ═══════════════════════════════
SELECT key, value, updated_at
FROM engine_settings
ORDER BY key ASC;

-- ═══ H. Attachments for a specific conversation (did the brief include images?) ═
-- Replace :conversation_id
SELECT id, filename, mime_type, extract_status, size_bytes, created_at
FROM attachments
WHERE conversation_id = :conversation_id
ORDER BY created_at ASC;
