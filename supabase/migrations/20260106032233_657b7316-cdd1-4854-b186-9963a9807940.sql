-- Create notification_queue table for WhatsApp alerts
CREATE TABLE public.notification_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_id UUID NOT NULL,
  recipient_type TEXT NOT NULL DEFAULT 'parent', -- parent, teacher, student
  notification_type TEXT NOT NULL, -- accountability_issue, class_reminder, etc.
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, failed
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  error_message TEXT
);

-- Enable RLS
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admin can manage all notifications" 
ON public.notification_queue 
FOR ALL 
USING (is_admin(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Users can view own notifications" 
ON public.notification_queue 
FOR SELECT 
USING (recipient_id = auth.uid());

-- Create app_settings table for global settings
CREATE TABLE public.app_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admin can manage settings" 
ON public.app_settings 
FOR ALL 
USING (is_admin(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Authenticated users can view settings" 
ON public.app_settings 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Insert default WhatsApp notification setting
INSERT INTO public.app_settings (setting_key, setting_value, description)
VALUES ('whatsapp_notifications_enabled', '{"enabled": false}', 'Enable WhatsApp alerts for parents when accountability issues are detected');

-- Add trigger for updated_at
CREATE TRIGGER update_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_notification_queue_status ON public.notification_queue(status);
CREATE INDEX idx_notification_queue_recipient ON public.notification_queue(recipient_id);
CREATE INDEX idx_app_settings_key ON public.app_settings(setting_key);