// Seeds Quran reference data (ayah text + Qudratullah 15-line IndoPak page layout)
// from the public Quran.com QDC API into quran_ayahs / mushaf_pages / mushaf_lines / rukus.
// Admin-only. Idempotent: safe to re-run for any page range.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { corsHeaders } from "../_shared/cors.ts";

const MUSHAF = 6; // Indopak 15 lines (Qudratullah), 610 pages
const API = (page: number) =>
  `https://api.qurancdn.com/api/qdc/verses/by_page/${page}?words=true&word_fields=line_number,text_indopak,location,char_type_name&fields=text_indopak,juz_number,hizb_number,rub_el_hizb_number,ruku_number,sajdah_number,page_number&per_page=50&mushaf=${MUSHAF}`;

interface Word { line_number: number; text_indopak: string; location: string; char_type_name: string }
interface Verse {
  verse_key: string; text_indopak: string; juz_number: number; rub_el_hizb_number: number;
  ruku_number: number; sajdah_number: number | null; words: Word[];
}

async function fetchPage(page: number): Promise<Verse[]> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(API(page), { headers: { "User-Agent": "curl/8" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (Array.isArray(json?.verses)) return json.verses as Verse[];
    } catch (_e) { /* retry */ }
    await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
  }
  throw new Error(`Failed to fetch page ${page}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // --- auth: admins only ---
    const authHeader = req.headers.get("Authorization") ?? "";
    const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await anon.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: roles } = await service.from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = (roles ?? []).some((r: { role: string }) => ["admin", "super_admin"].includes(r.role));
    if (!isAdmin) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json().catch(() => ({}));
    const fromPage = Math.max(1, Number(body.fromPage ?? 1));
    const toPage = Math.min(610, Number(body.toPage ?? 610));

    const { data: edition } = await service.from("mushaf_editions").select("id").eq("code", "qudratullah-15").maybeSingle();
    if (!edition) throw new Error("Mushaf edition qudratullah-15 not found");
    const editionId = edition.id as string;

    const ayahRows: Record<string, unknown>[] = [];
    const pageRows: Record<string, unknown>[] = [];
    const lineRows: Record<string, unknown>[] = [];
    const rukuMap = new Map<string, { surah_number: number; ruku_number: number; ayah_from: number; ayah_to: number; juz_number: number }>();

    for (let page = fromPage; page <= toPage; page++) {
      const verses = await fetchPage(page);
      if (!verses.length) continue;

      const surahs: number[] = [];
      let juz = 0;
      for (const v of verses) {
        const [s, a] = v.verse_key.split(":").map(Number);
        surahs.push(s);
        juz = juz || v.juz_number;
        ayahRows.push({
          surah_number: s,
          ayah_number: a,
          text_indopak: v.text_indopak ?? null,
          juz_number: v.juz_number,
          hizb_quarter: v.rub_el_hizb_number,
          ruku_number: v.ruku_number,
          sajdah: v.sajdah_number != null,
        });
        const key = `${s}:${v.ruku_number}`;
        const cur = rukuMap.get(key);
        if (!cur) rukuMap.set(key, { surah_number: s, ruku_number: v.ruku_number, ayah_from: a, ayah_to: a, juz_number: v.juz_number });
        else { cur.ayah_from = Math.min(cur.ayah_from, a); cur.ayah_to = Math.max(cur.ayah_to, a); }
      }

      pageRows.push({
        edition_id: editionId,
        page_number: page,
        juz_number: juz || null,
        surah_start: Math.min(...surahs),
        surah_end: Math.max(...surahs),
      });

      // group words by line
      const byLine = new Map<number, Word[]>();
      for (const v of verses) {
        for (const w of v.words ?? []) {
          if (!w.location) continue;
          const arr = byLine.get(w.line_number) ?? [];
          arr.push(w);
          byLine.set(w.line_number, arr);
        }
      }

      const built = new Map<number, Record<string, unknown>>();
      for (const [lineNumber, words] of byLine) {
        words.sort((a, b) => {
          const [as, aa, aw] = a.location.split(":").map(Number);
          const [bs, ba, bw] = b.location.split(":").map(Number);
          return as - bs || aa - ba || aw - bw;
        });
        const first = words[0].location.split(":").map(Number);
        const last = words[words.length - 1].location.split(":").map(Number);
        built.set(lineNumber, {
          edition_id: editionId,
          page_number: page,
          line_number: lineNumber,
          line_type: "ayah",
          surah_number: first[0],
          first_surah: first[0], first_ayah: first[1], first_word_index: first[2],
          last_surah: last[0], last_ayah: last[1], last_word_index: last[2],
          is_centered: false,
          text_indopak: words.map((w) => w.text_indopak).filter(Boolean).join(" "),
        });
      }

      // fill non-text lines (surah headings / basmallah / decorative)
      for (let ln = 1; ln <= 15; ln++) {
        if (built.has(ln)) continue;
        let nextAyahLine: Record<string, unknown> | undefined;
        for (let k = ln + 1; k <= 15; k++) { if (built.has(k)) { nextAyahLine = built.get(k); break; } }
        const startsSurah = nextAyahLine && Number(nextAyahLine.first_ayah) === 1;
        const gapBefore = built.has(ln - 1) === false && ln > 1;
        built.set(ln, {
          edition_id: editionId,
          page_number: page,
          line_number: ln,
          line_type: startsSurah ? (gapBefore ? "basmallah" : "surah_name") : "blank",
          surah_number: startsSurah ? Number(nextAyahLine!.first_surah) : null,
          first_surah: null, first_ayah: null, first_word_index: null,
          last_surah: null, last_ayah: null, last_word_index: null,
          is_centered: true,
          text_indopak: null,
        });
      }

      for (let ln = 1; ln <= 15; ln++) lineRows.push(built.get(ln)!);
    }

    const chunk = async (table: string, rows: Record<string, unknown>[], onConflict: string) => {
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await service.from(table).upsert(rows.slice(i, i + 500), { onConflict });
        if (error) throw new Error(`${table}: ${error.message}`);
      }
    };

    await chunk("quran_ayahs", ayahRows, "surah_number,ayah_number");
    await chunk("mushaf_pages", pageRows, "edition_id,page_number");
    await chunk("mushaf_lines", lineRows, "edition_id,page_number,line_number");

    const rukuRows = [...rukuMap.values()];
    for (const r of rukuRows) {
      await service.from("rukus").delete().eq("surah_number", r.surah_number).eq("ruku_number", r.ruku_number);
    }
    if (rukuRows.length) {
      const { error } = await service.from("rukus").insert(rukuRows);
      if (error) throw new Error(`rukus: ${error.message}`);
    }

    return new Response(JSON.stringify({
      ok: true, fromPage, toPage,
      ayahs: ayahRows.length, pages: pageRows.length, lines: lineRows.length, rukus: rukuRows.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
