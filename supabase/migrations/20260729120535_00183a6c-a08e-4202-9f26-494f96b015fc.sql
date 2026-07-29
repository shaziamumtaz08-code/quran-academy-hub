select cron.schedule(
  'quiz-job-resume-2m',
  '*/2 * * * *',
  $$
  select net.http_post(
    url := 'https://sienlnxwwdqnybugipdt.supabase.co/functions/v1/quiz-job-resume',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpZW5sbnh3d2RxbnlidWdpcGR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxMDM1MzgsImV4cCI6MjA4MTY3OTUzOH0.GZ7T6hjLTIv7ie92UJrVjkjmkQTYX7KzLJ-mDGrAm3A"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);