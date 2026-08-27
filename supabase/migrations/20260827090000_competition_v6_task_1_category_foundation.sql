-- V6 Task 1 — Competition category foundation.
--
-- The live Supabase project already contains Category 6 (Học tập).
-- This migration records the constraint change that allows category_id 1–6.
-- It does not create a second database and does not delete Category 6.

ALTER TABLE public.competition_records
    DROP CONSTRAINT IF EXISTS competition_records_category_id_check;

ALTER TABLE public.competition_records
    DROP CONSTRAINT IF EXISTS competition_records_category_id_chk;

ALTER TABLE public.competition_records
    ADD CONSTRAINT competition_records_category_id_check
    CHECK (
        category_id IS NULL
        OR category_id BETWEEN 1 AND 6
    );
