-- First migration: Add new enum values to app_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin_admissions';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin_fees';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin_academic';