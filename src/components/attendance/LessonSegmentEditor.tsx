import React from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2 } from 'lucide-react';
import { SURAHS, getSurahByName } from '@/lib/quranData';
import { JUZ_DATA, getRukuCountForJuz } from '@/lib/juzData';
import { formatLessonSegment, type LessonSegment, type LessonMarkerType } from '@/lib/lessonFormat';

interface LessonSegmentEditorProps {
  index: number;
  segment: LessonSegment;
  onChange: (seg: LessonSegment) => void;
  onRemove: () => void;
  allowJuz?: boolean;
}

const str = (v: unknown) => (v === null || v === undefined || v === '' ? '' : String(v));

export function LessonSegmentEditor({ index, segment, onChange, onRemove, allowJuz = false }: LessonSegmentEditorProps) {
  const set = (patch: Partial<LessonSegment>) => onChange({ ...segment, ...patch });
  const preview = formatLessonSegment(segment);

  const maxAyahFrom = getSurahByName(str(segment.surahFrom))?.totalAyahs || 0;
  const maxAyahTo = getSurahByName(str(segment.surahTo) || str(segment.surahFrom))?.totalAyahs || 0;

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-semibold text-foreground">Segment {index + 1}</Label>
        <div className="flex items-center gap-2">
          <Select
            value={segment.markerType}
            onValueChange={(v) => set({ markerType: v as LessonMarkerType })}
          >
            <SelectTrigger className="h-8 w-[130px] rounded-lg text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-50 bg-popover">
              <SelectItem value="ayah">Ayah</SelectItem>
              <SelectItem value="ruku">Ruku</SelectItem>
              <SelectItem value="quarter">Quarter</SelectItem>
              {allowJuz && <SelectItem value="juz">Juz</SelectItem>}
            </SelectContent>
          </Select>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onRemove} aria-label={`Remove segment ${index + 1}`}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      {segment.markerType === 'ayah' && (
        <div className="grid grid-cols-2 gap-2">
          <Select value={str(segment.surahFrom)} onValueChange={(v) => set({ surahFrom: v })}>
            <SelectTrigger className="rounded-lg h-9 text-xs"><SelectValue placeholder="From Surah" /></SelectTrigger>
            <SelectContent className="z-50 max-h-[300px] bg-popover">
              {SURAHS.map((s) => <SelectItem key={s.number} value={s.name}>{s.number}. {s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={str(segment.ayahFrom)} onValueChange={(v) => set({ ayahFrom: v })} disabled={!segment.surahFrom}>
            <SelectTrigger className="rounded-lg h-9 text-xs"><SelectValue placeholder="From Ayah" /></SelectTrigger>
            <SelectContent className="z-50 max-h-[300px] bg-popover">
              {Array.from({ length: maxAyahFrom }, (_, i) => <SelectItem key={i + 1} value={String(i + 1)}>Ayah {i + 1}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={str(segment.surahTo)} onValueChange={(v) => set({ surahTo: v })}>
            <SelectTrigger className="rounded-lg h-9 text-xs"><SelectValue placeholder="To Surah" /></SelectTrigger>
            <SelectContent className="z-50 max-h-[300px] bg-popover">
              {SURAHS.map((s) => <SelectItem key={s.number} value={s.name}>{s.number}. {s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={str(segment.ayahTo)} onValueChange={(v) => set({ ayahTo: v })} disabled={!segment.surahTo && !segment.surahFrom}>
            <SelectTrigger className="rounded-lg h-9 text-xs"><SelectValue placeholder="To Ayah" /></SelectTrigger>
            <SelectContent className="z-50 max-h-[300px] bg-popover">
              {Array.from({ length: maxAyahTo }, (_, i) => <SelectItem key={i + 1} value={String(i + 1)}>Ayah {i + 1}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {(segment.markerType === 'ruku' || segment.markerType === 'quarter') && (
        <div className="grid grid-cols-2 gap-2">
          <Select value={str(segment.juzFrom)} onValueChange={(v) => set({ juzFrom: v })}>
            <SelectTrigger className="rounded-lg h-9 text-xs"><SelectValue placeholder="From Juz" /></SelectTrigger>
            <SelectContent className="z-50 bg-popover">
              {JUZ_DATA.map((j) => <SelectItem key={j.number} value={String(j.number)}>Juz {j.number} - {j.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={str(segment.unitFrom)} onValueChange={(v) => set({ unitFrom: v })} disabled={!segment.juzFrom}>
            <SelectTrigger className="rounded-lg h-9 text-xs">
              <SelectValue placeholder={segment.markerType === 'ruku' ? 'From Ruku' : 'From Quarter'} />
            </SelectTrigger>
            <SelectContent className="z-50 bg-popover">
              {Array.from(
                { length: segment.markerType === 'ruku' ? getRukuCountForJuz(parseInt(str(segment.juzFrom)) || 0) : 4 },
                (_, i) => <SelectItem key={i + 1} value={String(i + 1)}>{segment.markerType === 'ruku' ? 'Ruku' : 'Quarter'} {i + 1}</SelectItem>
              )}
            </SelectContent>
          </Select>
          <Select value={str(segment.juzTo)} onValueChange={(v) => set({ juzTo: v })}>
            <SelectTrigger className="rounded-lg h-9 text-xs"><SelectValue placeholder="To Juz" /></SelectTrigger>
            <SelectContent className="z-50 bg-popover">
              {JUZ_DATA.map((j) => <SelectItem key={j.number} value={String(j.number)}>Juz {j.number} - {j.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={str(segment.unitTo)} onValueChange={(v) => set({ unitTo: v })} disabled={!segment.juzTo}>
            <SelectTrigger className="rounded-lg h-9 text-xs">
              <SelectValue placeholder={segment.markerType === 'ruku' ? 'To Ruku' : 'To Quarter'} />
            </SelectTrigger>
            <SelectContent className="z-50 bg-popover">
              {Array.from(
                { length: segment.markerType === 'ruku' ? getRukuCountForJuz(parseInt(str(segment.juzTo)) || 0) : 4 },
                (_, i) => <SelectItem key={i + 1} value={String(i + 1)}>{segment.markerType === 'ruku' ? 'Ruku' : 'Quarter'} {i + 1}</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      )}

      {segment.markerType === 'juz' && (
        <div className="grid grid-cols-2 gap-2">
          <Select value={str(segment.juzFrom)} onValueChange={(v) => set({ juzFrom: v })}>
            <SelectTrigger className="rounded-lg h-9 text-xs"><SelectValue placeholder="From Juz" /></SelectTrigger>
            <SelectContent className="z-50 bg-popover">
              {JUZ_DATA.map((j) => <SelectItem key={j.number} value={String(j.number)}>Juz {j.number} - {j.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={str(segment.juzTo)} onValueChange={(v) => set({ juzTo: v })}>
            <SelectTrigger className="rounded-lg h-9 text-xs"><SelectValue placeholder="To Juz" /></SelectTrigger>
            <SelectContent className="z-50 bg-popover">
              {JUZ_DATA.map((j) => <SelectItem key={j.number} value={String(j.number)}>Juz {j.number} - {j.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {preview && <p className="text-[11px] text-muted-foreground">{preview}</p>}
    </div>
  );
}
