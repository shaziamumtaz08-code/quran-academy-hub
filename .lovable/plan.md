
# WhatsApp Integration Plan (via WhatsChimp)

## Phase 1: Database Schema
- Create `whatsapp_messages` table (id, contact_phone, contact_name, direction, message_text, attachment_url, attachment_type, delivery_status, wa_message_id, template_name, source_group_id, forwarded_to_task_id, forwarded_to_group_id, forwarded_to_user_id, is_forwarded, created_at, updated_at)
- Create `whatsapp_contacts` table (id, phone, name, profile_id, last_message_at, unread_count, created_at)
- RLS: Admin + Super Admin full access, teachers see their assigned students' threads only
- Add WhatsChimp API key secret

## Phase 2: Edge Function — Webhook Receiver
- `whatsapp-webhook` edge function to receive incoming messages from WhatsChimp
- Parse WhatsChimp webhook payload, store in whatsapp_messages
- Update whatsapp_contacts on each message
- Auto-match phone to profile via profiles.phone

## Phase 3: Edge Function — Send Message
- `whatsapp-send` edge function to send outgoing messages via WhatsChimp API
- Support text, template, and attachment messages
- Store sent message in whatsapp_messages with delivery tracking

## Phase 4: WhatsApp Inbox UI
- New `/whatsapp` page with WhatsApp-style inbox
- Left panel: contact list with last message preview, unread badges
- Right panel: thread view with message bubbles, timestamps, delivery status
- Quick actions: Forward to user/group, Convert to WorkHub task
- Search bar across all messages
- Attachment previews (images, PDFs, voice)
- Template send dialog for bulk/templated messages

## Phase 5: Integration with existing systems
- Forward WhatsApp message → creates task in WorkHub (tasks table)
- Forward WhatsApp message → sends to chat group/user
- Link notification_templates to WhatsApp sending
- Add WhatsApp nav item to Communication Center
