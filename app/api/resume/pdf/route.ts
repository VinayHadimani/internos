import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { buildResumePdfPayloadFromText, type ResumePdfPayload } from '@/lib/build-resume-pdf-payload';
import { generateResumePdfPdfKit, isServerlessRuntime } from '@/lib/generate-resume-pdf-pdfkit';
import { runReportLabPdfScript } from '@/lib/run-reportlab-pdf';

function slugFileName(name: string): string {
  const s = name.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_') || 'Candidate';
  return `${s}_Resume.pdf`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tailoredText: string = body.tailoredResume ?? body.resumeText ?? '';
    if (!tailoredText || typeof tailoredText !== 'string' || tailoredText.length < 10) {
      return NextResponse.json({ success: false, error: 'tailoredResume text required' }, { status: 400 });
    }

    let payload: ResumePdfPayload =
      body.payload && typeof body.payload === 'object'
        ? (body.payload as ResumePdfPayload)
        : buildResumePdfPayloadFromText(tailoredText, {
            jobTitle: body.jobTitle,
            skills: Array.isArray(body.skills) ? body.skills : undefined,
            nameHint: body.name,
          });

    if (!payload.name?.trim()) payload = { ...payload, name: 'Candidate' };

    const usePdfKit =
      isServerlessRuntime() ||
      process.env.RESUME_PDF_ENGINE === 'pdfkit' ||
      process.env.RESUME_PDF_ENGINE === 'node';

    let pdfBuffer: Buffer;
    if (usePdfKit) {
      pdfBuffer = await generateResumePdfPdfKit(payload);
    } else {
      const scriptPath = path.join(process.cwd(), 'python', 'generate_resume_pdf.py');
      try {
        pdfBuffer = await runReportLabPdfScript(scriptPath, JSON.stringify(payload));
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('Could not find Python')) {
          pdfBuffer = await generateResumePdfPdfKit(payload);
        } else {
          throw err;
        }
      }
    }

    if (!pdfBuffer.length) {
      return NextResponse.json(
        {
          success: false,
          error: 'PDF generation returned empty output.',
        },
        { status: 500 }
      );
    }

    const filename = slugFileName(payload.name);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    console.error('[resume/pdf]', e);
    const msg = e instanceof Error ? e.message : 'PDF failed';
    return NextResponse.json(
      {
        success: false,
        error: msg,
        hint:
          'On Vercel/AWS, PDFs use PDFKit (no Python). Locally you can use ReportLab: install Python + pip install -r python/requirements.txt, or set RESUME_PDF_ENGINE=pdfkit to force PDFKit.',
      },
      { status: 500 }
    );
  }
}
