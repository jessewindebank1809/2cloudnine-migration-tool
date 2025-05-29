-- CreateEnum
CREATE TYPE "organization_type" AS ENUM ('SOURCE', 'TARGET');

-- CreateEnum
CREATE TYPE "migration_status" AS ENUM ('DRAFT', 'READY', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "session_status" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "record_status" AS ENUM ('SUCCESS', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "organization_type" NOT NULL,
    "salesforce_org_id" TEXT,
    "instance_url" TEXT NOT NULL,
    "access_token_encrypted" TEXT,
    "refresh_token_encrypted" TEXT,
    "token_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "migration_projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "source_org_id" TEXT NOT NULL,
    "target_org_id" TEXT NOT NULL,
    "status" "migration_status" NOT NULL DEFAULT 'DRAFT',
    "config" JSONB NOT NULL DEFAULT '{}',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "migration_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "object_definitions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "api_name" TEXT NOT NULL,
    "description" TEXT,
    "is_standard" BOOLEAN NOT NULL DEFAULT false,
    "field_mappings" JSONB NOT NULL DEFAULT '{}',
    "relationship_config" JSONB NOT NULL DEFAULT '{}',
    "validation_rules" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "object_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "migration_sessions" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "object_type" TEXT NOT NULL,
    "status" "session_status" NOT NULL DEFAULT 'PENDING',
    "total_records" INTEGER NOT NULL DEFAULT 0,
    "processed_records" INTEGER NOT NULL DEFAULT 0,
    "successful_records" INTEGER NOT NULL DEFAULT 0,
    "failed_records" INTEGER NOT NULL DEFAULT 0,
    "error_log" JSONB NOT NULL DEFAULT '[]',
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "migration_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "migration_records" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "source_record_id" TEXT,
    "target_record_id" TEXT,
    "object_type" TEXT NOT NULL,
    "status" "record_status" NOT NULL,
    "error_message" TEXT,
    "record_data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "migration_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_salesforce_org_id_key" ON "organizations"("salesforce_org_id");

-- AddForeignKey
ALTER TABLE "migration_projects" ADD CONSTRAINT "migration_projects_source_org_id_fkey" FOREIGN KEY ("source_org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "migration_projects" ADD CONSTRAINT "migration_projects_target_org_id_fkey" FOREIGN KEY ("target_org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "migration_sessions" ADD CONSTRAINT "migration_sessions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "migration_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "migration_records" ADD CONSTRAINT "migration_records_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "migration_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

