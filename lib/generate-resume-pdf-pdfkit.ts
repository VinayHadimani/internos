/**
 * Serverless-safe resume PDF (A4 two-column) using PDFKit — no Python required.
 * Matches the ReportLab layout closely (Helvetica, navy sidebar, accent rules).
 */
import PDFDocument from 'pdfkit';
import type { ResumePdfPayload } from '@/lib/build-resume-pdf-payload';

type PdfDoc = InstanceType<typeof PDFDocument>;

const W = 595.28;
const H = 841.89;
const TOP_BAR = 6;
const SIDEBAR_W = W * 0.3;
const M = 14;
const MAIN_X = SIDEBAR_W + 12;
const MAIN_W = W - MAIN_X - M;
const BULLET = '\u2022';

function paintContinuationPage(doc: PdfDoc) {
  doc.rect(0, 0, W, TOP_BAR).fill('#2E86AB');
  doc.rect(SIDEBAR_W, TOP_BAR, W - SIDEBAR_W, H - TOP_BAR).fill('#F4F7FB');
  doc.strokeColor('#2E86AB').lineWidth(1).moveTo(SIDEBAR_W, TOP_BAR).lineTo(SIDEBAR_W, H).stroke();
}

function initials(name: string): string {
  const parts = name.replace(/,/g, ' ').split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function drawSidebarHeading(doc: PdfDoc, x: number, y: number, label: string, innerW: number): number {
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#2E86AB');
  doc.text(label.toUpperCase(), x, y, { width: innerW, characterSpacing: 0.5 });
  let ny = doc.y + 2;
  doc.strokeColor('#2E86AB').lineWidth(0.5).moveTo(x, ny).lineTo(x + innerW, ny).stroke();
  return ny + 10;
}

function drawMainHeading(doc: PdfDoc, x: number, y: number, label: string): number {
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#1A2B4A');
  doc.text(label.toUpperCase(), x, y, { width: MAIN_W });
  let ny = doc.y + 2;
  doc.strokeColor('#2E86AB').lineWidth(0.8).moveTo(x, ny).lineTo(x + 130, ny).stroke();
  return ny + 12;
}

function drawSkillPills(doc: PdfDoc, skills: string[], x0: number, y: number, maxX: number): number {
  let x = x0;
  const rowH = 16;
  let rowY = y;
  for (const sk of skills.slice(0, 40)) {
    const label = sk.slice(0, 44);
    doc.font('Helvetica').fontSize(7);
    const tw = doc.widthOfString(label) + 10;
    if (x + tw > maxX) {
      x = x0;
      rowY += rowH;
    }
    doc.save();
    doc.roundedRect(x, rowY, tw, 12, 3).fill('#243A63');
    doc.fillColor('#FFFFFF').font('Helvetica').fontSize(7).text(label, x + 5, rowY + 3, { lineBreak: false });
    doc.restore();
    x += tw + 4;
  }
  return rowY + rowH + 4;
}

export function generateResumePdfPdfKit(payload: ResumePdfPayload): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: false });
    doc.on('data', (c) => chunks.push(c as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const name = (payload.name || 'Candidate').slice(0, 80);
    const jobTitle = (payload.jobTitle || 'Professional').slice(0, 80);

    doc.rect(0, 0, W, TOP_BAR).fill('#2E86AB');
    doc.rect(0, TOP_BAR, SIDEBAR_W, H - TOP_BAR).fill('#1A2B4A');
    doc.rect(SIDEBAR_W, TOP_BAR, W - SIDEBAR_W, H - TOP_BAR).fill('#F4F7FB');
    doc.strokeColor('#2E86AB').lineWidth(1).moveTo(SIDEBAR_W, TOP_BAR).lineTo(SIDEBAR_W, H).stroke();

    const cx = SIDEBAR_W / 2;
    const cy = TOP_BAR + 52;
    const r = 22;
    doc.save();
    doc.ellipse(cx, cy, r, r).fill('#2E86AB');
    const ini = initials(name);
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#FFFFFF');
    const iw = doc.widthOfString(ini);
    doc.text(ini, cx - iw / 2, cy - 4, { lineBreak: false });
    doc.restore();

    let sy = TOP_BAR + 88;
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#FFFFFF');
    const nw = doc.widthOfString(name);
    doc.text(name, Math.max(M, (SIDEBAR_W - nw) / 2), sy, { width: SIDEBAR_W - 2 * M, align: 'center' });
    sy = doc.y + 6;

    const pillW = Math.min(SIDEBAR_W - 2 * M, doc.widthOfString(jobTitle) + 18);
    const px = (SIDEBAR_W - pillW) / 2;
    doc.roundedRect(px, sy, pillW, 14, 7).fill('#2E86AB');
    doc.font('Helvetica').fontSize(8).fillColor('#FFFFFF');
    const jw = doc.widthOfString(jobTitle);
    doc.text(jobTitle, px + (pillW - jw) / 2, sy + 4, { lineBreak: false });
    sy += 22;

    const inner = SIDEBAR_W - 2 * M;
    sy = drawSidebarHeading(doc, M, sy, 'Contact', inner);
    doc.font('Helvetica').fontSize(9).fillColor('#FFFFFF');
    for (const line of [payload.email, payload.phone, payload.location]) {
      if (line) {
        doc.text(`${BULLET}  ${String(line).slice(0, 78)}`, M, sy);
        sy = doc.y + 6;
      }
    }
    sy += 6;

    sy = drawSidebarHeading(doc, M, sy, 'Links', inner);
    doc.font('Helvetica').fontSize(8).fillColor('#2E86AB');
    for (const u of [payload.linkedin, payload.github, payload.kaggle]) {
      if (u) {
        doc.text(`${BULLET}  ${String(u).slice(0, 72)}`, M, sy);
        sy = doc.y + 6;
      }
    }
    sy += 6;

    sy = drawSidebarHeading(doc, M, sy, 'Skills', inner);
    if (payload.skills?.length) {
      sy = drawSkillPills(doc, payload.skills, M, sy, SIDEBAR_W - M);
    }

    if (payload.certifications?.length) {
      sy += 4;
      sy = drawSidebarHeading(doc, M, sy, 'Certifications', inner);
      doc.font('Helvetica').fontSize(8).fillColor('#FFFFFF');
      for (const c of payload.certifications.slice(0, 14)) {
        doc.text(`\u2726  ${c.slice(0, 76)}`, M, sy);
        sy = doc.y + 6;
      }
    }

    if (payload.achievements?.length) {
      sy += 4;
      sy = drawSidebarHeading(doc, M, sy, 'Achievements', inner);
      doc.font('Helvetica').fontSize(8).fillColor('#FFFFFF');
      for (const a of payload.achievements.slice(0, 12)) {
        doc.text(`\u2726  ${a.slice(0, 76)}`, M, sy);
        sy = doc.y + 6;
      }
    }

    let my = TOP_BAR + 18;
    if (payload.summary) {
      my = drawMainHeading(doc, MAIN_X, my, 'Professional Summary');
      doc.font('Helvetica').fontSize(9).fillColor('#1E2A3A');
      doc.text(payload.summary, MAIN_X, my, { width: MAIN_W, lineGap: 4 });
      my = doc.y + 14;
    }

    if (payload.education?.length) {
      my = drawMainHeading(doc, MAIN_X, my, 'Education');
      for (const ed of payload.education) {
        if (my > H - 60) {
          doc.addPage();
          paintContinuationPage(doc);
          my = TOP_BAR + 18;
        }
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#1E2A3A');
        doc.text((ed.degree || '').slice(0, 100), MAIN_X, my, { width: MAIN_W - 80 });
        if (ed.year) {
          doc.font('Helvetica-Oblique').fontSize(8).fillColor('#6B7A8D');
          const yw = doc.widthOfString(ed.year);
          doc.text(ed.year.slice(0, 32), MAIN_X + MAIN_W - yw - 2, my, { lineBreak: false });
        }
        my = doc.y + 4;
        if (ed.school) {
          doc.font('Helvetica-Oblique').fontSize(9).fillColor('#6B7A8D');
          doc.text(ed.school, MAIN_X, my, { width: MAIN_W });
          my = doc.y + 4;
        }
        if (ed.details) {
          doc.font('Helvetica').fontSize(8).fillColor('#6B7A8D');
          doc.text(ed.details, MAIN_X, my, { width: MAIN_W });
          my = doc.y + 6;
        }
        my += 8;
      }
      my += 6;
    }

    if (payload.projects?.length) {
      my = drawMainHeading(doc, MAIN_X, my, 'Projects');
      for (const pj of payload.projects) {
        if (my > H - 80) {
          doc.addPage();
          paintContinuationPage(doc);
          my = TOP_BAR + 18;
        }
        doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#1E2A3A');
        doc.text((pj.name || 'Project').slice(0, 100), MAIN_X, my, { width: MAIN_W - 90 });
        if (pj.date) {
          doc.font('Helvetica-Oblique').fontSize(8).fillColor('#6B7A8D');
          const dw = doc.widthOfString(pj.date);
          doc.text(pj.date.slice(0, 36), MAIN_X + MAIN_W - dw - 2, my, { lineBreak: false });
        }
        my = doc.y + 4;
        if (pj.tech?.length) {
          doc.font('Helvetica-Oblique').fontSize(8).fillColor('#6B7A8D');
          doc.text(pj.tech.join(', ').slice(0, 220), MAIN_X, my, { width: MAIN_W });
          my = doc.y + 4;
        }
        for (const b of pj.bullets || []) {
          doc.font('Helvetica').fontSize(9).fillColor('#1E2A3A');
          doc.text(`${BULLET}  ${b}`, MAIN_X + 4, my, { width: MAIN_W - 8, lineGap: 3 });
          my = doc.y + 4;
        }
        my += 8;
      }
    }

    if (payload.experience?.length) {
      my = drawMainHeading(doc, MAIN_X, my, 'Experience');
      for (const ex of payload.experience) {
        if (my > H - 72) {
          doc.addPage();
          paintContinuationPage(doc);
          my = TOP_BAR + 18;
        }
        doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#1E2A3A');
        doc.text((ex.title || '').slice(0, 92), MAIN_X, my, { width: MAIN_W - 100 });
        if (ex.duration) {
          doc.font('Helvetica-Oblique').fontSize(8).fillColor('#6B7A8D');
          const dw = doc.widthOfString(ex.duration);
          doc.text(ex.duration.slice(0, 42), MAIN_X + MAIN_W - dw - 2, my, { lineBreak: false });
        }
        my = doc.y + 4;
        if (ex.company) {
          doc.font('Helvetica-Oblique').fontSize(9).fillColor('#6B7A8D');
          doc.text(ex.company, MAIN_X, my, { width: MAIN_W });
          my = doc.y + 4;
        }
        for (const b of ex.bullets || []) {
          doc.font('Helvetica').fontSize(9).fillColor('#1E2A3A');
          doc.text(`${BULLET}  ${b}`, MAIN_X + 4, my, { width: MAIN_W - 8, lineGap: 3 });
          my = doc.y + 4;
        }
        my += 8;
      }
    } else if (payload.experienceNarrative) {
      my = drawMainHeading(doc, MAIN_X, my, 'Experience');
      doc.font('Helvetica').fontSize(9).fillColor('#1E2A3A');
      doc.text(payload.experienceNarrative.slice(0, 8000), MAIN_X, my, { width: MAIN_W, lineGap: 4 });
    }

    doc.end();
  });
}

export function isServerlessRuntime(): boolean {
  return Boolean(
    process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.AWS_EXECUTION_ENV ||
      process.env.NETLIFY
  );
}
