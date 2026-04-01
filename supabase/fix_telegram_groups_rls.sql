-- Fix RLS policies for Telegram groups visibility in the Frontend
-- This enables authenticated users (SuperAdmins) to see the 135+ groups

-- 1. Enable RLS
ALTER TABLE luxe_telegram_groups ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON luxe_telegram_groups;
DROP POLICY IF EXISTS "Enable all access for admins" ON luxe_telegram_groups;

-- 3. Create READ policy for authenticated users
CREATE POLICY "Enable read access for authenticated users"
  ON luxe_telegram_groups
  FOR SELECT
  TO authenticated
  USING (true);

-- 4. Create UPDATE policy for authenticated users (needed for the harvester)
CREATE POLICY "Enable update access for authenticated users"
  ON luxe_telegram_groups
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 5. Create INSERT policy for the Admin Hub
CREATE POLICY "Enable insert access for authenticated users"
  ON luxe_telegram_groups
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 6. Create DELETE policy for the Admin Hub
CREATE POLICY "Enable delete access for authenticated users"
  ON luxe_telegram_groups
  FOR DELETE
  TO authenticated
  USING (true);
