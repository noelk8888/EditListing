-- ============================================================
-- LUXE Listings: User Roles & Permissions
-- Run this in the Supabase SQL editor
-- ============================================================

-- 1. Users table (who can log in and their role)
CREATE TABLE IF NOT EXISTS app_users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL UNIQUE,
  name        text NOT NULL DEFAULT '',
  role        text NOT NULL CHECK (role IN ('ADMIN', 'BROKER', 'VIEWER')),
  created_by  text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 2. Role-level permission overrides (SA sets these for each role)
--    If a row exists here, it overrides the code default.
--    If no row exists, code defaults apply (see lib/permissions.ts ROLE_DEFAULTS).
CREATE TABLE IF NOT EXISTS role_permissions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role        text NOT NULL CHECK (role IN ('ADMIN', 'BROKER', 'VIEWER')),
  feature     text NOT NULL,
  enabled     boolean NOT NULL,
  updated_by  text NOT NULL DEFAULT '',
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, feature)
);

-- 3. Per-user permission overrides (AD sets these for individual BR/V users)
--    These take priority over role_permissions.
CREATE TABLE IF NOT EXISTS user_permission_overrides (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email  text NOT NULL REFERENCES app_users(email) ON DELETE CASCADE,
  feature     text NOT NULL,
  enabled     boolean NOT NULL,
  updated_by  text NOT NULL DEFAULT '',
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_email, feature)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_app_users_email        ON app_users(email);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role  ON role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_user_overrides_email   ON user_permission_overrides(user_email);
