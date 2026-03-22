-- Run this in your Supabase SQL Editor

-- Adds gender to the baby table, if not already handled by sex
ALTER TABLE public.baby ADD COLUMN IF NOT EXISTS gender VARCHAR(1);

-- Optionally map the existing sex column to gender for consistent usage
-- ALTER TABLE public.baby RENAME COLUMN sex TO gender;

-- Profile image support for baby
ALTER TABLE public.baby ADD COLUMN IF NOT EXISTS profile_image_url TEXT;

-- Activity image support
ALTER TABLE public.activity ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Ensure the 'avatars' storage bucket exists for baby profile pictures
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for avatars bucket to ensure authenticated users can upload
CREATE POLICY "Avatar images are publicly accessible."
    ON storage.objects FOR SELECT
    USING (bucket_id = 'avatars');

CREATE POLICY "Anyone can upload an avatar."
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Users can update their own avatars."
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'avatars');
