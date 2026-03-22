-- Script para configurar la eliminación en cascada en Supabase
-- Ejecuta esto en tu SQL Editor para que al borrar un usuario de Auth, se borre todo lo demás automáticamente.

-- 1. Asegurar cascada entre Auth User y Tutor
ALTER TABLE public.tutor
DROP CONSTRAINT IF EXISTS tutor_tutor_id_fkey,
ADD CONSTRAINT tutor_tutor_id_fkey 
    FOREIGN KEY (tutor_id) 
    REFERENCES auth.users(id) 
    ON DELETE CASCADE;

-- 2. Asegurar cascada entre Tutor y Bebé
ALTER TABLE public.baby
DROP CONSTRAINT IF EXISTS baby_tutor_id_fkey,
ADD CONSTRAINT baby_tutor_id_fkey 
    FOREIGN KEY (tutor_id) 
    REFERENCES public.tutor(tutor_id) 
    ON DELETE CASCADE;

-- 3. Asegurar cascada entre Bebé y Actividades Planificadas
ALTER TABLE public.planned_activity
DROP CONSTRAINT IF EXISTS planned_activity_baby_id_fkey,
ADD CONSTRAINT planned_activity_baby_id_fkey 
    FOREIGN KEY (baby_id) 
    REFERENCES public.baby(baby_id) 
    ON DELETE CASCADE;

-- 4. Asegurar cascada entre Bebé y Log de Actividades
ALTER TABLE public.activity_log
DROP CONSTRAINT IF EXISTS activity_log_baby_id_fkey,
ADD CONSTRAINT activity_log_baby_id_fkey 
    FOREIGN KEY (baby_id) 
    REFERENCES public.baby(baby_id) 
    ON DELETE CASCADE;

-- 5. Opcional: Cascada para el resumen de progreso si existe la tabla
-- ALTER TABLE public.baby_progress_summary
-- DROP CONSTRAINT IF EXISTS baby_progress_summary_baby_id_fkey,
-- ADD CONSTRAINT baby_progress_summary_baby_id_fkey 
--     FOREIGN KEY (baby_id) 
--     REFERENCES public.baby(baby_id) 
--     ON DELETE CASCADE;
