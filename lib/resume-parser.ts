"use server";

import { getDocumentProxy, extractText } from 'unpdf';

/**
 * Extracts clean text from a PDF file buffer.
 * Uses 'unpdf' which is already in package.json.
 */
export async function parseResumePDF(buffer: ArrayBuffer): Promise<string> {
  try {
    const uint8Array = new Uint8Array(buffer);
    const pdf = await getDocumentProxy(uint8Array);
    const { text } = await extractText(pdf);
    
    // Join pages and sanitize
    const cleanText = text
      .join('\n')
      .replace(/[^\x20-\x7E\n\r\t]/g, ' ') // Remove non-printable characters
      .replace(/\s+/g, ' ')               // Collapse whitespace
      .trim();
      
    return cleanText;
  } catch (error) {
    console.error('[Resume Parser] PDF parsing failed:', error);
    throw new Error('Failed to extract text from PDF. Please ensure it is a valid document.');
  }
}

/**
 * Fallback for plain text files.
 */
export async function parseResumeText(text: string): Promise<string> {
  return text
    .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
