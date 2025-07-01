-- Add performance indexes for issue #33
-- This migration adds indexes to improve query performance on frequently accessed columns

-- Indexes for User table
CREATE INDEX CONCURRENTLY IF NOT EXISTS "User_role_idx" ON "User"("role");

-- Indexes for migration_records table
CREATE INDEX CONCURRENTLY IF NOT EXISTS "migration_records_session_id_idx" ON "migration_records"("session_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "migration_records_object_type_idx" ON "migration_records"("object_type");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "migration_records_session_id_status_idx" ON "migration_records"("session_id", "status");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "migration_records_created_at_idx" ON "migration_records"("created_at");

-- Indexes for migration_sessions table
CREATE INDEX CONCURRENTLY IF NOT EXISTS "migration_sessions_project_id_idx" ON "migration_sessions"("project_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "migration_sessions_status_idx" ON "migration_sessions"("status");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "migration_sessions_created_at_idx" ON "migration_sessions"("created_at");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "migration_sessions_project_id_status_idx" ON "migration_sessions"("project_id", "status");

-- Indexes for organisations table
CREATE INDEX CONCURRENTLY IF NOT EXISTS "organisations_user_id_idx" ON "organisations"("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "organisations_instance_url_idx" ON "organisations"("instance_url");