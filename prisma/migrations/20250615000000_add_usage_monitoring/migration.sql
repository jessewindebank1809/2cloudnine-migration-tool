-- CreateTable
CREATE TABLE "usage_events" (
    "id" TEXT NOT NULL,
    "event_type" VARCHAR(50) NOT NULL,
    "user_id" TEXT,
    "organisation_id" TEXT,
    "migration_id" TEXT,
    "session_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_metrics" (
    "id" TEXT NOT NULL,
    "metric_name" VARCHAR(100) NOT NULL,
    "metric_value" DECIMAL(12,4) NOT NULL,
    "tags" JSONB NOT NULL DEFAULT '{}',
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "usage_events_event_type_idx" ON "usage_events"("event_type");

-- CreateIndex
CREATE INDEX "usage_events_user_id_idx" ON "usage_events"("user_id");

-- CreateIndex
CREATE INDEX "usage_events_organisation_id_idx" ON "usage_events"("organisation_id");

-- CreateIndex
CREATE INDEX "usage_events_created_at_idx" ON "usage_events"("created_at");

-- CreateIndex
CREATE INDEX "usage_metrics_metric_name_idx" ON "usage_metrics"("metric_name");

-- CreateIndex
CREATE INDEX "usage_metrics_recorded_at_idx" ON "usage_metrics"("recorded_at");

-- AddForeignKey
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_migration_id_fkey" FOREIGN KEY ("migration_id") REFERENCES "migration_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "migration_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;