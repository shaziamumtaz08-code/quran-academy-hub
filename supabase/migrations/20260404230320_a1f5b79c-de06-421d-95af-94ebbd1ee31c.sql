
-- WhatsApp contacts table
CREATE TABLE public.whatsapp_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  name TEXT,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  last_message_at TIMESTAMPTZ,
  unread_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage whatsapp_contacts"
  ON public.whatsapp_contacts FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Teachers can view their students whatsapp contacts"
  ON public.whatsapp_contacts FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'teacher') AND
    profile_id IN (SELECT public.get_teacher_student_ids(auth.uid()))
  );

CREATE TRIGGER update_whatsapp_contacts_updated_at
  BEFORE UPDATE ON public.whatsapp_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- WhatsApp messages table
CREATE TABLE public.whatsapp_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.whatsapp_contacts(id) ON DELETE CASCADE,
  direction TEXT NOT NULL DEFAULT 'inbound' CHECK (direction IN ('inbound', 'outbound')),
  message_text TEXT,
  attachment_url TEXT,
  attachment_type TEXT,
  delivery_status TEXT NOT NULL DEFAULT 'sent' CHECK (delivery_status IN ('sent', 'delivered', 'read', 'failed', 'queued')),
  wa_message_id TEXT,
  template_name TEXT,
  is_forwarded BOOLEAN NOT NULL DEFAULT false,
  forwarded_to_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  forwarded_to_group_id UUID REFERENCES public.chat_groups(id) ON DELETE SET NULL,
  forwarded_to_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  sent_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage whatsapp_messages"
  ON public.whatsapp_messages FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Teachers can view their students whatsapp messages"
  ON public.whatsapp_messages FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'teacher') AND
    contact_id IN (
      SELECT wc.id FROM public.whatsapp_contacts wc
      WHERE wc.profile_id IN (SELECT public.get_teacher_student_ids(auth.uid()))
    )
  );

CREATE TRIGGER update_whatsapp_messages_updated_at
  BEFORE UPDATE ON public.whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for whatsapp_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;

-- Index for fast thread lookups
CREATE INDEX idx_whatsapp_messages_contact_id ON public.whatsapp_messages(contact_id, created_at DESC);
CREATE INDEX idx_whatsapp_messages_wa_id ON public.whatsapp_messages(wa_message_id);
CREATE INDEX idx_whatsapp_contacts_profile ON public.whatsapp_contacts(profile_id);
