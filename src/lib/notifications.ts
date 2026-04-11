import { supabase } from '@/integrations/supabase/client';

export async function triggerNotification(
  eventTrigger: string,
  recipientId: string,
  variables: Record<string, string>,
) {
  try {
    // Find matching active templates for the 'lms' channel
    const { data: templates } = await supabase
      .from('notification_templates')
      .select('*')
      .eq('event_trigger', eventTrigger)
      .eq('is_active', true);

    if (!templates?.length) return;

    for (const template of templates) {
      // Replace variables in template text
      let message = template.template_text;
      for (const [key, value] of Object.entries(variables)) {
        message = message.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
      }

      // Insert into notification_queue
      await supabase.from('notification_queue').insert({
        recipient_id: recipientId,
        recipient_type: 'user',
        notification_type: eventTrigger,
        title: template.name,
        message,
        status: 'pending',
        metadata: { variables },
      });
    }
  } catch (err) {
    console.error('triggerNotification error:', err);
  }
}
