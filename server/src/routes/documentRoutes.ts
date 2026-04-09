import { Router, Response, RequestHandler } from 'express';
import { DocumentController } from '../controllers/documentController';
import { SigningController } from '../controllers/signingController';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { checkPlanLimit } from '../middleware/planLimits';
import { DocumentService } from '../services/documentService';
// @governance-tracked — API definitions added: POST /api/documents, GET /api/documents, GET /api/documents/:id, DELETE /api/documents/:id, GET /api/documents/:id/download
// @governance-tracked — EP-246 API definitions added: versions, templates, tags, search

/**
 * Document routes configuration.
 * API Definitions: tests/api_definitions/documents-upload.json
 */

const router: Router = Router();

// ===================== EXISTING ROUTES =====================

router.post('/', authenticateToken as RequestHandler, checkPlanLimit, upload.single('file') as RequestHandler, ((req: AuthenticatedRequest, res: Response): void => {
  DocumentController.upload(req, res);
}) as RequestHandler);

router.get('/', authenticateToken as RequestHandler, ((req: AuthenticatedRequest, res: Response): void => {
  DocumentController.getAll(req, res);
}) as RequestHandler);

// ===================== SEARCH (must be before /:id) =====================

router.get('/search', authenticateToken as RequestHandler, (async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ success: false, error: 'User not authenticated' });
      return;
    }
    const { q, tags, type, sort } = req.query as { q?: string; tags?: string; type?: string; sort?: string };
    const documents = await DocumentService.search(req.userId, { q, tags, type, sort });
    res.status(200).json({ success: true, data: { documents } });
  } catch (error: any) {
    console.error('Document search error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
}) as RequestHandler);

// ===================== TEMPLATES =====================

router.post('/templates', authenticateToken as RequestHandler, (async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ success: false, error: 'User not authenticated' });
      return;
    }
    const { name, description, file_path, document_id } = req.body;
    if (!name) {
      res.status(400).json({ success: false, error: 'Template name is required' });
      return;
    }

    let templateFilePath = file_path || '';

    // If document_id is provided, create template from existing document
    if (document_id) {
      const doc = await DocumentService.getById(document_id, req.userId);
      if (!doc) {
        res.status(404).json({ success: false, error: 'Source document not found' });
        return;
      }
      templateFilePath = doc.file_path;
    }

    if (!templateFilePath) {
      res.status(400).json({ success: false, error: 'Either file_path or document_id is required' });
      return;
    }

    const template = await DocumentService.createTemplate(req.userId, name, description || '', templateFilePath);
    res.status(201).json({ success: true, data: { template } });
  } catch (error: any) {
    console.error('Template creation error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
}) as RequestHandler);

router.get('/templates', authenticateToken as RequestHandler, (async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ success: false, error: 'User not authenticated' });
      return;
    }
    const templates = await DocumentService.getTemplates(req.userId);
    res.status(200).json({ success: true, data: { templates } });
  } catch (error: any) {
    console.error('Template list error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
}) as RequestHandler);

router.get('/templates/:id', authenticateToken as RequestHandler, (async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ success: false, error: 'User not authenticated' });
      return;
    }
    const template = await DocumentService.getTemplateById(req.params.id, req.userId);
    if (!template) {
      res.status(404).json({ success: false, error: 'Template not found' });
      return;
    }
    res.status(200).json({ success: true, data: { template } });
  } catch (error: any) {
    console.error('Template retrieval error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
}) as RequestHandler);

router.post('/templates/:id/use', authenticateToken as RequestHandler, (async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ success: false, error: 'User not authenticated' });
      return;
    }
    const template = await DocumentService.getTemplateById(req.params.id, req.userId);
    if (!template) {
      res.status(404).json({ success: false, error: 'Template not found' });
      return;
    }

    // Create a new document from the template's file_path
    const document = await DocumentService.upload(
      req.userId,
      template.file_path,
      template.name,
      '', // mime_type will be empty, but file_path points to existing S3/local file
      0
    );

    res.status(201).json({ success: true, data: { document } });
  } catch (error: any) {
    console.error('Template use error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
}) as RequestHandler);

router.delete('/templates/:id', authenticateToken as RequestHandler, (async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ success: false, error: 'User not authenticated' });
      return;
    }
    const deleted = await DocumentService.deleteTemplate(req.params.id, req.userId);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Template not found' });
      return;
    }
    res.status(200).json({ success: true, data: { message: 'Template deleted' } });
  } catch (error: any) {
    console.error('Template deletion error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
}) as RequestHandler);

// ===================== VERSIONS =====================

router.post('/:id/versions', authenticateToken as RequestHandler, upload.single('file') as RequestHandler, (async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ success: false, error: 'User not authenticated' });
      return;
    }

    const documentId = req.params.id;
    // Verify user owns the document
    const doc = await DocumentService.getById(documentId, req.userId);
    if (!doc) {
      res.status(404).json({ success: false, error: 'Document not found' });
      return;
    }

    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, error: 'File is required' });
      return;
    }

    const filePath = `/uploads/${file.filename}`;
    const version = await DocumentService.createVersion(documentId, req.userId, filePath, file.size);

    // Update the main document's file_path to the latest version
    const { DataService } = await import('../services/DataService');
    await DataService.query(
      'UPDATE documents SET file_path = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [filePath, documentId]
    );

    res.status(201).json({ success: true, data: { version } });
  } catch (error: any) {
    console.error('Version upload error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
}) as RequestHandler);

router.get('/:id/versions', authenticateToken as RequestHandler, (async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ success: false, error: 'User not authenticated' });
      return;
    }

    const documentId = req.params.id;
    const doc = await DocumentService.getById(documentId, req.userId);
    if (!doc) {
      res.status(404).json({ success: false, error: 'Document not found' });
      return;
    }

    const versions = await DocumentService.getVersions(documentId);
    res.status(200).json({ success: true, data: { versions } });
  } catch (error: any) {
    console.error('Version list error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
}) as RequestHandler);

router.post('/:id/versions/:versionId/revert', authenticateToken as RequestHandler, (async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ success: false, error: 'User not authenticated' });
      return;
    }

    const { id: documentId, versionId } = req.params;
    const doc = await DocumentService.getById(documentId, req.userId);
    if (!doc) {
      res.status(404).json({ success: false, error: 'Document not found' });
      return;
    }

    const version = await DocumentService.revertToVersion(documentId, versionId, req.userId);
    res.status(200).json({ success: true, data: { version } });
  } catch (error: any) {
    if (error.message === 'Version not found') {
      res.status(404).json({ success: false, error: 'Version not found' });
      return;
    }
    console.error('Version revert error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
}) as RequestHandler);

// ===================== TAGS =====================

router.post('/:id/tags', authenticateToken as RequestHandler, (async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ success: false, error: 'User not authenticated' });
      return;
    }

    const documentId = req.params.id;
    const doc = await DocumentService.getById(documentId, req.userId);
    if (!doc) {
      res.status(404).json({ success: false, error: 'Document not found' });
      return;
    }

    const { tags } = req.body;
    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      res.status(400).json({ success: false, error: 'Tags array is required' });
      return;
    }

    const addedTags = await DocumentService.addTags(documentId, tags);
    res.status(201).json({ success: true, data: { tags: addedTags } });
  } catch (error: any) {
    console.error('Tag addition error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
}) as RequestHandler);

router.get('/:id/tags', authenticateToken as RequestHandler, (async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ success: false, error: 'User not authenticated' });
      return;
    }

    const documentId = req.params.id;
    const doc = await DocumentService.getById(documentId, req.userId);
    if (!doc) {
      res.status(404).json({ success: false, error: 'Document not found' });
      return;
    }

    const tags = await DocumentService.getTags(documentId);
    res.status(200).json({ success: true, data: { tags } });
  } catch (error: any) {
    console.error('Tag retrieval error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
}) as RequestHandler);

router.delete('/:id/tags/:tag', authenticateToken as RequestHandler, (async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ success: false, error: 'User not authenticated' });
      return;
    }

    const { id: documentId, tag } = req.params;
    const doc = await DocumentService.getById(documentId, req.userId);
    if (!doc) {
      res.status(404).json({ success: false, error: 'Document not found' });
      return;
    }

    const removed = await DocumentService.removeTag(documentId, tag);
    if (!removed) {
      res.status(404).json({ success: false, error: 'Tag not found' });
      return;
    }

    res.status(200).json({ success: true, data: { message: 'Tag removed' } });
  } catch (error: any) {
    console.error('Tag removal error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
}) as RequestHandler);

// ===================== EXISTING ROUTES (param-based last) =====================

// Serve document file inline (for viewing in browser)
router.get('/:id/file', authenticateToken as RequestHandler, ((req: AuthenticatedRequest, res: Response): void => {
  SigningController.getAuthenticatedDocument(req, res);
}) as RequestHandler);

router.get('/:id/download', authenticateToken as RequestHandler, ((req: AuthenticatedRequest, res: Response): void => {
  DocumentController.download(req, res);
}) as RequestHandler);

router.get('/:id', authenticateToken as RequestHandler, ((req: AuthenticatedRequest, res: Response): void => {
  DocumentController.getById(req, res);
}) as RequestHandler);

router.delete('/:id', authenticateToken as RequestHandler, ((req: AuthenticatedRequest, res: Response): void => {
  DocumentController.deleteById(req, res);
}) as RequestHandler);

export default router;
