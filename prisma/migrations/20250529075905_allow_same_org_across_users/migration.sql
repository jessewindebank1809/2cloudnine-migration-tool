/*
  Warnings:

  - A unique constraint covering the columns `[salesforce_org_id,user_id]` on the table `organisations` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "organisations_salesforce_org_id_key";

-- CreateIndex
CREATE UNIQUE INDEX "organisations_salesforce_org_id_user_id_key" ON "organisations"("salesforce_org_id", "user_id");
