import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import { DataService } from './DataService';
import { StorageService } from './storageService';
import { toWinAnsiSafe } from '../utils/pdfText';

/**
 * CertificateService generates a Signing Certificate PDF
 * documenting the signing workflow completion with compliance info.
 */
export class CertificateService {
  /**
   * Generate a signing certificate PDF for a completed workflow.
   * @param workflowId - The workflow ID.
   * @returns The file path of the generated certificate PDF.
   */
  static async generateCertificate(workflowId: string): Promise<string> {
    // 1. Get workflow info
    const workflow = await DataService.queryOne<{
      id: string;
      document_id: string;
      creator_id: string;
      workflow_type: string;
      status: string;
      created_at: Date;
      updated_at: Date;
    }>(
      'SELECT * FROM signing_workflows WHERE id = $1',
      [workflowId]
    );

    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    // 2. Get document info
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

    // 3. Compute SHA-256 hash of original document from S3
    let documentHash = 'UNAVAILABLE';
    try {
      const fileBuffer = await StorageService.getFile(document.file_path);
      documentHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    } catch {
      console.warn('Could not read original document for hash computation');
    }

    // 4. Get all recipients
    const recipients = await DataService.queryAll<{
      id: string;
      signer_email: string;
      signer_name: string;
      status: string;
      signed_at: Date | null;
    }>(
      'SELECT id, signer_email, signer_name, status, signed_at FROM workflow_recipients WHERE workflow_id = $1 ORDER BY signing_order ASC',
      [workflowId]
    );

    // 5. Get workflow history for IP addresses
    const history = await DataService.queryAll<{
      action: string;
      actor_email: string;
      actor_ip: string;
      metadata: any;
      created_at: Date;
    }>(
      'SELECT action, actor_email, actor_ip, metadata, created_at FROM workflow_history WHERE workflow_id = $1 ORDER BY created_at ASC',
      [workflowId]
    );

    // Build IP map from history (email -> IP)
    const ipMap: Record<string, string> = {};
    for (const h of history) {
      if (h.action === 'signed' && h.actor_email) {
        ipMap[h.actor_email] = h.actor_ip || 'N/A';
      }
    }

    // 6. Generate unique certificate ID
    const certificateId = crypto.randomUUID();

    // 7. Create PDF certificate
    const pdfDoc = await PDFDocument.create();
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const pageWidth = 612; // Letter width
    const pageHeight = 792; // Letter height
    let page = pdfDoc.addPage([pageWidth, pageHeight]);

    let y = pageHeight - 60;

    // ─── Header ───
    // Blue header bar
    page.drawRectangle({
      x: 0,
      y: pageHeight - 80,
      width: pageWidth,
      height: 80,
      color: rgb(0.102, 0.337, 0.859), // #1a56db
    });

    page.drawText('eDocSign', {
      x: 40,
      y: pageHeight - 35,
      size: 22,
      font: helveticaBold,
      color: rgb(1, 1, 1),
    });

    page.drawText('Certificate of Completion', {
      x: 40,
      y: pageHeight - 60,
      size: 14,
      font: helvetica,
      color: rgb(0.9, 0.9, 1),
    });

    y = pageHeight - 110;

    // ─── Certificate ID ───
    page.drawText(`Certificate ID: ${certificateId}`, {
      x: 40,
      y,
      size: 9,
      font: helvetica,
      color: rgb(0.5, 0.5, 0.5),
    });
    y -= 30;

    // ─── Document Information ───
    page.drawText('Document Information', {
      x: 40,
      y,
      size: 14,
      font: helveticaBold,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= 6;

    // Divider line
    page.drawLine({
      start: { x: 40, y },
      end: { x: pageWidth - 40, y },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });
    y -= 18;

    const labelX = 40;
    const valueX = 180;

    const drawLabelValue = (label: string, value: string) => {
      page.drawText(label, { x: labelX, y, size: 10, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) });
      const safe = toWinAnsiSafe(value);
      const displayValue = safe.length > 70 ? safe.substring(0, 67) + '...' : safe;
      page.drawText(displayValue, { x: valueX, y, size: 10, font: helvetica, color: rgb(0.1, 0.1, 0.1) });
      y -= 18;
    };

    drawLabelValue('Filename:', document.original_name || 'Unknown');
    drawLabelValue('Document ID:', document.id);
    drawLabelValue('SHA-256 Hash:', documentHash);
    drawLabelValue('Workflow ID:', workflowId);
    drawLabelValue('Workflow Type:', workflow.workflow_type);

    y -= 16;

    // ─── Signing Summary Table ───
    page.drawText('Signing Summary', {
      x: 40,
      y,
      size: 14,
      font: helveticaBold,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= 6;

    page.drawLine({
      start: { x: 40, y },
      end: { x: pageWidth - 40, y },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });
    y -= 18;

    // Table headers
    const colSigner = 40;
    const colEmail = 160;
    const colStatus = 310;
    const colSignedAt = 380;
    const colIP = 490;

    page.drawText('Signer', { x: colSigner, y, size: 9, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) });
    page.drawText('Email', { x: colEmail, y, size: 9, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) });
    page.drawText('Status', { x: colStatus, y, size: 9, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) });
    page.drawText('Signed At', { x: colSignedAt, y, size: 9, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) });
    page.drawText('IP Address', { x: colIP, y, size: 9, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) });
    y -= 4;

    page.drawLine({
      start: { x: 40, y },
      end: { x: pageWidth - 40, y },
      thickness: 0.3,
      color: rgb(0.85, 0.85, 0.85),
    });
    y -= 14;

    // Table rows
    for (const r of recipients) {
      // Check if we need a new page
      if (y < 120) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - 60;
      }

      const signerName = toWinAnsiSafe(r.signer_name || 'N/A').substring(0, 18);
      const email = toWinAnsiSafe(r.signer_email).substring(0, 22);
      const status = r.status.charAt(0).toUpperCase() + r.status.slice(1);
      const signedAt = r.signed_at
        ? new Date(r.signed_at).toISOString().replace('T', ' ').substring(0, 16)
        : 'N/A';
      const ip = ipMap[r.signer_email] || 'N/A';

      page.drawText(signerName, { x: colSigner, y, size: 9, font: helvetica, color: rgb(0.1, 0.1, 0.1) });
      page.drawText(email, { x: colEmail, y, size: 9, font: helvetica, color: rgb(0.1, 0.1, 0.1) });
      page.drawText(status, { x: colStatus, y, size: 9, font: helvetica, color: rgb(0.1, 0.1, 0.1) });
      page.drawText(signedAt, { x: colSignedAt, y, size: 9, font: helvetica, color: rgb(0.1, 0.1, 0.1) });
      page.drawText(ip, { x: colIP, y, size: 9, font: helvetica, color: rgb(0.1, 0.1, 0.1) });
      y -= 16;
    }

    y -= 20;

    // ─── Compliance Statement ───
    if (y < 140) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - 60;
    }

    page.drawText('Compliance Statement', {
      x: 40,
      y,
      size: 14,
      font: helveticaBold,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= 6;

    page.drawLine({
      start: { x: 40, y },
      end: { x: pageWidth - 40, y },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });
    y -= 18;

    const complianceText =
      'This document was signed electronically in accordance with the ESIGN Act ' +
      '(15 U.S.C. \u00A7 7001) and UETA. All signers consented to use electronic ' +
      'signatures. Each signing event was logged with timestamps, IP addresses, and ' +
      'browser information for audit and compliance purposes.';

    // Word-wrap compliance text
    const maxLineWidth = pageWidth - 80;
    const words = complianceText.split(' ');
    let line = '';
    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      const textWidth = helvetica.widthOfTextAtSize(testLine, 10);
      if (textWidth > maxLineWidth && line) {
        page.drawText(line, { x: 40, y, size: 10, font: helvetica, color: rgb(0.25, 0.25, 0.25) });
        y -= 15;
        line = word;
      } else {
        line = testLine;
      }
    }
    if (line) {
      page.drawText(line, { x: 40, y, size: 10, font: helvetica, color: rgb(0.25, 0.25, 0.25) });
      y -= 15;
    }

    // ─── Footer ───
    const generatedDate = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
    page.drawText(`Generated by eDocSign on ${generatedDate}`, {
      x: 40,
      y: 30,
      size: 8,
      font: helvetica,
      color: rgb(0.6, 0.6, 0.6),
    });

    page.drawText(`Certificate ID: ${certificateId}`, {
      x: pageWidth - 250,
      y: 30,
      size: 8,
      font: helvetica,
      color: rgb(0.6, 0.6, 0.6),
    });

    // 8. Save certificate PDF to temp, then upload to S3
    const certBytes = await pdfDoc.save();
    const tempPath = path.join(os.tmpdir(), `${workflowId}_certificate.pdf`);
    fs.writeFileSync(tempPath, certBytes);

    const storageResult = await StorageService.store(tempPath, 'certificates', {
      workflowId,
    });

    fs.unlink(tempPath, () => {});

    const relativePath = storageResult.path;

    // 9. Store certificate_pdf_path in signing_workflows
    await DataService.query(
      'UPDATE signing_workflows SET certificate_pdf_path = $1 WHERE id = $2',
      [relativePath, workflowId]
    );

    // 10. Insert into signing_certificates table
    await DataService.query(
      `INSERT INTO signing_certificates (workflow_id, certificate_id, document_hash, pdf_path)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (certificate_id) DO UPDATE SET document_hash = $3, pdf_path = $4`,
      [workflowId, certificateId, documentHash, relativePath]
    );

    return relativePath;
  }
}

export default CertificateService;
