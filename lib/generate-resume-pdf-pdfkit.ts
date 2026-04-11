/**
 * Serverless-safe resume PDF (A4 two-column) using pdf-lib + StandardFonts.
 * Avoids pdfkit's Helvetica.afm file reads (broken under Vercel/Next tracing).
 */
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib';
import type { ResumePdfPayload } from '@/lib/build-resume-pdf-payload';

const W = 595.28;
const H = 841.89;
const TOP_BAR = 6;
const SIDEBAR_W = W * 0.3;
const M = 14;
const MAIN_X = SIDEBAR_W + 12;
const MAIN_W = W - MAIN_X - M;
const BULLET = '\u2022';

function hx(hex: string) {
  const h = hex.replace('#', '');
  return rgb(
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255
  );
}

const NAVY = hx('#1A2B4A');
const ACCENT = hx('#2E86AB');
const LIGHT_BG = hx('#F4F7FB');
const WHITE = hx('#FFFFFF');
const MUTED = hx('#6B7A8D');
const TEXT = hx('#1E2A3A');
const PILL = hx('#243A63');

function initials(name: string): string {
  const parts = name.replace(/,/g, ' ').split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function wrapLines(font: PDFFont, text: string, size: number, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) <= maxW) cur = next;
    else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function pageHeight(p: PDFPage) {
  return p.getHeight();
}

function drawTopBar(page: PDFPage) {
  const ph = pageHeight(page);
  page.drawRectangle({ x: 0, y: ph - TOP_BAR, width: W, height: TOP_BAR, color: ACCENT });
}

function drawTwoColumnShell(page: PDFPage) {
  const ph = pageHeight(page);
  page.drawRectangle({ x: 0, y: 0, width: SIDEBAR_W, height: ph - TOP_BAR, color: NAVY });
  page.drawRectangle({
    x: SIDEBAR_W,
    y: 0,
    width: W - SIDEBAR_W,
    height: ph - TOP_BAR,
    color: LIGHT_BG,
  });
  page.drawLine({
    start: { x: SIDEBAR_W, y: 0 },
    end: { x: SIDEBAR_W, y: ph - TOP_BAR },
    thickness: 1,
    color: ACCENT,
  });
}

function drawWrapped(
  page: PDFPage,
  text: string,
  x: number,
  yStart: number,
  maxW: number,
  size: number,
  font: PDFFont,
  color: ReturnType<typeof rgb>,
  lineGap: number,
  minY: number
): number {
  let y = yStart;
  for (const para of text.split('\n')) {
    for (const line of wrapLines(font, para, size, maxW)) {
      if (y < minY) return y;
      page.drawText(line, { x, y, size, font, color });
      y -= size + lineGap;
    }
  }
  return y;
}

export async function generateResumePdfPdfKit(payload: ResumePdfPayload): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const fonts = {
    reg: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    oblique: await pdf.embedFont(StandardFonts.HelveticaOblique),
  };

  const name = (payload.name || 'Candidate').slice(0, 80);
  const jobTitle = (payload.jobTitle || 'Professional').slice(0, 80);

  let page = pdf.addPage([W, H]);
  let ph = pageHeight(page);
  drawTopBar(page);
  drawTwoColumnShell(page);

  const inner = SIDEBAR_W - 2 * M;
  let sy = ph - TOP_BAR - 18;

  const cx = SIDEBAR_W / 2;
  const cy = ph - TOP_BAR - 52;
  const r = 22;
  page.drawEllipse({
    x: cx,
    y: cy,
    xScale: r,
    yScale: r,
    color: ACCENT,
    borderWidth: 0,
  });
  const ini = initials(name);
  const iw = fonts.bold.widthOfTextAtSize(ini, 11);
  page.drawText(ini, { x: cx - iw / 2, y: cy - 4, size: 11, font: fonts.bold, color: WHITE });

  sy = cy - r - 14;
  const nw = fonts.bold.widthOfTextAtSize(name, 14);
  page.drawText(name, {
    x: Math.max(M, (SIDEBAR_W - nw) / 2),
    y: sy,
    size: 14,
    font: fonts.bold,
    color: WHITE,
  });
  sy -= 20;

  const pillW = Math.min(SIDEBAR_W - 2 * M, fonts.reg.widthOfTextAtSize(jobTitle, 8) + 18);
  const px = (SIDEBAR_W - pillW) / 2;
  page.drawRectangle({ x: px, y: sy - 10, width: pillW, height: 14, color: ACCENT });
  const jw = fonts.reg.widthOfTextAtSize(jobTitle, 8);
  page.drawText(jobTitle, {
    x: px + (pillW - jw) / 2,
    y: sy - 6,
    size: 8,
    font: fonts.reg,
    color: WHITE,
  });
  sy -= 26;

  const sbHeading = (label: string) => {
    page.drawText(label.toUpperCase(), { x: M, y: sy, size: 8, font: fonts.bold, color: ACCENT });
    sy -= 10;
    page.drawLine({
      start: { x: M, y: sy },
      end: { x: M + inner, y: sy },
      thickness: 0.5,
      color: ACCENT,
    });
    sy -= 10;
  };

  sbHeading('Contact');
  for (const line of [payload.email, payload.phone, payload.location]) {
    if (line) {
      page.drawText(`${BULLET}  ${String(line).slice(0, 78)}`, {
        x: M,
        y: sy,
        size: 9,
        font: fonts.reg,
        color: WHITE,
      });
      sy -= 14;
    }
  }
  sy -= 6;

  sbHeading('Links');
  for (const u of [payload.linkedin, payload.github, payload.kaggle]) {
    if (u) {
      page.drawText(`${BULLET}  ${String(u).slice(0, 72)}`, {
        x: M,
        y: sy,
        size: 8,
        font: fonts.reg,
        color: ACCENT,
      });
      sy -= 12;
    }
  }
  sy -= 6;

  sbHeading('Skills');
  if (payload.skills?.length) {
    let x = M;
    const rowH = 16;
    let rowY = sy;
    for (const sk of payload.skills.slice(0, 40)) {
      const label = sk.slice(0, 44);
      const tw = fonts.reg.widthOfTextAtSize(label, 7) + 10;
      if (x + tw > SIDEBAR_W - M) {
        x = M;
        rowY -= rowH;
      }
      page.drawRectangle({ x, y: rowY - 12, width: tw, height: 12, color: PILL });
      page.drawText(label, { x: x + 5, y: rowY - 9, size: 7, font: fonts.reg, color: WHITE });
      x += tw + 4;
    }
    sy = rowY - rowH - 6;
  }

  if (payload.certifications?.length) {
    sy -= 4;
    sbHeading('Certifications');
    for (const c of payload.certifications.slice(0, 14)) {
      page.drawText(`${BULLET}  ${c.slice(0, 76)}`, { x: M, y: sy, size: 8, font: fonts.reg, color: WHITE });
      sy -= 12;
    }
  }

  if (payload.achievements?.length) {
    sy -= 4;
    sbHeading('Achievements');
    for (const a of payload.achievements.slice(0, 12)) {
      page.drawText(`${BULLET}  ${a.slice(0, 76)}`, { x: M, y: sy, size: 8, font: fonts.reg, color: WHITE });
      sy -= 12;
    }
  }

  let my = ph - TOP_BAR - 18;
  const minY = 56;

  const ensureMainSpace = (needed: number) => {
    if (my < needed) {
      page = pdf.addPage([W, H]);
      ph = pageHeight(page);
      drawTopBar(page);
      page.drawRectangle({
        x: SIDEBAR_W,
        y: 0,
        width: W - SIDEBAR_W,
        height: ph,
        color: LIGHT_BG,
      });
      page.drawLine({
        start: { x: SIDEBAR_W, y: 0 },
        end: { x: SIDEBAR_W, y: ph },
        thickness: 1,
        color: ACCENT,
      });
      page.drawText(`${name} \u2014 continued`, {
        x: MAIN_X,
        y: ph - TOP_BAR - 20,
        size: 9,
        font: fonts.bold,
        color: NAVY,
      });
      my = ph - TOP_BAR - 40;
    }
  };

  const mainH = (label: string) => {
    ensureMainSpace(120);
    page.drawText(label.toUpperCase(), {
      x: MAIN_X,
      y: my,
      size: 11,
      font: fonts.bold,
      color: NAVY,
    });
    my -= 14;
    page.drawLine({
      start: { x: MAIN_X, y: my },
      end: { x: MAIN_X + 130, y: my },
      thickness: 0.8,
      color: ACCENT,
    });
    my -= 12;
  };

  if (payload.summary) {
    mainH('Professional Summary');
    my = drawWrapped(page, payload.summary, MAIN_X, my, MAIN_W, 9, fonts.reg, TEXT, 4, minY);
    my -= 8;
  }

  if (payload.education?.length) {
    mainH('Education');
    for (const ed of payload.education) {
      ensureMainSpace(90);
      page.drawText((ed.degree || '').slice(0, 100), {
        x: MAIN_X,
        y: my,
        size: 9,
        font: fonts.bold,
        color: TEXT,
      });
      if (ed.year) {
        const yw = fonts.oblique.widthOfTextAtSize(ed.year, 8);
        page.drawText(ed.year.slice(0, 32), {
          x: MAIN_X + MAIN_W - yw - 2,
          y: my,
          size: 8,
          font: fonts.oblique,
          color: MUTED,
        });
      }
      my -= 12;
      if (ed.school) {
        my = drawWrapped(page, ed.school, MAIN_X, my, MAIN_W, 9, fonts.oblique, MUTED, 3, minY);
      }
      if (ed.details) {
        my = drawWrapped(page, ed.details, MAIN_X, my, MAIN_W, 8, fonts.reg, MUTED, 3, minY);
      }
      my -= 8;
    }
  }

  if (payload.projects?.length) {
    mainH('Projects');
    for (const pj of payload.projects) {
      ensureMainSpace(100);
      page.drawText((pj.name || 'Project').slice(0, 100), {
        x: MAIN_X,
        y: my,
        size: 9.5,
        font: fonts.bold,
        color: TEXT,
      });
      if (pj.date) {
        const dw = fonts.oblique.widthOfTextAtSize(pj.date, 8);
        page.drawText(pj.date.slice(0, 36), {
          x: MAIN_X + MAIN_W - dw - 2,
          y: my,
          size: 8,
          font: fonts.oblique,
          color: MUTED,
        });
      }
      my -= 12;
      if (pj.tech?.length) {
        my = drawWrapped(
          page,
          pj.tech.join(', ').slice(0, 220),
          MAIN_X,
          my,
          MAIN_W,
          8,
          fonts.oblique,
          MUTED,
          2,
          minY
        );
      }
      for (const b of pj.bullets || []) {
        my = drawWrapped(page, `${BULLET}  ${b}`, MAIN_X + 4, my, MAIN_W - 8, 9, fonts.reg, TEXT, 3, minY);
      }
      my -= 6;
    }
  }

  if (payload.experience?.length) {
    mainH('Experience');
    for (const ex of payload.experience) {
      ensureMainSpace(100);
      page.drawText((ex.title || '').slice(0, 92), {
        x: MAIN_X,
        y: my,
        size: 9.5,
        font: fonts.bold,
        color: TEXT,
      });
      if (ex.duration) {
        const dw = fonts.oblique.widthOfTextAtSize(ex.duration, 8);
        page.drawText(ex.duration.slice(0, 42), {
          x: MAIN_X + MAIN_W - dw - 2,
          y: my,
          size: 8,
          font: fonts.oblique,
          color: MUTED,
        });
      }
      my -= 12;
      if (ex.company) {
        my = drawWrapped(page, ex.company, MAIN_X, my, MAIN_W, 9, fonts.oblique, MUTED, 3, minY);
      }
      for (const b of ex.bullets || []) {
        my = drawWrapped(page, `${BULLET}  ${b}`, MAIN_X + 4, my, MAIN_W - 8, 9, fonts.reg, TEXT, 3, minY);
      }
      my -= 8;
    }
  } else if (payload.experienceNarrative) {
    mainH('Experience');
    my = drawWrapped(
      page,
      payload.experienceNarrative.slice(0, 8000),
      MAIN_X,
      my,
      MAIN_W,
      9,
      fonts.reg,
      TEXT,
      4,
      minY
    );
  }

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

export function isServerlessRuntime(): boolean {
  return Boolean(
    process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.AWS_EXECUTION_ENV ||
      process.env.NETLIFY
  );
}
