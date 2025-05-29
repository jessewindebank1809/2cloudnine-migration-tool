-- CreateTable
CREATE TABLE "migration_templates" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(50) NOT NULL,
    "version" VARCHAR(20) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "template_config" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "migration_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "migration_template_usage" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "selected_records" JSONB NOT NULL DEFAULT '[]',
    "validation_results" JSONB NOT NULL DEFAULT '{}',
    "execution_config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "migration_template_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "migration_record_selections" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "object_type" VARCHAR(255) NOT NULL,
    "source_record_id" VARCHAR(18) NOT NULL,
    "is_selected" BOOLEAN NOT NULL DEFAULT true,
    "selection_criteria" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "migration_record_selections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "migration_templates_category_idx" ON "migration_templates"("category");

-- CreateIndex
CREATE INDEX "migration_templates_is_active_idx" ON "migration_templates"("is_active");

-- CreateIndex
CREATE INDEX "migration_template_usage_template_id_idx" ON "migration_template_usage"("template_id");

-- CreateIndex
CREATE INDEX "migration_template_usage_project_id_idx" ON "migration_template_usage"("project_id");

-- CreateIndex
CREATE INDEX "migration_record_selections_project_id_idx" ON "migration_record_selections"("project_id");

-- CreateIndex
CREATE INDEX "migration_record_selections_object_type_idx" ON "migration_record_selections"("object_type");

-- CreateIndex
CREATE UNIQUE INDEX "migration_record_selections_project_record_unique" ON "migration_record_selections"("project_id", "source_record_id");

-- AddForeignKey
ALTER TABLE "migration_template_usage" ADD CONSTRAINT "migration_template_usage_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "migration_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "migration_template_usage" ADD CONSTRAINT "migration_template_usage_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "migration_projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "migration_record_selections" ADD CONSTRAINT "migration_record_selections_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "migration_projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE; 