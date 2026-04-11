#!/usr/bin/env python3
"""
A4 two-column resume PDF via ReportLab canvas (Helvetica family only).
JSON on stdin -> PDF bytes on stdout.
"""
from __future__ import annotations

import io
import json
import sys
from typing import List, Tuple

from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import simpleSplit
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas as pdfcanvas


def hex_rgb(h: str) -> Tuple[float, float, float]:
    h = h.strip().lstrip("#")
    return tuple(int(h[i : i + 2], 16) / 255.0 for i in (0, 2, 4))  # type: ignore[return-value]


NAVY = hex_rgb("#1A2B4A")
ACCENT = hex_rgb("#2E86AB")
LIGHT_BG = hex_rgb("#F4F7FB")
WHITE = hex_rgb("#FFFFFF")
MUTED = hex_rgb("#6B7A8D")
TEXT = hex_rgb("#1E2A3A")
SIDEBAR_PILL = hex_rgb("#243A63")

W, H = A4
TOP_BAR = 6.0
MARGIN_X = 14.0
SECTION_GAP = 14.0
ITEM_GAP = 8.0
SIDEBAR_FRAC = 0.30
BULLET = "\u2022"
Y_MIN = 56.0


def _get(d: dict, *keys: str, default=None):
    for k in keys:
        if k in d and d[k] not in (None, ""):
            return d[k]
    return default


def _list_str(d: dict, k: str) -> List[str]:
    v = d.get(k) or []
    if isinstance(v, list):
        return [str(x).strip() for x in v if str(x).strip()]
    return []


def initials(name: str) -> str:
    parts = [p for p in name.replace(",", " ").split() if p]
    if not parts:
        return "?"
    if len(parts) == 1:
        return parts[0][:2].upper()
    return (parts[0][0] + parts[1][0]).upper()


def draw_wrapped(
    c: pdfcanvas.Canvas,
    text: str,
    x: float,
    y: float,
    maxw: float,
    font: str,
    size: float,
    color: Tuple[float, float, float],
    leading: float,
) -> float:
    if not text:
        return y
    c.setFont(font, size)
    c.setFillColorRGB(*color)
    for line in simpleSplit(str(text), font, size, maxw):
        c.drawString(x, y, line)
        y -= leading
    return y


def draw_sidebar_heading(c: pdfcanvas.Canvas, x: float, y: float, label: str, sidebar_inner: float) -> float:
    c.setFont("Helvetica-Bold", 8)
    c.setFillColorRGB(*ACCENT)
    c.drawString(x, y, label.upper())
    y -= 3
    c.setStrokeColorRGB(*ACCENT)
    c.setLineWidth(0.5)
    c.line(x, y, x + sidebar_inner, y)
    y -= 10
    return y


def draw_main_heading(c: pdfcanvas.Canvas, x: float, y: float, label: str) -> float:
    c.setFont("Helvetica-Bold", 11)
    c.setFillColorRGB(*NAVY)
    c.drawString(x, y, label.upper())
    y -= 4
    c.setStrokeColorRGB(*ACCENT)
    c.setLineWidth(0.8)
    c.line(x, y, x + 130, y)
    y -= 12
    return y


def draw_skill_pills(
    c: pdfcanvas.Canvas,
    skills: List[str],
    x0: float,
    y: float,
    max_x: float,
) -> float:
    x = x0
    pill_h = 12.0
    row_h = pill_h + 4
    c.setFont("Helvetica", 7)
    for sk in skills:
        label = sk[:44]
        tw = stringWidth(label, "Helvetica", 7) + 10
        if x + tw > max_x:
            x = x0
            y -= row_h
        c.setFillColorRGB(*SIDEBAR_PILL)
        c.roundRect(x, y - pill_h + 2, tw, pill_h, 3, stroke=0, fill=1)
        c.setFillColorRGB(*WHITE)
        c.drawString(x + 5, y - pill_h + 5, label)
        x += tw + 4
    return y - row_h - 4


def draw_top_bar(c: pdfcanvas.Canvas) -> None:
    c.setFillColorRGB(*ACCENT)
    c.rect(0, H - TOP_BAR, W, TOP_BAR, stroke=0, fill=1)


def draw_sidebar(
    c: pdfcanvas.Canvas,
    data: dict,
    name: str,
    job_title: str,
    sidebar_w: float,
) -> float:
    """Returns bottom-most y used in sidebar (for layout check)."""
    c.setFillColorRGB(*NAVY)
    c.rect(0, 0, sidebar_w, H - TOP_BAR, stroke=0, fill=1)

    inner = sidebar_w - 2 * MARGIN_X
    cx = sidebar_w / 2
    cy = H - TOP_BAR - 36
    r = 22
    c.setFillColorRGB(*ACCENT)
    c.circle(cx, cy, r, stroke=0, fill=1)
    ini = initials(name)
    c.setFont("Helvetica-Bold", 11)
    c.setFillColorRGB(*WHITE)
    iw = stringWidth(ini, "Helvetica-Bold", 11)
    c.drawString(cx - iw / 2, cy - 4, ini)

    y = cy - r - 14
    c.setFont("Helvetica-Bold", 14)
    c.setFillColorRGB(*WHITE)
    nw = stringWidth(name, "Helvetica-Bold", 14)
    c.drawString(max(MARGIN_X, (sidebar_w - nw) / 2), y, name[:48])
    y -= 18

    pill_w = min(inner + 2 * MARGIN_X, stringWidth(job_title, "Helvetica", 8) + 18)
    px = (sidebar_w - pill_w) / 2
    c.setFillColorRGB(*ACCENT)
    c.roundRect(px, y - 10, pill_w, 14, 7, stroke=0, fill=1)
    c.setFont("Helvetica", 8)
    c.setFillColorRGB(*WHITE)
    tw = stringWidth(job_title[:60], "Helvetica", 8)
    c.drawString(px + (pill_w - tw) / 2, y - 6, job_title[:60])
    y -= 24

    y = draw_sidebar_heading(c, MARGIN_X, y, "Contact", inner)
    c.setFont("Helvetica", 9)
    c.setFillColorRGB(*WHITE)
    for line in (
        _get(data, "email"),
        _get(data, "phone"),
        _get(data, "location"),
    ):
        if line:
            c.drawString(MARGIN_X, y, f"{BULLET}  {str(line)[:78]}")
            y -= ITEM_GAP
    y -= 6

    y = draw_sidebar_heading(c, MARGIN_X, y, "Links", inner)
    c.setFont("Helvetica", 8)
    c.setFillColorRGB(*ACCENT)
    for key in ("linkedin", "github", "kaggle"):
        url = _get(data, key)
        if url:
            c.drawString(MARGIN_X, y, f"{BULLET}  {str(url)[:72]}")
            y -= ITEM_GAP
    y -= 6

    y = draw_sidebar_heading(c, MARGIN_X, y, "Skills", inner)
    skills = _list_str(data, "skills")
    if skills:
        y = draw_skill_pills(c, skills, MARGIN_X, y, sidebar_w - MARGIN_X)
    y -= 4

    certs = _list_str(data, "certifications")
    if certs:
        y = draw_sidebar_heading(c, MARGIN_X, y, "Certifications", inner)
        c.setFont("Helvetica", 8)
        c.setFillColorRGB(*WHITE)
        for cert in certs[:14]:
            c.drawString(MARGIN_X, y, f"\u2726  {cert[:76]}")
            y -= ITEM_GAP
        y -= 4

    ach = _list_str(data, "achievements")
    if ach:
        y = draw_sidebar_heading(c, MARGIN_X, y, "Achievements", inner)
        c.setFont("Helvetica", 8)
        c.setFillColorRGB(*WHITE)
        for a in ach[:12]:
            c.drawString(MARGIN_X, y, f"\u2726  {a[:76]}")
            y -= ITEM_GAP
    return y


def draw_main_panel_bg(c: pdfcanvas.Canvas, sidebar_w: float) -> None:
    c.setFillColorRGB(*LIGHT_BG)
    c.rect(sidebar_w, 0, W - sidebar_w, H - TOP_BAR, stroke=0, fill=1)
    c.setStrokeColorRGB(*ACCENT)
    c.setLineWidth(1)
    c.line(sidebar_w, 0, sidebar_w, H - TOP_BAR)


def draw_experience_block(
    c: pdfcanvas.Canvas,
    main_x: float,
    y: float,
    main_w: float,
    body_pt: float,
    lead: float,
    exp_list: List[dict],
) -> float:
    for ex in exp_list:
        title = str(ex.get("title") or "")
        company = str(ex.get("company") or "")
        duration = str(ex.get("duration") or "")
        if y < Y_MIN:
            return y
        c.setFont("Helvetica-Bold", 9.5)
        c.setFillColorRGB(*TEXT)
        c.drawString(main_x, y, title[:92])
        if duration:
            c.setFont("Helvetica-Oblique", 8)
            c.setFillColorRGB(*MUTED)
            dw = stringWidth(duration[:42], "Helvetica-Oblique", 8)
            c.drawString(main_x + main_w - dw - 2, y, duration[:42])
        y -= 12
        if company:
            y = draw_wrapped(
                c, company, main_x, y, main_w, "Helvetica-Oblique", 9, MUTED, 11
            )
        for b in ex.get("bullets") or []:
            if y < Y_MIN:
                return y
            bl = simpleSplit(f"{BULLET}  {str(b)}", "Helvetica", body_pt, main_w - 8)
            c.setFont("Helvetica", body_pt)
            c.setFillColorRGB(*TEXT)
            for line in bl:
                c.drawString(main_x + 4, y, line)
                y -= lead
            y -= 2
        y -= SECTION_GAP // 2
    return y


def build_pdf(data: dict) -> bytes:
    buf = io.BytesIO()
    c = pdfcanvas.Canvas(buf, pagesize=A4)

    name = str(_get(data, "name", default="Candidate"))[:80]
    job_title = str(_get(data, "jobTitle", "job_title", default="Professional"))[:80]
    sidebar_w = W * SIDEBAR_FRAC
    main_x = sidebar_w + 12
    main_w = W - main_x - MARGIN_X

    blob = json.dumps(data)
    long_doc = len(blob) > 9000
    body_pt = 8.5 if long_doc else 9.0
    lead = 13.0 if long_doc else 14.0
    if long_doc:
        body_pt = max(7.5, body_pt - 0.5)
        lead = max(11.5, lead - 1)

    draw_top_bar(c)
    draw_sidebar(c, data, name, job_title, sidebar_w)
    draw_main_panel_bg(c, sidebar_w)

    y = H - TOP_BAR - 18

    summary = str(_get(data, "summary", default="")).strip()
    if summary:
        y = draw_main_heading(c, main_x, y, "Professional Summary")
        y = draw_wrapped(c, summary, main_x, y, main_w, "Helvetica", body_pt, TEXT, lead)
        y -= SECTION_GAP

    edu = data.get("education") or []
    if edu:
        y = draw_main_heading(c, main_x, y, "Education")
        for ed in edu:
            if y < Y_MIN:
                break
            degree = str(ed.get("degree") or "")
            school = str(ed.get("school") or "")
            year = str(ed.get("year") or "")
            c.setFont("Helvetica-Bold", 9)
            c.setFillColorRGB(*TEXT)
            c.drawString(main_x, y, degree[:100])
            if year:
                c.setFont("Helvetica-Oblique", 8)
                c.setFillColorRGB(*MUTED)
                yw = stringWidth(year[:32], "Helvetica-Oblique", 8)
                c.drawString(main_x + main_w - yw - 2, y, year[:32])
            y -= 12
            if school:
                y = draw_wrapped(
                    c, school, main_x, y, main_w, "Helvetica-Oblique", 9, MUTED, 12
                )
            det = str(ed.get("details") or "")
            if det:
                y = draw_wrapped(c, det, main_x, y, main_w, "Helvetica", 8, MUTED, 11)
            y -= ITEM_GAP
        y -= SECTION_GAP // 2

    projs = data.get("projects") or []
    if projs:
        y = draw_main_heading(c, main_x, y, "Projects")
        for pj in projs:
            if y < Y_MIN + 40:
                break
            pname = str(pj.get("name") or "Project")
            c.setFont("Helvetica-Bold", 9.5)
            c.setFillColorRGB(*TEXT)
            c.drawString(main_x, y, pname[:100])
            dt = str(pj.get("date") or "")
            if dt:
                c.setFont("Helvetica-Oblique", 8)
                c.setFillColorRGB(*MUTED)
                dw = stringWidth(dt[:36], "Helvetica-Oblique", 8)
                c.drawString(main_x + main_w - dw - 2, y, dt[:36])
            y -= 12
            tech = pj.get("tech") or []
            if tech:
                y = draw_wrapped(
                    c,
                    ", ".join(str(t) for t in tech)[:220],
                    main_x,
                    y,
                    main_w,
                    "Helvetica-Oblique",
                    8,
                    MUTED,
                    10,
                )
            for b in pj.get("bullets") or []:
                if y < Y_MIN:
                    break
                bl = simpleSplit(f"{BULLET}  {str(b)}", "Helvetica", body_pt, main_w - 8)
                c.setFont("Helvetica", body_pt)
                c.setFillColorRGB(*TEXT)
                for line in bl:
                    c.drawString(main_x + 4, y, line)
                    y -= lead
            y -= SECTION_GAP // 2

    exp = data.get("experience") or []
    nar = str(data.get("experienceNarrative") or "").strip()
    if exp:
        y = draw_main_heading(c, main_x, y, "Experience")
        y = draw_experience_block(c, main_x, y, main_w, body_pt, lead, exp)
    elif nar:
        y = draw_main_heading(c, main_x, y, "Experience")
        y = draw_wrapped(c, nar[:6000], main_x, y, main_w, "Helvetica", body_pt, TEXT, lead)

    c.save()
    out = buf.getvalue()
    if len(out) < 200:
        raise RuntimeError("PDF output too small")
    return out


def main():
    raw = sys.stdin.buffer.read()
    if not raw:
        sys.stderr.write("empty stdin\n")
        sys.exit(1)
    data = json.loads(raw.decode("utf-8"))
    sys.stdout.buffer.write(build_pdf(data))


if __name__ == "__main__":
    main()
