-- Add onDelete cascade to form_versions.formId -> forms.id
ALTER TABLE "form_versions" DROP CONSTRAINT IF EXISTS "form_versions_form_id_forms_id_fk";
ALTER TABLE "form_versions" ADD CONSTRAINT "form_versions_form_id_forms_id_fk" FOREIGN KEY ("formId") REFERENCES "forms"("id") ON DELETE CASCADE;