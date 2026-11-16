-- Fix: deleting a sent chat message failed with
--   new row for relation "messages" violates check constraint "messages_body_length_check"
--
-- Why: delete_message() blanks the text of a deleted message (body = '') and sets deleted_at,
-- but the length rule required every message to have text or an attachment, so the blank
-- body of a deleted message was rejected.
--
-- Fix: a message is also allowed to have an empty body once it is marked as deleted.
-- This is looser than the old rule, so every existing message still passes.
-- Run once in the Supabase SQL Editor. Safe to run again.

alter table public.messages drop constraint if exists messages_body_length_check;
alter table public.messages add constraint messages_body_length_check
  check (
    char_length(coalesce(body, '')) <= 2000
    and (
      deleted_at is not null
      or char_length(coalesce(body, '')) > 0
      or attachment_path is not null
    )
  );
