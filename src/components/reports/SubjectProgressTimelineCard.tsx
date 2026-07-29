import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TimelinePoint {
  monthKey: string;
  monthLabel: string;
  /** criteria name -> percentage */
  values: Record<string, number>;
  overall: number;
  publicRemark: string | null;
  examinerRemark: string | null;
}

export interface SubjectTimeline {
  subjectId: string;
  subjectName: string;
  criteriaNames: string[];
  points: TimelinePoint[];
}

interface Props {
  timeline: SubjectTimeline;
  accentIndex: number;
  mode: 'student' | 'staff';
}

function trendOf(points: TimelinePoint[]) {
  const withData = points.filter((p) => p.overall > 0);
  if (withData.length < 2) return { dir: 'steady' as const, delta: 0 };
  const first = withData[0].overall;
  const last = withData[withData.length - 1].overall;
  const delta = Math.round(last - first);
  if (delta > 1) return { dir: 'up' as const, delta };
  if (delta < -1) return { dir: 'down' as const, delta };
  return { dir: 'steady' as const, delta };
}

export function SubjectProgressTimelineCard({ timeline, accentIndex, mode }: Props) {
  const [expandedAll, setExpandedAll] = React.useState(false);
  const accent = `hsl(var(--report-accent-${(accentIndex % 6) + 1}))`;
  const accentSoft = `hsl(var(--report-accent-${(accentIndex % 6) + 1}) / 0.10)`;
  const accentLine = `hsl(var(--report-accent-${(accentIndex % 6) + 1}) / 0.28)`;

  const { dir, delta } = trendOf(timeline.points);
  const TrendIcon = dir === 'up' ? TrendingUp : dir === 'down' ? TrendingDown : Minus;

  const chartData = timeline.points.map((p) => ({
    month: p.monthLabel,
    ...p.values,
    Overall: p.overall || null,
  }));

  const remarkPoints = [...timeline.points]
    .filter((p) => p.publicRemark || (mode === 'staff' && p.examinerRemark))
    .reverse();
  const [latest, ...older] = remarkPoints;

  return (
    <Card
      className="overflow-hidden border-0 shadow-sm ring-1 ring-border/60"
      style={{ background: `linear-gradient(180deg, ${accentSoft}, hsl(var(--card)) 45%)` }}
    >
      <div className="h-1" style={{ background: accent }} />
      <CardContent className="p-6 sm:p-8 space-y-7">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight leading-none">
              {timeline.subjectName}
            </h2>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Monthly progress
            </p>
          </div>
          <div
            className="flex items-center gap-2 rounded-full px-3 py-1.5"
            style={{ background: accentSoft, color: accent }}
          >
            <TrendIcon className="h-4 w-4" />
            <span className="text-sm font-semibold tabular-nums">
              {dir === 'steady' ? 'Steady' : `${delta > 0 ? '+' : ''}${delta}%`}
            </span>
          </div>
        </div>

        {/* Chart */}
        <div className="h-56 -ml-3">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={accentLine} strokeDasharray="2 6" vertical={false} />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                dy={8}
              />
              <YAxis
                domain={[0, 100]}
                width={32}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                ticks={[0, 50, 100]}
              />
              <Tooltip
                cursor={{ stroke: accentLine, strokeWidth: 2 }}
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid hsl(var(--border))',
                  background: 'hsl(var(--popover))',
                  color: 'hsl(var(--popover-foreground))',
                  fontSize: 12,
                }}
                formatter={(v: number | null) => (v == null ? '—' : `${Math.round(v)}%`)}
              />
              <Line
                type="monotone"
                dataKey="Overall"
                stroke={accent}
                strokeWidth={3}
                dot={{ r: 3, fill: accent, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                connectNulls
              />
              {timeline.criteriaNames.map((name, i) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={`hsl(var(--report-accent-${((accentIndex + i + 1) % 6) + 1}) / 0.55)`}
                  strokeWidth={1.75}
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Remarks timeline */}
        {remarkPoints.length === 0 ? (
          <p className="text-sm text-muted-foreground">No remarks recorded in this period yet.</p>
        ) : (
          <div className="relative pl-6">
            <div
              className="absolute left-[7px] top-2 bottom-2 w-px"
              style={{ background: accentLine }}
            />
            <div className="space-y-6">
              <RemarkRow point={latest} accent={accent} mode={mode} emphasized />
              {older.length > 0 && (
                <>
                  {(expandedAll ? older : []).map((p) => (
                    <RemarkRow key={p.monthKey} point={p} accent={accent} mode={mode} />
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-ml-2 h-8 text-xs font-medium"
                    style={{ color: accent }}
                    onClick={() => setExpandedAll((v) => !v)}
                  >
                    {expandedAll ? (
                      <><ChevronUp className="h-3.5 w-3.5 mr-1" /> Show less</>
                    ) : (
                      <><ChevronDown className="h-3.5 w-3.5 mr-1" /> View {older.length} earlier month{older.length > 1 ? 's' : ''}</>
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RemarkRow({
  point,
  accent,
  mode,
  emphasized,
}: {
  point: TimelinePoint;
  accent: string;
  mode: 'student' | 'staff';
  emphasized?: boolean;
}) {
  return (
    <div className="relative">
      <span
        className={cn('absolute rounded-full', emphasized ? '-left-[23px] top-1.5 h-3 w-3' : '-left-[21px] top-2 h-2 w-2')}
        style={{ background: emphasized ? accent : `${accent.replace(')', ' / 0.4)')}` }}
      />
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className={cn('text-xs uppercase tracking-widest', emphasized ? 'text-foreground/70' : 'text-muted-foreground')}>
          {point.monthLabel}
        </span>
        {point.overall > 0 && (
          <span
            className={cn('tabular-nums font-bold', emphasized ? 'text-xl' : 'text-sm')}
            style={{ color: accent }}
          >
            {Math.round(point.overall)}%
          </span>
        )}
      </div>
      {point.publicRemark && (
        <p className={cn('mt-1.5 leading-relaxed text-foreground/80', emphasized ? 'text-[15px]' : 'text-sm')}>
          {point.publicRemark}
        </p>
      )}
      {mode === 'staff' && point.examinerRemark && (
        <div className="mt-3 border-l-2 border-dashed border-border pl-3">
          <span className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
            <Lock className="h-3 w-3" /> Internal note
          </span>
          <p className="mt-1 text-sm italic leading-relaxed text-muted-foreground">{point.examinerRemark}</p>
        </div>
      )}
    </div>
  );
}
