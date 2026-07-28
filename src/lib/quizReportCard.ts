import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ARABIC_FONT, ensureArabicFont, hasArabic, shapeRtl } from './pdfArabicFont';

const NAVY: [number, number, number] = [30, 58, 95];
const GOLD: [number, number, number] = [201, 162, 39];
const GREEN: [number, number, number] = [27, 122, 61];
const RED: [number, number, number] = [180, 35, 42];
const SLATE: [number, number, number] = [100, 116, 139];


export interface ReportCardData {
  studentName: string;
  studentEmail: string;
  quizName: string;
  sessionNumber: number | string;
  attemptNumber: number | string;
  date: string;
  score: number;
  maxScore: number;
  percentage: number;
  passThreshold: number;
  correct: number;
  wrong: number;
  skipped: number;
  timeTaken: string;
  questions: { index: number; text: string; type: string; status: 'correct' | 'wrong' | 'skipped' }[];
  academyName?: string;
}

export async function generateReportCardPdf(d: ReportCardData) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const arabicReady = await ensureArabicFont(doc);
  const W = doc.internal.pageSize.getWidth();
  const isPass = d.percentage >= d.passThreshold;
  const accent = isPass ? GREEN : RED;

  /** Prepare a string for drawing: shape RTL text and pick a capable font. */
  const rtl = (s: string) => (arabicReady && hasArabic(s) ? shapeRtl(s) : s);
  const font = (s: string, style: 'normal' | 'bold' = 'normal') =>
    doc.setFont(arabicReady && hasArabic(s) ? ARABIC_FONT : 'helvetica', style);


  // ---- Header band
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 108, 'F');
  doc.setFillColor(...GOLD);
  doc.rect(0, 104, W, 4, 'F');

  // Logo placeholder
  doc.setFillColor(...GOLD);
  doc.circle(58, 52, 22, 'F');
  doc.setTextColor(30, 58, 95);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('A', 58, 58, { align: 'center' });

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(19);
  font(d.academyName || '', 'bold');
  doc.text(rtl(d.academyName || 'Al Quran Time Academy'), 92, 46);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(214, 224, 238);
  doc.text('Quiz Report Card', 92, 66);
  doc.setFontSize(9);
  doc.text(d.date, W - 40, 46, { align: 'right' });

  // ---- Student card
  let y = 132;
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(40, y, W - 80, 74, 8, 8, 'FD');
  doc.setTextColor(...NAVY);
  font(d.studentName || '', 'bold');
  doc.setFontSize(16);
  doc.text(rtl(d.studentName || 'Anonymous'), 58, y + 28);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...SLATE);
  doc.text(d.studentEmail || '—', 58, y + 44);
  // Draw the quiz name in its own face (Arabic if needed), then the Latin meta
  // in helvetica — mixing scripts in one run drops the Latin glyphs.
  const quizName = d.quizName || 'Quiz';
  font(quizName, 'normal');
  doc.text(rtl(quizName), 58, y + 60);
  const nameW = doc.getTextWidth(rtl(quizName));
  doc.setFont('helvetica', 'normal');
  doc.text(
    `   •   Session #${d.sessionNumber}   •   Attempt #${d.attemptNumber}`,
    58 + nameW,
    y + 60,
  );



  // ---- Score circle
  const cx = W - 108;
  const cy = y + 37;
  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.circle(cx, cy, 32, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(`${Math.round(d.percentage)}%`, cx, cy + 4, { align: 'center' });
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(isPass ? 'PASSED' : 'NOT PASSED', cx, cy + 17, { align: 'center' });

  // ---- Stat tiles
  y += 96;
  const tiles: { label: string; value: string; color: [number, number, number] }[] = [
    { label: 'Score', value: `${d.score}/${d.maxScore}`, color: NAVY },
    { label: 'Correct', value: String(d.correct), color: GREEN },
    { label: 'Wrong', value: String(d.wrong), color: RED },
    { label: 'Skipped', value: String(d.skipped), color: SLATE },
    { label: 'Time', value: d.timeTaken || '—', color: NAVY },
  ];
  const gap = 12;
  const tw = (W - 80 - gap * (tiles.length - 1)) / tiles.length;
  tiles.forEach((t, i) => {
    const x = 40 + i * (tw + gap);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, y, tw, 56, 6, 6, 'FD');
    doc.setFillColor(t.color[0], t.color[1], t.color[2]);
    doc.roundedRect(x, y, tw, 4, 2, 2, 'F');
    doc.setTextColor(t.color[0], t.color[1], t.color[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text(t.value, x + tw / 2, y + 32, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...SLATE);
    doc.text(t.label.toUpperCase(), x + tw / 2, y + 46, { align: 'center' });
  });

  // ---- Progress bar
  y += 76;
  doc.setFillColor(233, 236, 241);
  doc.roundedRect(40, y, W - 80, 10, 5, 5, 'F');
  const pw = Math.max(0, Math.min(100, d.percentage)) / 100 * (W - 80);
  doc.setFillColor(accent[0], accent[1], accent[2]);
  if (pw > 0) doc.roundedRect(40, y, pw, 10, 5, 5, 'F');
  doc.setFontSize(8);
  doc.setTextColor(...SLATE);
  doc.text(`Passing mark: ${d.passThreshold}%`, 40, y + 24);

  // ---- Question table
  const QCOL_W = 341; // 515 usable - (26 + 84 + 64)

  /**
   * Wrap first (with the Arabic metrics), then shape each visual line, so bidi
   * reordering stays correct after wrapping.
   */
  const questionCell = (text: string) => {
    const clean = (text || '').replace(/\s+/g, ' ').trim() || '—';
    if (!(arabicReady && hasArabic(clean))) return clean;
    doc.setFont(ARABIC_FONT, 'normal');
    doc.setFontSize(8.5);
    const lines: string[] = doc.splitTextToSize(clean, QCOL_W - 12);
    return lines.slice(0, 6).map(shapeRtl).join('\n');
  };

  autoTable(doc, {
    startY: y + 36,
    head: [['#', 'Question', 'Type', 'Result']],
    body: d.questions.map((q) => [
      String(q.index),
      questionCell(q.text),
      q.type,
      q.status === 'correct' ? 'Correct' : q.status === 'wrong' ? 'Incorrect' : 'Skipped',
    ]),
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 5, lineColor: [232, 236, 242] },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 26, halign: 'center' },
      1: { cellWidth: QCOL_W },
      2: { cellWidth: 84 },
      3: { cellWidth: 64, halign: 'center', fontStyle: 'bold' },
    },

    didParseCell: (data: any) => {
      // Apply the Arabic face only to cells that actually hold Arabic script —
      // Latin text drawn with the Naskh face does not render in jsPDF.
      if (data.column.index === 1 && data.section === 'body') {
        const raw = d.questions[data.row.index]?.text || '';
        if (arabicReady && hasArabic(raw)) {
          data.cell.styles.font = ARABIC_FONT;
          data.cell.styles.fontStyle = 'normal';
          data.cell.styles.halign = 'right';
        }
      }
      if (data.section !== 'body') return;
      const status = d.questions[data.row.index]?.status;
      if (data.column.index === 3) {
        data.cell.styles.textColor =
          status === 'correct' ? GREEN : status === 'wrong' ? RED : SLATE;
      }
      data.cell.styles.fillColor =
        status === 'correct' ? [240, 250, 243] : status === 'wrong' ? [253, 240, 240] : [249, 250, 251];
    },
    margin: { left: 40, right: 40 },
  });

  // ---- Footer
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    const H = doc.internal.pageSize.getHeight();
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(2);
    doc.line(40, H - 44, W - 40, H - 44);
    doc.setLineWidth(0.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...SLATE);
    doc.text(d.academyName || 'Al Quran Time Academy', 40, H - 28);
    doc.text(`Page ${p} of ${pages}`, W - 40, H - 28, { align: 'right' });
  }

  const safe = (d.studentName || 'student').replace(/[^\w\-]+/g, '_');
  doc.save(`report-card-${safe}.pdf`);
}
