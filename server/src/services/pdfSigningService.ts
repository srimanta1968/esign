import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { DataService } from './DataService';
import { StorageService } from './storageService';
import { toWinAnsiSafe } from '../utils/pdfText';

/**
 * PdfSigningService generates signed PDFs by embedding signature images
 * onto the original document at the coordinates specified by signature fields.
 */
export class PdfSigningService {
  /**
   * Generate a signed PDF with all signature images embedded.
   * @param workflowId - The workflow ID to generate the signed PDF for.
   * @returns The file path of the signed PDF.
   */
  static async generateSignedPdf(workflowId: string): Promise<string> {
    // 1. Get workflow and document info
    const workflow = await DataService.queryOne<{
      id: string;
      document_id: string;
      creator_id: string;
    }>(
      'SELECT id, document_id, creator_id FROM signing_workflows WHERE id = $1',
      [workflowId]
    );

    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const document = await DataService.queryOne<{
      id: string;
      file_path: string;
      original_name: string;
    }>(
      'SELECT id, file_path, original_name FROM documents WHERE id = $1',
      [workflow.document_id]
    );

    if (!document) {
      throw new Error(`Document ${workflow.document_id} not found`);
    }

    // 2. Load original PDF from S3 via StorageService
    const originalBytes = await StorageService.getFile(document.file_path);
    const pdfDoc = await PDFDocument.load(originalBytes);

    // 3. Get all signature fields with submitted signature data
    const fields = await DataService.queryAll<{
      id: string;
      recipient_id: string;
      field_type: string;
      page: number;
      x: number;
      y: number;
      width: number;
      height: number;
      signature_data: string | null;
      signature_type: string | null;
      signed_at: Date | null;
    }>(
      `SELECT id, recipient_id, field_type, page, x, y, width, height,
              signature_data, signature_type, signed_at
       FROM signature_fields
       WHERE workflow_id = $1 AND signature_data IS NOT NULL`,
      [workflowId]
    );

    // 4. Embed each signature onto the PDF
    const pages = pdfDoc.getPages();

    for (const field of fields) {
      const pageIndex = (field.page || 1) - 1; // Convert 1-based to 0-based
      if (pageIndex < 0 || pageIndex >= pages.length) {
        console.warn(`Skipping field ${field.id}: page ${field.page} out of range`);
        continue;
      }

      const page = pages[pageIndex];
      await PdfSigningService.embedSignatureOnPage(page, field.signature_data!, field, pdfDoc);
    }

    // 5. Save signed PDF to temp, then upload to S3
    const signedPdfBytes = await pdfDoc.save();
    const tempPath = path.join(os.tmpdir(), `${workflowId}_signed.pdf`);
    fs.writeFileSync(tempPath, signedPdfBytes);

    const storageResult = await StorageService.store(tempPath, 'signed', {
      workflowId,
      filename: `${workflowId}_signed`,
    });

    // Clean up temp file
    fs.unlink(tempPath, () => {});

    // 6. Store path in signing_workflows table
    await DataService.query(
      'UPDATE signing_workflows SET signed_pdf_path = $1 WHERE id = $2',
      [storageResult.path, workflowId]
    );

    return storageResult.path;
  }

  /**
   * Embed a signature image onto a PDF page at the specified coordinates.
   * Coordinates are percentages (0-100) of page dimensions.
   * Supports both drawn (PNG base64) and typed signatures.
   */
  static async embedSignatureOnPage(
    page: any,
    signatureData: string,
    field: {
      x: number;
      y: number;
      width: number;
      height: number;
      signature_type?: string | null;
      field_type?: string;
    },
    pdfDoc: PDFDocument
  ): Promise<void> {
    const { width: pageWidth, height: pageHeight } = page.getSize();

    // Convert percentage coordinates to absolute positions
    const absX = (field.x / 100) * pageWidth;
    const absY = pageHeight - ((field.y / 100) * pageHeight) - ((field.height / 100) * pageHeight);
    const absWidth = (field.width / 100) * pageWidth;
    const absHeight = (field.height / 100) * pageHeight;

    // Text and date fields store plain strings in signature_data and must always
    // render as text. Signature/initials fields render as text only when typed.
    const isTextField = field.field_type === 'text' || field.field_type === 'date';
    const isTyped = field.signature_type === 'typed';

    if (isTextField || isTyped) {
      const fontSize = Math.min(absHeight * 0.6, 24);
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

      const safe = toWinAnsiSafe(signatureData);
      const text = safe.length > 50 ? safe.substring(0, 50) : safe;

      page.drawText(text, {
        x: absX + 4,
        y: absY + (absHeight - fontSize) / 2,
        size: fontSize,
        font,
        color: rgb(0, 0, 0.4),
      });
    } else {
      // For drawn signatures, decode base64 PNG and embed
      try {
        let imageBytes: Uint8Array;

        if (signatureData.startsWith('data:image/png;base64,')) {
          const base64Data = signatureData.replace('data:image/png;base64,', '');
          imageBytes = Uint8Array.from(Buffer.from(base64Data, 'base64'));
        } else if (signatureData.startsWith('data:image/')) {
          // Handle other image formats - try as PNG
          const base64Data = signatureData.replace(/^data:image\/\w+;base64,/, '');
          imageBytes = Uint8Array.from(Buffer.from(base64Data, 'base64'));
        } else {
          // Assume raw base64
          imageBytes = Uint8Array.from(Buffer.from(signatureData, 'base64'));
        }

        const pngImage = await pdfDoc.embedPng(imageBytes);

        page.drawImage(pngImage, {
          x: absX,
          y: absY,
          width: absWidth,
          height: absHeight,
        });
      } catch (error) {
        // Fallback: if image embedding fails, draw the data as text
        console.warn(`Failed to embed signature image, falling back to text: ${error instanceof Error ? error.message : error}`);
        const fontSize = Math.min(absHeight * 0.5, 16);
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

        page.drawText('[Signature]', {
          x: absX + 4,
          y: absY + (absHeight - fontSize) / 2,
          size: fontSize,
          font,
          color: rgb(0, 0, 0.4),
        });
      }
    }
  }
}

export default PdfSigningService;
