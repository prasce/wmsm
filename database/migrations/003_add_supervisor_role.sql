-- Migration 003: Add supervisor role
-- Drops existing inline CHECK on users.role and replaces with named constraint
-- that includes 'supervisor'.

DO $$
DECLARE
  cname TEXT;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'users'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%role%';

  IF cname IS NOT NULL THEN
    EXECUTE 'ALTER TABLE users DROP CONSTRAINT ' || quote_ident(cname);
  END IF;
END $$;

ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'supervisor', 'operator', 'viewer'));

COMMENT ON COLUMN users.role IS 'admin | supervisor | operator | viewer';
