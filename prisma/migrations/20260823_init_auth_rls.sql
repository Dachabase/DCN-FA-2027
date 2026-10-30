-- =========================================================================
-- Migration: Add Google OAuth, Academic Profile Fields & Interaction Logging
-- Database Engine: PostgreSQL 16 (Amazon RDS / Aurora Serverless v2)
-- Includes: Row Level Security (RLS) policies for Plain Postgres
-- =========================================================================

-- 1. Create UserRole enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole') THEN
    CREATE TYPE "UserRole" AS ENUM ('CURRENT_STUDENT', 'PROSPECTIVE_UTME');
  END IF;
END$$;

-- 2. Modify "User" table
ALTER TABLE "User" 
  ALTER COLUMN "telegramId" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "googleSub" TEXT,
  ADD COLUMN IF NOT EXISTS "email" TEXT,
  ADD COLUMN IF NOT EXISTS "fullName" TEXT,
  ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "role" "UserRole",
  ADD COLUMN IF NOT EXISTS "utmeExamYear" INTEGER,
  ADD COLUMN IF NOT EXISTS "onboardingCompletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "refreshTokenHash" TEXT;

-- Create unique indexes for Google OAuth identity
CREATE UNIQUE INDEX IF NOT EXISTS "User_googleSub_key" ON "User"("googleSub");
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- 3. Create "Interaction" table
CREATE TABLE IF NOT EXISTS "Interaction" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "resourceId" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Interaction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Interaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Interaction_userId_createdAt_idx" ON "Interaction"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "Interaction_eventType_idx" ON "Interaction"("eventType");

-- =========================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES FOR POSTGRESQL (AWS RDS)
-- =========================================================================
-- Note on Plain Postgres vs Supabase:
-- Supabase relies on auth.uid() which wraps its proprietary GoTrue JWT context.
-- On plain PostgreSQL on AWS RDS, we use PostgreSQL's built-in session settings:
--   SET LOCAL app.current_user_id = '<user_id>';
-- When app.current_user_id is set, the policies enforce that a user can only
-- view/modify their own row in "User" and "Interaction".
-- If the setting is unset or matches 'system_admin', application-level bypass is permitted.

-- Helper functions for session variable management
CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS TEXT AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_user_id', true), '');
END;
$$ LANGUAGE plpgsql STABLE;

-- Enable RLS on User table
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;

-- User Policies
DROP POLICY IF EXISTS "users_select_policy" ON "User";
CREATE POLICY "users_select_policy" ON "User"
  FOR SELECT
  USING (
    app_current_user_id() IS NULL 
    OR app_current_user_id() = 'admin'
    OR "id" = app_current_user_id()
  );

DROP POLICY IF EXISTS "users_update_policy" ON "User";
CREATE POLICY "users_update_policy" ON "User"
  FOR UPDATE
  USING (
    app_current_user_id() IS NULL 
    OR app_current_user_id() = 'admin'
    OR "id" = app_current_user_id()
  )
  WITH CHECK (
    app_current_user_id() IS NULL 
    OR app_current_user_id() = 'admin'
    OR "id" = app_current_user_id()
  );

DROP POLICY IF EXISTS "users_delete_policy" ON "User";
CREATE POLICY "users_delete_policy" ON "User"
  FOR DELETE
  USING (
    app_current_user_id() IS NULL 
    OR app_current_user_id() = 'admin'
    OR "id" = app_current_user_id()
  );

-- Enable RLS on Interaction table
ALTER TABLE "Interaction" ENABLE ROW LEVEL SECURITY;

-- Interaction Policies
DROP POLICY IF EXISTS "interactions_select_policy" ON "Interaction";
CREATE POLICY "interactions_select_policy" ON "Interaction"
  FOR SELECT
  USING (
    app_current_user_id() IS NULL 
    OR app_current_user_id() = 'admin'
    OR "userId" = app_current_user_id()
  );

DROP POLICY IF EXISTS "interactions_insert_policy" ON "Interaction";
CREATE POLICY "interactions_insert_policy" ON "Interaction"
  FOR INSERT
  WITH CHECK (
    app_current_user_id() IS NULL 
    OR app_current_user_id() = 'admin'
    OR "userId" = app_current_user_id()
  );
