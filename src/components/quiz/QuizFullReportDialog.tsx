import { useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileImage, FileDown, Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: {
    name: string;
    email: string;
    percentage: number;
    score: string;
    pass: boolean;
  }[];
  quizName: string;
  subtitle?: string;
  academyName?: string;
}

const BANDS = [
  { label: '0–20', min: 0, max: 20, color: '#e11d48' },
  { label: '21–40', min: 21, max: 40, color: '#f97316' },
  { label: '41–60', min: 41, max: 60, color: '#f59e0b' },
  { label: '61–80', min: 61, max: 80, color: '#22c55e' },
  { label: '81–100', min: 81, max: 100, color: '#0ea5e9' },
];

export default function QuizFullReportDialog({
  open,
  onOpenChange,
  rows,
  quizName,
  subtitle,
  academyName = 'Al Quran Time Academy',
}: Props) {
  const slideRef = useRef<HTMLDivElement | null>(null);
  const [busy, setBusy] = useState<null | 'png' | 'pdf'>(null);

  const stats = useMemo(() => {
    const total = rows.length;
    const passed = rows.filter((r) => r.pass).length;
    const failed = total - passed;
    const avg = total ? Math.round(rows.reduce((s, r) => s + (Number(r.percentage) || 0), 0) / total) : 0;
    const passRate = total ? Math.round((passed / total) * 100) : 0;
    const top = [...rows].sort((a, b) => b.percentage - a.percentage);
    const dist = BANDS.map((b) => ({
      ...b,
      count: rows.filter((r) => r.percentage >= b.min && r.percentage <= b.max).length,
    }));
    const maxCount = Math.max(1, ...dist.map((d) => d.count));
    return { total, passed, failed, avg, passRate, top, dist, maxCount };
  }, [rows]);

  const capture = async () => {
    const html2canvas = (await import('html2canvas')).default;
    return html2canvas(slideRef.current!, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
  };

  const downloadPng = async () => {
    setBusy('png');
    try {
      const canvas = await capture();
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `quiz-report-${quizName.replace(/[^\w-]+/g, '_')}.png`;
      a.click();
    } finally {
      setBusy(null);
    }
  };

  const downloadPdf = async () => {
    setBusy('pdf');
    try {
      const canvas = await capture();
      const { default: jsPDF } = await import('jspdf');
      const img = canvas.toDataURL('image/jpeg', 0.95);
      const doc = new jsPDF({ unit: 'pt', format: [canvas.width / 2, canvas.height / 2], orientation: 'landscape' });
      doc.addImage(img, 'JPEG', 0, 0, canvas.width / 2, canvas.height / 2);
      doc.save(`quiz-report-${quizName.replace(/[^\w-]+/g, '_')}.pdf`);
    } finally {
      setBusy(null);
    }
  };

  const ranked = stats.top.slice(0, 14);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Full Participation Report</DialogTitle>
        </DialogHeader>

        <div className="overflow-x-auto">
          {/* ===== Presentation slide (captured) ===== */}
          <div
            ref={slideRef}
            style={{ width: 1120, fontFamily: 'ui-sans-serif, system-ui, sans-serif', color: '#0f172a' }}
            className="bg-white"
          >
            <div style={{ background: 'linear-gradient(120deg,#1e3a5f 0%,#274b7c 55%,#c9a227 160%)', padding: '28px 40px', color: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, letterSpacing: 3, opacity: 0.85, fontWeight: 700 }}>
                    {academyName.toUpperCase()}
                  </div>
                  <div style={{ fontSize: 30, fontWeight: 900, marginTop: 4 }}>{quizName}</div>
                  <div style={{ fontSize: 13, opacity: 0.85, marginTop: 2 }}>
                    {subtitle || 'Quiz Participation & Performance Report'}
                  </div>
                </div>
                <div
                  style={{
                    width: 66, height: 66, borderRadius: '50%', background: '#c9a227',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 26, fontWeight: 900, color: '#1e3a5f',
                  }}
                >
                  A
                </div>
              </div>
            </div>

            <div style={{ padding: '26px 40px 34px' }}>
              {/* KPI tiles */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14 }}>
                {[
                  { label: 'Participants', value: stats.total, color: '#1e3a5f' },
                  { label: 'Passed', value: stats.passed, color: '#16a34a' },
                  { label: 'Failed', value: stats.failed, color: '#e11d48' },
                  { label: 'Pass Rate', value: `${stats.passRate}%`, color: '#0ea5e9' },
                  { label: 'Average Score', value: `${stats.avg}%`, color: '#c9a227' },
                ].map((t) => (
                  <div key={t.label} style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
                    <div style={{ height: 5, background: t.color }} />
                    <div style={{ padding: '14px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: 28, fontWeight: 900, color: t.color, lineHeight: 1.1 }}>{t.value}</div>
                      <div style={{ fontSize: 11, letterSpacing: 1, color: '#64748b', marginTop: 4, fontWeight: 700 }}>
                        {t.label.toUpperCase()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.25fr', gap: 22, marginTop: 24 }}>
                {/* Distribution chart */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 18 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 14 }}>Score Distribution</div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, height: 190 }}>
                    {stats.dist.map((d) => (
                      <div key={d.label} style={{ flex: 1, textAlign: 'center' }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: d.color, marginBottom: 4 }}>{d.count}</div>
                        <div
                          style={{
                            height: Math.max(6, (d.count / stats.maxCount) * 140),
                            background: d.color,
                            borderRadius: '6px 6px 0 0',
                          }}
                        />
                        <div style={{ fontSize: 10, color: '#64748b', marginTop: 6, fontWeight: 700 }}>{d.label}%</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 14 }}>
                    <div style={{ display: 'flex', height: 10, borderRadius: 6, overflow: 'hidden', background: '#fee2e2' }}>
                      <div style={{ width: `${stats.passRate}%`, background: '#16a34a' }} />
                    </div>
                    <div style={{ fontSize: 10, color: '#64748b', marginTop: 6 }}>
                      {stats.passed} passed · {stats.failed} failed
                    </div>
                  </div>
                </div>

                {/* Ranked list */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 18 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>
                    Participant Ranking {rows.length > ranked.length ? `(top ${ranked.length} of ${rows.length})` : ''}
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                    <thead>
                      <tr style={{ background: '#1e3a5f', color: '#fff' }}>
                        <th style={{ padding: '6px 8px', textAlign: 'left', width: 34 }}>#</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left' }}>Name</th>
                        <th style={{ padding: '6px 8px', textAlign: 'center', width: 70 }}>Score</th>
                        <th style={{ padding: '6px 8px', textAlign: 'center', width: 56 }}>%</th>
                        <th style={{ padding: '6px 8px', textAlign: 'center', width: 66 }}>Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ranked.map((r, i) => (
                        <tr key={i} style={{ background: r.pass ? '#f0faf3' : '#fdf0f0' }}>
                          <td style={{ padding: '5px 8px', borderBottom: '1px solid #eef2f6', fontWeight: 700 }}>{i + 1}</td>
                          <td style={{ padding: '5px 8px', borderBottom: '1px solid #eef2f6' }}>
                            {r.name || 'Anonymous'}
                          </td>
                          <td style={{ padding: '5px 8px', borderBottom: '1px solid #eef2f6', textAlign: 'center' }}>
                            {r.score}
                          </td>
                          <td
                            style={{
                              padding: '5px 8px', borderBottom: '1px solid #eef2f6', textAlign: 'center',
                              fontWeight: 800, color: r.pass ? '#16a34a' : '#e11d48',
                            }}
                          >
                            {r.percentage}%
                          </td>
                          <td
                            style={{
                              padding: '5px 8px', borderBottom: '1px solid #eef2f6', textAlign: 'center',
                              fontWeight: 800, color: r.pass ? '#16a34a' : '#e11d48',
                            }}
                          >
                            {r.pass ? 'Pass' : 'Fail'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div
                style={{
                  marginTop: 22, borderTop: '3px solid #c9a227', paddingTop: 10,
                  display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: '#64748b',
                }}
              >
                <span>{academyName}</span>
                <span>Generated {new Date().toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={downloadPng} disabled={!!busy}>
            {busy === 'png' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileImage className="h-4 w-4 mr-1" />}
            Download PNG
          </Button>
          <Button onClick={downloadPdf} disabled={!!busy}>
            {busy === 'pdf' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileDown className="h-4 w-4 mr-1" />}
            Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
