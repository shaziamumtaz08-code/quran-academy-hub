-- 1) Blank spacer lines were mis-labelled as basmallah
UPDATE public.mushaf_lines
SET line_type = 'blank'
WHERE line_type = 'basmallah' AND (text_indopak IS NULL OR btrim(text_indopak) = '');

-- 2) Restore exactly one basmallah line per surah opening (except Al-Fatihah and At-Tawbah)
WITH first_ayah AS (
  SELECT edition_id, page_number, surah_number, MIN(line_number) AS ln
  FROM public.mushaf_lines
  WHERE line_type = 'ayah'
  GROUP BY edition_id, page_number, surah_number
),
targets AS (
  SELECT l.id
  FROM public.mushaf_lines l
  JOIN first_ayah f
    ON f.edition_id = l.edition_id
   AND f.page_number = l.page_number
   AND f.surah_number = l.surah_number
  WHERE l.line_type = 'blank'
    AND l.line_number = f.ln - 1
    AND l.surah_number NOT IN (1, 9)
    AND EXISTS (
      SELECT 1 FROM public.mushaf_lines s
      WHERE s.edition_id = l.edition_id
        AND s.page_number = l.page_number
        AND s.surah_number = l.surah_number
        AND s.line_type = 'surah_name'
    )
)
UPDATE public.mushaf_lines l
SET line_type = 'basmallah'
FROM targets t
WHERE l.id = t.id;