-- Add new columns to attendance table for enhanced attendance tracking
ALTER TABLE public.attendance 
ADD COLUMN IF NOT EXISTS absence_type text,
ADD COLUMN IF NOT EXISTS reason_category text,
ADD COLUMN IF NOT EXISTS reason_text text,
ADD COLUMN IF NOT EXISTS reschedule_date date,
ADD COLUMN IF NOT EXISTS reschedule_time time without time zone;

-- Add constraint for valid status values
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_status_check;
ALTER TABLE public.attendance 
ADD CONSTRAINT attendance_status_check 
CHECK (status IN ('present', 'student_absent', 'teacher_absent', 'teacher_leave', 'rescheduled', 'holiday'));

-- Add constraint for reason_category when applicable
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_reason_category_check;
ALTER TABLE public.attendance 
ADD CONSTRAINT attendance_reason_category_check 
CHECK (reason_category IS NULL OR reason_category IN ('sick', 'personal', 'emergency', 'internet_issue', 'other'));