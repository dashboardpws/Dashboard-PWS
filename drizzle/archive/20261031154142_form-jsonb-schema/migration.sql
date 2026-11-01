-- Custom SQL migration file, put your code below! --
-- Pindahkan definisi beserta ID section, field, opsi, dan aturan yang sudah
-- dipakai ke JSONB terlebih dahulu. ID field harus tetap sama karena jawaban
-- historis menyimpan UUID tersebut.
ALTER TABLE form_versions ADD COLUMN "schema" jsonb;
--> statement-breakpoint

DO $$
BEGIN
IF to_regclass('public.form_sections') IS NOT NULL
  AND to_regclass('public.form_fields') IS NOT NULL
  AND to_regclass('public.form_field_options') IS NOT NULL
  AND to_regclass('public.form_field_autofills') IS NOT NULL
  AND to_regclass('public.form_field_visibility_rules') IS NOT NULL THEN
UPDATE form_versions fv
SET "schema" = jsonb_build_object(
  'version', fv.version,
  'sections', COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'name', s.nama,
        'label', s.nama,
        'description', s.deskripsi,
        'order', s.urutan,
        'active', s.aktif,
        'visibilityRules', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', r.id,
            'targetType', r."targetType",
            'targetId', r."targetId",
            'triggerFieldId', r."triggerFieldId",
            'operator', r.operator,
            'nilaiAcuan', r."nilaiAcuan",
            'aktif', r.aktif,
            'urutan', r.urutan
          ) ORDER BY r.urutan)
          FROM form_field_visibility_rules r
          WHERE r."formVersionId" = fv.id
            AND r."targetType" = 'section'
            AND r."targetId" = s.id
        ), '[]'::jsonb),
        'fields', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', f.id,
              'name', f.nama,
              'label', f.label,
              'type', f.tipe::text,
              'required', f.wajib,
              'active', f.aktif,
              'order', f.urutan,
              'description', f.deskripsi,
              'placeholder', f.placeholder,
              'columns', f."jumlahKolom",
              'optionSourceType', f."optionSourceType",
              'optionSourceKey', f."optionSourceKey",
              'options', COALESCE((
                SELECT jsonb_agg(jsonb_build_object(
                  'id', o.id,
                  'value', o.value,
                  'label', COALESCE(o.label, o.value),
                  'order', o.urutan,
                  'active', o.aktif
                ) ORDER BY o.urutan)
                FROM form_field_options o WHERE o."fieldId" = f.id
              ), '[]'::jsonb),
              'autofill', COALESCE((
                SELECT jsonb_agg(jsonb_build_object(
                  'id', a.id,
                  'triggerFieldId', a."triggerFieldId",
                  'targetFieldId', a."targetFieldId",
                  'sumber', a.sumber,
                  'kolom', a.kolom,
                  'transform', a.transform,
                  'mode', a.mode,
                  'aktif', a.aktif,
                  'urutan', a.urutan
                ) ORDER BY a.urutan)
                FROM form_field_autofills a WHERE a."targetFieldId" = f.id
              ), '[]'::jsonb),
              'visibilityRules', COALESCE((
                SELECT jsonb_agg(jsonb_build_object(
                  'id', r.id,
                  'targetType', r."targetType",
                  'targetId', r."targetId",
                  'triggerFieldId', r."triggerFieldId",
                  'operator', r.operator,
                  'nilaiAcuan', r."nilaiAcuan",
                  'aktif', r.aktif,
                  'urutan', r.urutan
                ) ORDER BY r.urutan)
                FROM form_field_visibility_rules r
                WHERE r."formVersionId" = fv.id
                  AND r."targetType" = 'field'
                  AND r."targetId" = f.id
              ), '[]'::jsonb)
            ) ORDER BY f.urutan
          )
          FROM form_fields f WHERE f."sectionId" = s.id
        ), '[]'::jsonb)
      ) ORDER BY s.urutan
    )
    FROM form_sections s WHERE s."formVersionId" = fv.id
  ), '[]'::jsonb)
);
ELSE
  -- Sebagian instalasi lama sudah kehilangan tabel definisi. Sisakan versi
  -- kosong yang valid; seeder mengisi form bawaan dari template dan
  -- mempertahankan UUID record_legacy yang masih dipakai jawaban lama.
  UPDATE form_versions fv
  SET "schema" = jsonb_build_object('version', fv.version, 'sections', '[]'::jsonb);
END IF;
END $$;
--> statement-breakpoint

ALTER TABLE form_versions ALTER COLUMN "schema" SET NOT NULL;
--> statement-breakpoint

-- Jawaban tetap menyimpan UUID field historis; hanya validasi relasi FK-nya
-- yang berpindah ke schema versi form di backend.
DO $$
DECLARE constraint_name text;
BEGIN
  IF to_regclass('public.form_fields') IS NOT NULL THEN
  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'survey_entries'::regclass
      AND confrelid = to_regclass('public.form_fields')
  LOOP
    EXECUTE format('ALTER TABLE survey_entries DROP CONSTRAINT %I', constraint_name);
  END LOOP;
  END IF;
END $$;
--> statement-breakpoint

DROP TABLE IF EXISTS form_field_options;
--> statement-breakpoint
DROP TABLE IF EXISTS form_field_autofills;
--> statement-breakpoint
DROP TABLE IF EXISTS form_field_visibility_rules;
--> statement-breakpoint
DROP TABLE IF EXISTS form_fields;
--> statement-breakpoint
DROP TABLE IF EXISTS form_sections;
