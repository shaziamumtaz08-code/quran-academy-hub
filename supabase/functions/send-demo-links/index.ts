// Sends shareable demo links (WhatsApp first, email fallback) to teacher & student
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SENDER_NAME = "Admissions";
const FROM_EMAIL = "Admissions <onboarding@resend.dev>"; // safe default until user verifies a domain

function publicBase(): string {
  // Lovable preview/production URL. Caller can override via body.publicBase.
  return "https://lms.alqurantimeacademy.com";
}

function formatDateTime(date: string, time: string, tz: string | null): string {
  // date YYYY-MM-DD, time HH:MM:SS
  const iso = `${date}T${time}`;
  try {
    const d = new Date(iso);
    const opts: Intl.DateTimeFormatOptions = {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: tz || undefined,
      timeZoneName: tz ? "short" : undefined,
    };
    return new Intl.DateTimeFormat("en-US", opts).format(d);
  } catch {
    return `${date} ${time}${tz ? ` (${tz})` : ""}`;
  }
}

async function sendWhatsApp(supabase: any, phone: string, message: string): Promise<boolean> {
  try {
    const { data: waConfig } = await supabase
      .from("system_integrations" as any)
      .select("config")
      .eq("service_name", "whatsapp")
      .eq("is_active", true)
      .limit(1)
      .single();

    if (!waConfig?.config) return false;
    const config = waConfig.config as Record<string, string>;
    const apiUrl = config.api_url;
    const apiKey = config.api_key;
    if (!apiUrl || !apiKey) return false;

    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ phone, message }),
    });
    return res.ok;
  } catch (e) {
    console.error("WhatsApp send failed:", e);
    return false;
  }
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!RESEND_API_KEY || !LOVABLE_API_KEY) {
    console.error("Missing email keys");
    return false;
  }
  try {
    const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject,
        html,
      }),
    });
    if (!res.ok) {
      console.error("Resend error:", res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("Email send failed:", e);
    return false;
  }
}

function teacherEmailHTML(args: { teacherName: string; studentName: string; subject: string; when: string; link: string; }) {
  return `
  <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
    <h2 style="margin:0 0 8px;color:#0f2044">New demo scheduled</h2>
    <p>Assalamu Alaikum ${args.teacherName || "Teacher"},</p>
    <p>A demo class has been assigned to you:</p>
    <table style="border-collapse:collapse;margin:16px 0">
      <tr><td style="padding:4px 12px 4px 0;color:#64748b">Student:</td><td><strong>${args.studentName}</strong></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#64748b">Subject:</td><td>${args.subject || "—"}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#64748b">When:</td><td>${args.when}</td></tr>
    </table>
    <p>Open the demo details (and submit your feedback after the class) using your private link:</p>
    <p><a href="${args.link}" style="display:inline-block;background:#0f2044;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Open demo details</a></p>
    <p style="color:#64748b;font-size:12px;margin-top:24px">${SENDER_NAME} · Al Quran Time Academy</p>
  </div>`;
}

function studentEmailHTML(args: { studentName: string; teacherName: string; subject: string; when: string; link: string; }) {
  return `
  <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
    <h2 style="margin:0 0 8px;color:#0f2044">Your demo class is scheduled 🎉</h2>
    <p>Assalamu Alaikum ${args.studentName || ""},</p>
    <p>Your demo has been booked with <strong>${args.teacherName || "your teacher"}</strong>.</p>
    <table style="border-collapse:collapse;margin:16px 0">
      <tr><td style="padding:4px 12px 4px 0;color:#64748b">Subject:</td><td>${args.subject || "—"}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#64748b">When:</td><td>${args.when}</td></tr>
    </table>
    <p>Open your demo page to see the join link and details:</p>
    <p><a href="${args.link}" style="display:inline-block;background:#0f2044;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Open my demo page</a></p>
    <p style="color:#64748b;font-size:12px;margin-top:24px">${SENDER_NAME} · Al Quran Time Academy</p>
  </div>`;
}

function teacherWhatsApp(args: { teacherName: string; studentName: string; subject: string; when: string; link: string; }) {
  return `Assalamu Alaikum ${args.teacherName || "Teacher"} 👋

A new demo has been assigned to you:

👤 Student: ${args.studentName}
📚 Subject: ${args.subject || "—"}
🕒 When: ${args.when}

Open demo details (and submit feedback after class):
${args.link}

— ${SENDER_NAME}, Al Quran Time Academy`;
}

function studentWhatsApp(args: { studentName: string; teacherName: string; subject: string; when: string; link: string; }) {
  return `Assalamu Alaikum ${args.studentName || ""} 👋

Your demo class is confirmed:

👨‍🏫 Teacher: ${args.teacherName || "—"}
📚 Subject: ${args.subject || "—"}
🕒 When: ${args.when}

Open your demo page (Zoom link inside):
${args.link}

— ${SENDER_NAME}, Al Quran Time Academy`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const demoSessionId: string | undefined = body.demo_session_id;
    const isReschedule = !!body.reschedule;
    if (!demoSessionId) {
      return new Response(JSON.stringify({ error: "demo_session_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: ds, error: dsErr } = await supabase
      .from("demo_sessions")
      .select("*")
      .eq("id", demoSessionId)
      .single();
    if (dsErr || !ds) {
      return new Response(JSON.stringify({ error: "demo not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: lead }, { data: teacher }] = await Promise.all([
      supabase.from("leads").select("*").eq("id", ds.lead_id).single(),
      ds.teacher_id
        ? supabase.from("profiles").select("id, full_name, email, whatsapp_number").eq("id", ds.teacher_id).single()
        : Promise.resolve({ data: null } as any),
    ]);

    const when = formatDateTime(ds.scheduled_date, ds.scheduled_time, ds.timezone);
    const subject = (lead?.subject_interest || "").split(",").join(", ");
    const studentName = lead?.child_name || lead?.name || "";
    const teacherName = teacher?.full_name || "";
    const base = body.publicBase || publicBase();

    const teacherLink = `${base}/demo/${ds.teacher_share_token}`;
    const studentLink = `${base}/demo/${ds.student_share_token}`;

    const results: Record<string, any> = {};

    // ----- Teacher -----
    if (teacher) {
      const tMsg = teacherWhatsApp({ teacherName, studentName, subject, when, link: teacherLink });
      const tHtml = teacherEmailHTML({ teacherName, studentName, subject, when, link: teacherLink });
      const tSubject = isReschedule ? `📅 Demo rescheduled — ${studentName}` : `New demo assigned — ${studentName}`;

      let waOk = false;
      if (teacher.whatsapp_number) {
        waOk = await sendWhatsApp(supabase, teacher.whatsapp_number, tMsg);
      }
      let emailOk = false;
      if (!waOk && teacher.email) {
        emailOk = await sendEmail(teacher.email, tSubject, tHtml);
      }
      // Always queue an in-app notification for the teacher
      await supabase.from("notification_queue").insert({
        recipient_id: teacher.id,
        recipient_type: "user",
        notification_type: "demo_scheduled",
        title: tSubject,
        message: `Demo with ${studentName} — ${when}`,
        status: "pending",
        metadata: { demo_session_id: ds.id, link: teacherLink },
      });
      results.teacher = { whatsapp: waOk, email: emailOk, link: teacherLink };
    }

    // ----- Student / parent -----
    if (lead) {
      const sMsg = studentWhatsApp({ studentName, teacherName, subject, when, link: studentLink });
      const sHtml = studentEmailHTML({ studentName, teacherName, subject, when, link: studentLink });
      const sSubject = isReschedule ? `📅 Your demo time changed` : `Your demo class is scheduled 🎉`;

      let waOk = false;
      if (lead.phone_whatsapp) {
        waOk = await sendWhatsApp(supabase, lead.phone_whatsapp, sMsg);
      }
      let emailOk = false;
      if (!waOk && lead.email) {
        emailOk = await sendEmail(lead.email, sSubject, sHtml);
      }
      results.student = { whatsapp: waOk, email: emailOk, link: studentLink };
    }

    await supabase.from("demo_sessions").update({ share_sent_at: new Date().toISOString() }).eq("id", ds.id);

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("send-demo-links error:", e);
    return new Response(JSON.stringify({ error: e?.message || "internal" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
