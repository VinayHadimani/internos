import { spawn } from 'child_process';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { buildResumePdfPayloadFromText, type ResumePdfPayload } from '@/lib/build-resume-pdf-payload';

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

    const scriptPath = path.join(process.cwd(), 'python', 'generate_resume_pdf.py');
    const pythonBin = process.env.PYTHON_PATH || (process.platform === 'win32' ? 'python' : 'python3');

    const pdfBuffer: Buffer = await new Promise((resolve, reject) => {
      const proc = spawn(pythonBin, [scriptPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      });
      const chunks: Buffer[] = [];
      const errChunks: Buffer[] = [];
      proc.stdout.on('data', (d) => chunks.push(Buffer.from(d)));
      proc.stderr.on('data', (d) => errChunks.push(Buffer.from(d)));
      proc.on('error', (e) => reject(e));
      proc.on('close', (code) => {
        if (code !== 0) {
          reject(
            new Error(
              `Python exited ${code}: ${Buffer.concat(errChunks).toString('utf8') || 'no stderr'}`
            )
          );
          return;
        }
        resolve(Buffer.concat(chunks));
      });
      proc.stdin.write(JSON.stringify(payload), 'utf8');
      proc.stdin.end();
    });

    if (!pdfBuffer.length) {
      return NextResponse.json(
        {
          success: false,
          error:
            'PDF generation returned empty output. Install Python dependencies: pip install -r python/requirements.txt',
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
        hint: 'Ensure Python 3 and reportlab are installed (see python/requirements.txt). Set PYTHON_PATH if needed.',
      },
      { status: 500 }
    );
  }
}
