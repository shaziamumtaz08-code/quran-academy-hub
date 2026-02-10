
-- Add deleted_at column for soft-delete (recycle bin) to exams, resources, folders
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Add archived_at column to profiles for user archiving
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL;

-- Create indexes for efficient queries on non-deleted items
CREATE INDEX IF NOT EXISTS idx_exams_deleted_at ON public.exams(deleted_at);
CREATE INDEX IF NOT EXISTS idx_resources_deleted_at ON public.resources(deleted_at);
CREATE INDEX IF NOT EXISTS idx_folders_deleted_at ON public.folders(deleted_at);
CREATE INDEX IF NOT EXISTS idx_profiles_archived_at ON public.profiles(archived_at);
