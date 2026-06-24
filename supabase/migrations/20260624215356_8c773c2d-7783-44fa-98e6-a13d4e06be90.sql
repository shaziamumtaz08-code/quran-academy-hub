
-- Students can view their own whatsapp contact record
CREATE POLICY "Students view own whatsapp contact"
ON public.whatsapp_contacts FOR SELECT
TO authenticated
USING (profile_id = auth.uid());

-- Parents can view linked children's whatsapp contact records
CREATE POLICY "Parents view children whatsapp contact"
ON public.whatsapp_contacts FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.student_parent_links spl
     WHERE spl.parent_id = auth.uid()
       AND spl.student_id = whatsapp_contacts.profile_id
  )
);

-- Students can view their own whatsapp messages
CREATE POLICY "Students view own whatsapp messages"
ON public.whatsapp_messages FOR SELECT
TO authenticated
USING (
  contact_id IN (
    SELECT id FROM public.whatsapp_contacts WHERE profile_id = auth.uid()
  )
);

-- Parents can view linked children's whatsapp messages
CREATE POLICY "Parents view children whatsapp messages"
ON public.whatsapp_messages FOR SELECT
TO authenticated
USING (
  contact_id IN (
    SELECT wc.id FROM public.whatsapp_contacts wc
      JOIN public.student_parent_links spl
        ON spl.student_id = wc.profile_id
     WHERE spl.parent_id = auth.uid()
  )
);
