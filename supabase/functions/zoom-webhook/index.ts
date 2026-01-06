import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ZoomEvent {
  event: string;
  payload: {
    object: {
      id: string;
      uuid: string;
      host_id: string;
      topic?: string;
      start_time?: string;
      end_time?: string;
      duration?: number;
      participant?: {
        user_id: string;
        user_name: string;
        email?: string;
        join_time?: string;
        leave_time?: string;
      };
    };
  };
  event_ts: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Zoom sends events as POST requests
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const event: ZoomEvent = await req.json();
    console.log('Received Zoom webhook event:', event.event);
    console.log('Event payload:', JSON.stringify(event.payload));

    const meetingId = event.payload.object.uuid || event.payload.object.id;
    const hostId = event.payload.object.host_id;

    switch (event.event) {
      case 'meeting.started': {
        console.log('Meeting started:', meetingId);
        
        // Find the license by host_id or meeting link pattern
        const { data: license } = await supabase
          .from('zoom_licenses')
          .select('id')
          .eq('host_id', hostId)
          .maybeSingle();

        if (license) {
          // Update license to busy
          await supabase
            .from('zoom_licenses')
            .update({ status: 'busy', last_used_at: new Date().toISOString() })
            .eq('id', license.id);

          console.log('Updated license to busy:', license.id);
        }
        break;
      }

      case 'meeting.ended': {
        console.log('Meeting ended:', meetingId);
        
        // Find and release the license
        const { data: license } = await supabase
          .from('zoom_licenses')
          .select('id')
          .eq('host_id', hostId)
          .maybeSingle();

        if (license) {
          await supabase
            .from('zoom_licenses')
            .update({ status: 'available' })
            .eq('id', license.id);

          console.log('Released license:', license.id);
        }

        // Find active sessions for this host and mark as completed
        const { data: sessions } = await supabase
          .from('live_sessions')
          .select('id')
          .eq('status', 'live')
          .eq('license_id', license?.id);

        if (sessions && sessions.length > 0) {
          for (const session of sessions) {
            await supabase
              .from('live_sessions')
              .update({ 
                status: 'completed', 
                actual_end: new Date().toISOString() 
              })
              .eq('id', session.id);

            console.log('Completed session:', session.id);
          }
        }
        break;
      }

      case 'meeting.participant_joined': {
        const participant = event.payload.object.participant;
        if (!participant) {
          console.log('No participant data in event');
          break;
        }

        console.log('Participant joined:', participant.user_name, participant.email);

        // Find user by email in profiles
        const { data: user } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', participant.email)
          .maybeSingle();

        if (!user) {
          console.log('User not found for email:', participant.email);
          break;
        }

        // Find the active session for this meeting
        const { data: license } = await supabase
          .from('zoom_licenses')
          .select('id')
          .eq('host_id', hostId)
          .maybeSingle();

        const { data: session } = await supabase
          .from('live_sessions')
          .select('id, actual_start')
          .eq('status', 'live')
          .eq('license_id', license?.id)
          .maybeSingle();

        if (session) {
          // Log the join event
          const { error } = await supabase
            .from('zoom_attendance_logs')
            .insert({
              session_id: session.id,
              user_id: user.id,
              action: 'join_intent',
              join_time: participant.join_time || new Date().toISOString(),
            });

          if (error) {
            console.error('Error logging join:', error);
          } else {
            console.log('Logged join for user:', user.id);
          }

          // Check for late entry (>10 mins after session start)
          if (session.actual_start) {
            const sessionStart = new Date(session.actual_start);
            const joinTime = new Date(participant.join_time || new Date().toISOString());
            const lateMinutes = Math.floor((joinTime.getTime() - sessionStart.getTime()) / 60000);

            if (lateMinutes > 10) {
              // Check if WhatsApp notifications are enabled
              const { data: setting } = await supabase
                .from('app_settings')
                .select('setting_value')
                .eq('setting_key', 'whatsapp_notifications_enabled')
                .maybeSingle();

              const isEnabled = setting?.setting_value?.enabled === true;

              if (isEnabled) {
                // Get user role
                const { data: roleData } = await supabase
                  .from('user_roles')
                  .select('role')
                  .eq('user_id', user.id)
                  .maybeSingle();

                const userRole = roleData?.role || 'student';

                // Get parent if student
                if (userRole === 'student') {
                  const { data: parentLink } = await supabase
                    .from('student_parent_links')
                    .select('parent_id')
                    .eq('student_id', user.id)
                    .maybeSingle();

                  if (parentLink) {
                    await supabase.from('notification_queue').insert({
                      recipient_id: parentLink.parent_id,
                      recipient_type: 'parent',
                      notification_type: 'accountability_issue',
                      title: 'Late Entry Alert',
                      message: `Alert: ${participant.user_name} was ${lateMinutes} minutes late for class.`,
                      metadata: { 
                        user_id: user.id, 
                        late_minutes: lateMinutes, 
                        session_id: session.id 
                      },
                    });
                    console.log('Created late notification for parent:', parentLink.parent_id);
                  }
                }
              }
            }
          }
        }
        break;
      }

      case 'meeting.participant_left': {
        const participant = event.payload.object.participant;
        if (!participant) {
          console.log('No participant data in event');
          break;
        }

        console.log('Participant left:', participant.user_name, participant.email);

        // Find user by email
        const { data: user } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', participant.email)
          .maybeSingle();

        if (!user) {
          console.log('User not found for email:', participant.email);
          break;
        }

        // Find the active session
        const { data: license } = await supabase
          .from('zoom_licenses')
          .select('id')
          .eq('host_id', hostId)
          .maybeSingle();

        const { data: session } = await supabase
          .from('live_sessions')
          .select('id')
          .eq('license_id', license?.id)
          .maybeSingle();

        if (session) {
          // Find the join log and update with leave time
          const { data: joinLog } = await supabase
            .from('zoom_attendance_logs')
            .select('id, join_time')
            .eq('session_id', session.id)
            .eq('user_id', user.id)
            .eq('action', 'join_intent')
            .is('leave_time', null)
            .order('timestamp', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (joinLog) {
            const leaveTime = new Date(participant.leave_time || new Date().toISOString());
            const joinTime = new Date(joinLog.join_time);
            const durationMinutes = Math.floor((leaveTime.getTime() - joinTime.getTime()) / 60000);

            await supabase
              .from('zoom_attendance_logs')
              .update({
                action: 'leave',
                leave_time: leaveTime.toISOString(),
                total_duration_minutes: durationMinutes,
              })
              .eq('id', joinLog.id);

            console.log('Updated leave time for user:', user.id, 'duration:', durationMinutes);

            // Check for short session (<25 mins in 30 min slot)
            if (durationMinutes < 25) {
              const { data: setting } = await supabase
                .from('app_settings')
                .select('setting_value')
                .eq('setting_key', 'whatsapp_notifications_enabled')
                .maybeSingle();

              const isEnabled = setting?.setting_value?.enabled === true;

              if (isEnabled) {
                const { data: roleData } = await supabase
                  .from('user_roles')
                  .select('role')
                  .eq('user_id', user.id)
                  .maybeSingle();

                const userRole = roleData?.role || 'student';

                if (userRole === 'student') {
                  const { data: parentLink } = await supabase
                    .from('student_parent_links')
                    .select('parent_id')
                    .eq('student_id', user.id)
                    .maybeSingle();

                  if (parentLink) {
                    await supabase.from('notification_queue').insert({
                      recipient_id: parentLink.parent_id,
                      recipient_type: 'parent',
                      notification_type: 'accountability_issue',
                      title: 'Short Session Alert',
                      message: `Alert: ${participant.user_name} left class after only ${durationMinutes} minutes.`,
                      metadata: { 
                        user_id: user.id, 
                        duration_minutes: durationMinutes, 
                        session_id: session.id 
                      },
                    });
                    console.log('Created short session notification for parent:', parentLink.parent_id);
                  }
                }
              }
            }
          }
        }
        break;
      }

      default:
        console.log('Unhandled event type:', event.event);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
