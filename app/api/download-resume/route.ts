import { NextRequest, NextResponse } from 'next/server';
import { jsPDF } from 'jspdf';

interface ResumeData {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  matchScore: number;
  tailoredResume: {
    summary: string;
    experience: { title: string; company: string; duration: string; bullets: string[] }[];
    education: { degree: string; college: string; year: string; details: string }[];
    skills: { matched: string[]; missing: string[] };
    projects: { name: string; description: string; tech: string[] }[];
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: ResumeData = await request.json();
    const { tailoredResume, name, email, phone, location } = body;

    console.log('[Download Resume] Generating PDF...');

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    let y = 20;

    const BLUE = [30, 58, 95] as const;
    const DARK = [33, 33, 33] as const;
    const GRAY = [100, 100, 100] as const;

    // ── Header ──
    doc.setFontSize(22);
    doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(name || 'Your Name', margin, y);
    y += 8;

    // Contact line
    const contactParts = [email, phone, location].filter(Boolean);
    if (contactParts.length > 0) {
      doc.setFontSize(9);
      doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
      doc.setFont('helvetica', 'normal');
      doc.text(contactParts.join('  |  '), margin, y);
      y += 4;
    }

    // Divider line
    doc.setDrawColor(BLUE[0], BLUE[1], BLUE[2]);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    const checkPageBreak = (needed: number) => {
      if (y + needed > 270) {
        doc.addPage();
        y = 20;
      }
    };

    // ── Summary ──
    if (tailoredResume.summary) {
      checkPageBreak(20);
      doc.setFontSize(10);
      doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
      doc.setFont('helvetica', 'bold');
      doc.text('PROFESSIONAL SUMMARY', margin, y);
      y += 6;

      doc.setFontSize(9.5);
      doc.setTextColor(DARK[0], DARK[1], DARK[2]);
      doc.setFont('helvetica', 'normal');
      const summaryLines = doc.splitTextToSize(tailoredResume.summary, contentWidth);
      doc.text(summaryLines, margin, y);
      y += summaryLines.length * 4.5 + 8;
    }

    // ── Experience ──
    if (tailoredResume.experience.length > 0) {
      checkPageBreak(15);
      doc.setFontSize(10);
      doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
      doc.setFont('helvetica', 'bold');
      doc.text('EXPERIENCE', margin, y);
      y += 6;

      for (const exp of tailoredResume.experience) {
        checkPageBreak(20);

        // Title + Duration
        doc.setFontSize(9.5);
        doc.setTextColor(DARK[0], DARK[1], DARK[2]);
        doc.setFont('helvetica', 'bold');
        doc.text(exp.title, margin, y);

        const durWidth = doc.getTextWidth(exp.duration);
        doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
        doc.setFont('helvetica', 'normal');
        doc.text(exp.duration, pageWidth - margin - durWidth, y);
        y += 4.5;

        // Company
        doc.setTextColor(BLUE[0] + 40, BLUE[1] + 40, BLUE[2] + 40);
        doc.setFont('helvetica', 'italic');
        doc.text(exp.company, margin, y);
        y += 5;

        // Bullets
        doc.setTextColor(DARK[0], DARK[1], DARK[2]);
        doc.setFont('helvetica', 'normal');
        for (const bullet of exp.bullets) {
          checkPageBreak(8);
          const bulletLines = doc.splitTextToSize(`•  ${bullet}`, contentWidth - 4);
          doc.text(bulletLines, margin + 2, y);
          y += bulletLines.length * 4 + 1.5;
        }
        y += 4;
      }
      y += 2;
    }

    // ── Education ──
    if (tailoredResume.education.length > 0) {
      checkPageBreak(15);
      doc.setFontSize(10);
      doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
      doc.setFont('helvetica', 'bold');
      doc.text('EDUCATION', margin, y);
      y += 6;

      for (const edu of tailoredResume.education) {
        checkPageBreak(12);
        doc.setFontSize(9.5);
        doc.setTextColor(DARK[0], DARK[1], DARK[2]);
        doc.setFont('helvetica', 'bold');
        doc.text(edu.degree, margin, y);

        const yearWidth = doc.getTextWidth(edu.year);
        doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
        doc.setFont('helvetica', 'normal');
        doc.text(edu.year, pageWidth - margin - yearWidth, y);
        y += 4.5;

        doc.setTextColor(DARK[0], DARK[1], DARK[2]);
        doc.text(edu.college, margin, y);
        y += 4;

        if (edu.details) {
          doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
          doc.setFont('helvetica', 'italic');
          doc.text(edu.details, margin, y);
          y += 4;
        }
        y += 4;
      }
      y += 2;
    }

    // ── Projects ──
    if (tailoredResume.projects.length > 0) {
      checkPageBreak(15);
      doc.setFontSize(10);
      doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
      doc.setFont('helvetica', 'bold');
      doc.text('PROJECTS', margin, y);
      y += 6;

      for (const proj of tailoredResume.projects) {
        checkPageBreak(15);
        doc.setFontSize(9.5);
        doc.setTextColor(DARK[0], DARK[1], DARK[2]);
        doc.setFont('helvetica', 'bold');
        doc.text(proj.name, margin, y);
        y += 4.5;

        doc.setFont('helvetica', 'normal');
        const descLines = doc.splitTextToSize(proj.description, contentWidth);
        doc.text(descLines, margin, y);
        y += descLines.length * 4 + 2;

        if (proj.tech.length > 0) {
          doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
          doc.setFontSize(8.5);
          doc.text(`Technologies: ${proj.tech.join(', ')}`, margin, y);
          y += 4;
        }
        y += 4;
      }
      y += 2;
    }

    // ── Skills ──
    if (tailoredResume.skills.matched.length > 0) {
      checkPageBreak(15);
      doc.setFontSize(10);
      doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
      doc.setFont('helvetica', 'bold');
      doc.text('SKILLS', margin, y);
      y += 6;

      doc.setFontSize(9.5);
      doc.setTextColor(DARK[0], DARK[1], DARK[2]);
      doc.setFont('helvetica', 'normal');
      const skillsText = tailoredResume.skills.matched.join('  •  ');
      const skillLines = doc.splitTextToSize(skillsText, contentWidth);
      doc.text(skillLines, margin, y);
      y += skillLines.length * 4.5;
    }

    console.log('[Download Resume] PDF generated successfully');

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${(name || 'resume').replace(/\s+/g, '_')}_tailored.pdf"`,
      },
    });
  } catch (error) {
    console.error('[Download Resume] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}
