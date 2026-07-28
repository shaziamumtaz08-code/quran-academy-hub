// Quiz results export helpers: styled XLSX (primary) + plain CSV (raw)

export interface QuizExportRow {
  row: number | string;
  session_num: number | string;
  attempt_num: number | string;
  name: string;
  email: string;
  quiz: string;
  score: string;
  percentage: number;
  result: string;
  time: string;
  date: string;
}

export const QUIZ_EXPORT_COLUMNS: { key: keyof QuizExportRow; label: string; width: number }[] = [
  { key: 'row', label: '#', width: 6 },
  { key: 'session_num', label: 'Session #', width: 11 },
  { key: 'attempt_num', label: 'Attempt No.', width: 12 },
  { key: 'name', label: 'Name', width: 26 },
  { key: 'email', label: 'Email', width: 32 },
  { key: 'quiz', label: 'Quiz', width: 28 },
  { key: 'score', label: 'Score', width: 10 },
  { key: 'percentage', label: 'Percentage', width: 12 },
  { key: 'result', label: 'Result', width: 10 },
  { key: 'time', label: 'Time Taken', width: 12 },
  { key: 'date', label: 'Date & Time', width: 20 },
];

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeCSV(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function exportQuizCsv(rows: QuizExportRow[], keys: string[], filename: string) {
  const cols = QUIZ_EXPORT_COLUMNS.filter((c) => keys.includes(c.key));
  const csv = [
    cols.map((c) => escapeCSV(c.label)).join(','),
    ...rows.map((r) => cols.map((c) => escapeCSV((r as any)[c.key])).join(',')),
  ].join('\n');
  download(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }), `${filename}.csv`);
}

export async function exportQuizXlsx(rows: QuizExportRow[], keys: string[], filename: string, title = 'Quiz Results') {
  const ExcelJS = (await import('exceljs')).default;
  const cols = QUIZ_EXPORT_COLUMNS.filter((c) => keys.includes(c.key));

  const wb = new ExcelJS.Workbook();
  wb.creator = 'AQTA LMS';
  wb.created = new Date();
  const ws = wb.addWorksheet(title.slice(0, 30), {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  ws.columns = cols.map((c) => ({ header: c.label, key: c.key as string, width: c.width }));

  const header = ws.getRow(1);
  header.height = 22;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF0F1F33' } } };
  });

  rows.forEach((r) => {
    const values: any = {};
    cols.forEach((c) => {
      values[c.key as string] = c.key === 'percentage' ? (Number(r.percentage) || 0) / 100 : (r as any)[c.key];
    });
    const row = ws.addRow(values);
    const pass = String(r.result || '').toLowerCase().startsWith('pass');
    row.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: pass ? 'FFE7F6EC' : 'FFFDECEC' },
      };
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFD9D9D9' } } };
      cell.alignment = { vertical: 'middle' };
    });
    const pctCell = row.getCell('percentage');
    if (pctCell && keys.includes('percentage')) {
      pctCell.numFmt = '0%';
      pctCell.alignment = { horizontal: 'center' };
      pctCell.font = { bold: true, color: { argb: pass ? 'FF1B7A3D' : 'FFB4232A' } };
    }
    const resCell = row.getCell('result');
    if (resCell && keys.includes('result')) {
      resCell.alignment = { horizontal: 'center' };
      resCell.font = { bold: true, color: { argb: pass ? 'FF1B7A3D' : 'FFB4232A' } };
    }
  });

  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };

  const buf = await wb.xlsx.writeBuffer();
  download(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${filename}.xlsx`,
  );
}
