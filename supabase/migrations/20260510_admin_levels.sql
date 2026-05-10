-- Migration: Multi-admin support with permission levels
-- Run this in Supabase Dashboard > SQL Editor

-- 1. Add admin_level column to user_roles
ALTER TABLE user_roles 
ADD COLUMN IF NOT EXISTS admin_level TEXT 
  CHECK (admin_level IN ('super_admin', 'admin', 'financeiro', 'suporte'))
  DEFAULT NULL;

-- 2. Set existing admins as super_admin (so nobody loses access)
UPDATE user_roles 
SET admin_level = 'super_admin' 
WHERE role = 'admin' AND admin_level IS NULL;

-- 3. Create index for performance
CREATE INDEX IF NOT EXISTS idx_user_roles_admin_level ON user_roles(admin_level);

-- 4. Enable RLS policy: only super_admin can modify user_roles for admins
-- (Keep existing policies, just ensure non-super admins can't escalate themselves)
CREATE OR REPLACE FUNCTION is_super_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = $1 
      AND role = 'admin' 
      AND admin_level = 'super_admin'
  );
$$;
