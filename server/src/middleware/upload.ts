import multer from 'multer';
import path from 'path';
import os from 'os';

/**
 * Multer stores files to a temporary directory. After upload, files are
 * immediately transferred to S3 and the local temp file is deleted.
 * Do NOT rely on files persisting in this directory.
 */
const tempDir = path.resolve(os.tmpdir(), 'edocs-uploads');

const storage: multer.StorageEngine = multer.diskStorage({
  destination: (_req, _file, cb) => {
    // Ensure temp dir exists
    const fs = require('fs');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    cb(null, tempDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix: string = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext: string = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

export const upload: multer.Multer = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes: string[] = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/plain',
      'image/png',
      'image/jpeg',
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: PDF, DOC, DOCX, XLSX, XLS, TXT, PNG, JPEG'));
    }
  },
});
