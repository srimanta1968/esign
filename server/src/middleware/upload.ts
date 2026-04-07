import multer from 'multer';
import path from 'path';

const storage: multer.StorageEngine = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.resolve(__dirname, '../../uploads'));
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
      'image/png',
      'image/jpeg',
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: PDF, DOC, DOCX, PNG, JPEG'));
    }
  },
});
