-- Rollback script for performance indexes (issue #33)
-- This script removes the indexes added for performance optimization

-- Remove indexes from User table
DROP INDEX IF EXISTS "User_role_idx";

-- Remove indexes from migration_records table
DROP INDEX IF EXISTS "migration_records_session_id_idx";
DROP INDEX IF EXISTS "migration_records_object_type_idx";
DROP INDEX IF EXISTS "migration_records_session_id_status_idx";
DROP INDEX IF EXISTS "migration_records_created_at_idx";

-- Remove indexes from migration_sessions table
DROP INDEX IF EXISTS "migration_sessions_project_id_idx";
DROP INDEX IF EXISTS "migration_sessions_status_idx";
DROP INDEX IF EXISTS "migration_sessions_created_at_idx";
DROP INDEX IF EXISTS "migration_sessions_project_id_status_idx";

-- Remove indexes from organisations table
DROP INDEX IF EXISTS "organisations_user_id_idx";
DROP INDEX IF EXISTS "organisations_instance_url_idx";