-- 0016_parent_role.sql
-- Adds 'parent' to user_role, ahead of the parent-portal schema/RLS in the
-- next migration. Kept in its own file/transaction on purpose: PostgreSQL
-- doesn't allow a brand-new enum value to be referenced in the same
-- transaction that adds it (pre-12) and some migration runners wrap each
-- file in one transaction — splitting it here keeps this safe regardless.

alter type user_role add value if not exists 'parent';
