import { requireRole } from "../_shared/auth.ts";
// Lovable AI auto-tag + summary for a library item
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await requireRole(req, ["admin", "super_admin", "teacher", "admin_academic", "admin_division"]);
    if (!auth.ok) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { item_id } = await req.json();
    if (!item_id) throw new Error("item_id required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: item, error } = await supabase
      .from("library_items")
      .select("id, title, description, author, type, tags")
      .eq("id", item_id)
      .single();
    if (error || !item) throw new Error("Item not found");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const prompt = `You are a librarian. For this resource, output JSON with:
- "tags": 5-8 short lowercase topic tags (single or hyphenated words, no punctuation)
- "summary": one concise sentence (max 25 words) describing what it is

Resource:
Title: ${item.title}
Author: ${item.author || "Unknown"}
Type: ${item.type}
Existing description: ${item.description || "(none)"}

Return ONLY valid JSON, no markdown.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (aiRes.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit, try again shortly" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiRes.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiRes.json();
    const raw = aiData?.choices?.[0]?.message?.content || "{}";
    const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
    let parsed: { tags?: string[]; summary?: string } = {};
    try { parsed = JSON.parse(cleaned); } catch { /* ignore */ }

    const ai_tags = (parsed.tags || []).map((t: string) => t.toLowerCase().trim()).filter(Boolean).slice(0, 8);
    const ai_summary = parsed.summary?.trim() || null;

    await supabase.from("library_items")
      .update({ ai_tags, ai_summary })
      .eq("id", item_id);

    return new Response(JSON.stringify({ ai_tags, ai_summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
