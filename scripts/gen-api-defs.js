#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'tests', 'api_definitions');
const SPRINT_ID = '729f9fe5-b963-4444-8b0e-f82bd555d110';

const TASK = {
  register:       '44dfef58-e7ca-4d89-81df-50b207d35dbb',
  login:          '9927c6cb-2af2-438a-b9cd-f7f35ff9e6a2',
  documentUpload: 'ad4ab56b-fb79-4d6e-9ab7-e598befdf828',
  documentGet:    '8c371718-3a8e-4a35-be90-adce095f36c6',
  signatureReq:   '2bee76ea-823d-4c9b-b6ed-312b00dc487e',
  signatureTrack: '8f7955e9-3755-446d-af1c-0aeb7d7e0d21',
  signatureCap:   'f2e996a5-6c35-4899-8965-d5fd4afad095',
  signatureRetr:  '0b78d714-656f-4111-b136-e7f1312bebe1',
};

const AUTH_HEADER = 'Bearer {{cache:auth.login.response.data.token}}';
const DOC_ID = '{{cache:documents.upload.response.data.id}}';
const WORKFLOW_ID = '{{cache:workflows.create.response.data.id}}';
const SIGNATURE_ID = '{{cache:signatures.create.response.data.id}}';
const USER_SIG_ID = '{{cache:userSignatures.create.response.data.id}}';
const TEAM_ID = '{{cache:teams.create.response.data.id}}';
const ORG_ID = '{{cache:organizations.create.response.data.id}}';
const TEMPLATE_ID = '{{cache:documentsTemplates.create.response.data.id}}';
const API_KEY_ID = '{{cache:authApiKeys.create.response.data.id}}';
const SESSION_ID = '{{cache:authSessions.create.response.data.id}}';
const SIGN_TOKEN = '{{cache:sign.context.response.data.token}}';
const ALERT_RULE_ID = '{{cache:complianceAlertsConfig.response.data.id}}';
const VERSION_ID = '{{cache:documentsVersions.create.response.data.id}}';
const INVITE_ID = '{{cache:teamsInvite.response.data.id}}';
const SIGNER_USER_ID = '{{cache:auth.login.response.data.userId}}';

const DEP_AUTH = ['POST /api/auth/register', 'POST /api/auth/login'];

// [filename, spec]
const defs = [
  // --- health ---
  ['health.json', {
    name: 'GET /health - Health check',
    endpoint: '/health', method: 'GET', requiresAuth: false, expectedStatus: 200,
    taskId: TASK.register, sprintId: SPRINT_ID,
    testCases: [{ name: 'Server is healthy', payload: {}, expectedStatus: 200 }],
    captureResponse: {}, dependsOn: []
  }],

  // --- auth ---
  ['auth-register.json', {
    name: 'POST /api/auth/register - User registration',
    endpoint: '/api/auth/register', method: 'POST', requiresAuth: false, expectedStatus: 201,
    taskId: TASK.register, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Register new user',
      payload: { email: 'user_{{timestamp}}@example.com', password: 'TestPass123!', name: 'Test User', role: 'user' },
      expectedStatus: 201
    }],
    captureResponse: {
      'auth.register.response.data.email': 'data.user.email',
      'auth.register.response.data.userId': 'data.user.id'
    },
    dependsOn: []
  }],
  ['auth-login.json', {
    name: 'POST /api/auth/login - User login',
    endpoint: '/api/auth/login', method: 'POST', requiresAuth: false, expectedStatus: 200,
    taskId: TASK.login, sprintId: SPRINT_ID,
    testCases: [
      { name: 'Login with valid credentials',
        payload: { email: '{{cache:auth.register.response.data.email}}', password: 'TestPass123!' },
        expectedStatus: 200 },
      { name: 'Login with invalid password',
        payload: { email: '{{cache:auth.register.response.data.email}}', password: 'WrongPassword' },
        expectedStatus: 401 }
    ],
    captureResponse: {
      'auth.login.response.data.token': 'data.token',
      'auth.login.response.data.userId': 'data.user.id'
    },
    dependsOn: ['POST /api/auth/register']
  }],
  ['auth-verify-email.json', {
    name: 'POST /api/auth/verify-email - Verify email',
    endpoint: '/api/auth/verify-email', method: 'POST', requiresAuth: false, expectedStatus: 200,
    taskId: TASK.register, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Verify with code',
      payload: { email: '{{cache:auth.register.response.data.email}}', code: '123456' },
      expectedStatus: 400
    }],
    captureResponse: {}, dependsOn: ['POST /api/auth/register']
  }],
  ['auth-resend-verification.json', {
    name: 'POST /api/auth/resend-verification - Resend verification',
    endpoint: '/api/auth/resend-verification', method: 'POST', requiresAuth: false, expectedStatus: 200,
    taskId: TASK.register, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Resend verification code',
      payload: { email: '{{cache:auth.register.response.data.email}}' },
      expectedStatus: 200
    }],
    captureResponse: {}, dependsOn: ['POST /api/auth/register']
  }],
  ['auth-forgot-password.json', {
    name: 'POST /api/auth/forgot-password - Initiate password reset',
    endpoint: '/api/auth/forgot-password', method: 'POST', requiresAuth: false, expectedStatus: 200,
    taskId: TASK.register, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Request reset',
      payload: { email: '{{cache:auth.register.response.data.email}}' },
      expectedStatus: 200
    }],
    captureResponse: {}, dependsOn: ['POST /api/auth/register']
  }],
  ['auth-reset-password.json', {
    name: 'POST /api/auth/reset-password - Reset password',
    endpoint: '/api/auth/reset-password', method: 'POST', requiresAuth: false, expectedStatus: 400,
    taskId: TASK.register, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Reset with invalid code',
      payload: { email: '{{cache:auth.register.response.data.email}}', code: '000000', password: 'NewPass123!' },
      expectedStatus: 400
    }],
    captureResponse: {}, dependsOn: ['POST /api/auth/register']
  }],
  ['auth-sso-redirect.json', {
    name: 'GET /api/auth/sso/:provider - SSO redirect',
    endpoint: '/api/auth/sso/google', method: 'GET', requiresAuth: false, expectedStatus: 302,
    taskId: TASK.login, sprintId: SPRINT_ID,
    testCases: [{ name: 'Redirect to SSO provider', payload: {}, expectedStatus: 302 }],
    captureResponse: {}, dependsOn: []
  }],
  ['auth-sso-callback.json', {
    name: 'GET /api/auth/sso/callback - SSO callback',
    endpoint: '/api/auth/sso/callback', method: 'GET', requiresAuth: false, expectedStatus: 400,
    taskId: TASK.login, sprintId: SPRINT_ID,
    testCases: [{ name: 'Callback without code', payload: {}, expectedStatus: 400 }],
    captureResponse: {}, dependsOn: []
  }],
  ['auth-refresh-token.json', {
    name: 'POST /api/auth/refresh-token - Refresh token',
    endpoint: '/api/auth/refresh-token', method: 'POST', requiresAuth: false, expectedStatus: 200,
    taskId: TASK.login, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Refresh with valid token',
      payload: { refreshToken: '{{cache:auth.login.response.data.token}}' },
      expectedStatus: 200
    }],
    captureResponse: {}, dependsOn: DEP_AUTH
  }],
  ['auth-me.json', {
    name: 'GET /api/auth/me - Current user',
    endpoint: '/api/auth/me', method: 'GET', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.login, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Get current user',
      payload: {}, expectedStatus: 200,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: DEP_AUTH
  }],
  ['auth-profile-get.json', {
    name: 'GET /api/auth/profile - Get profile',
    endpoint: '/api/auth/profile', method: 'GET', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.login, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Get user profile',
      payload: {}, expectedStatus: 200,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: DEP_AUTH
  }],
  ['auth-profile-update.json', {
    name: 'PUT /api/auth/profile - Update profile',
    endpoint: '/api/auth/profile', method: 'PUT', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.login, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Update profile',
      payload: { name: 'Updated Name', language: 'en' },
      expectedStatus: 200,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: DEP_AUTH
  }],
  ['auth-api-keys-create.json', {
    name: 'POST /api/auth/api-keys - Create API key',
    endpoint: '/api/auth/api-keys', method: 'POST', requiresAuth: true, expectedStatus: 201,
    taskId: TASK.login, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Create API key',
      payload: { label: 'Test Key' },
      expectedStatus: 201,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: { 'authApiKeys.create.response.data.id': 'data.prefix' },
    dependsOn: DEP_AUTH
  }],
  ['auth-api-keys-list.json', {
    name: 'GET /api/auth/api-keys - List API keys',
    endpoint: '/api/auth/api-keys', method: 'GET', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.login, sprintId: SPRINT_ID,
    testCases: [{
      name: 'List API keys',
      payload: {}, expectedStatus: 200,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: [...DEP_AUTH, 'POST /api/auth/api-keys']
  }],
  ['auth-api-keys-revoke.json', {
    name: 'DELETE /api/auth/api-keys/:id - Revoke API key',
    endpoint: `/api/auth/api-keys/${API_KEY_ID}`, method: 'DELETE', requiresAuth: true, expectedStatus: 404,
    taskId: TASK.login, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Revoke non-existent key',
      payload: {}, expectedStatus: 404,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: DEP_AUTH
  }],
  ['auth-sessions-list.json', {
    name: 'GET /api/auth/sessions - List sessions',
    endpoint: '/api/auth/sessions', method: 'GET', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.login, sprintId: SPRINT_ID,
    testCases: [{
      name: 'List active sessions',
      payload: {}, expectedStatus: 200,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: DEP_AUTH
  }],
  ['auth-sessions-revoke.json', {
    name: 'DELETE /api/auth/sessions/:id - Revoke session',
    endpoint: `/api/auth/sessions/00000000-0000-0000-0000-000000000000`,
    method: 'DELETE', requiresAuth: true, expectedStatus: 404,
    taskId: TASK.login, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Revoke non-existent session',
      payload: {}, expectedStatus: 404,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: DEP_AUTH
  }],

  // --- documents ---
  ['documents-upload.json', {
    name: 'POST /api/documents - Upload document',
    endpoint: '/api/documents', method: 'POST', requiresAuth: true, expectedStatus: 201,
    taskId: TASK.documentUpload, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Upload a document',
      payload: { file_path: 'uploads/test-{{timestamp}}.pdf', mime_type: 'application/pdf', original_name: 'test.pdf' },
      expectedStatus: 201,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: { 'documents.upload.response.data.id': 'data.id' },
    dependsOn: DEP_AUTH
  }],
  ['documents-list.json', {
    name: 'GET /api/documents - List documents',
    endpoint: '/api/documents', method: 'GET', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.documentGet, sprintId: SPRINT_ID,
    testCases: [{
      name: 'List documents',
      payload: {}, expectedStatus: 200,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: DEP_AUTH
  }],
  ['documents-search.json', {
    name: 'GET /api/documents/search - Search documents',
    endpoint: '/api/documents/search?q=test', method: 'GET', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.documentGet, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Search documents',
      payload: {}, expectedStatus: 200,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: DEP_AUTH
  }],
  ['documents-get.json', {
    name: 'GET /api/documents/:id - Get document',
    endpoint: `/api/documents/${DOC_ID}`, method: 'GET', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.documentGet, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Get document details',
      payload: {}, expectedStatus: 200,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: [...DEP_AUTH, 'POST /api/documents']
  }],
  ['documents-file.json', {
    name: 'GET /api/documents/:id/file - Serve document file',
    endpoint: `/api/documents/${DOC_ID}/file`, method: 'GET', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.documentGet, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Serve document file inline',
      payload: {}, expectedStatus: 200,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: [...DEP_AUTH, 'POST /api/documents']
  }],
  ['documents-download.json', {
    name: 'GET /api/documents/:id/download - Download document',
    endpoint: `/api/documents/${DOC_ID}/download`, method: 'GET', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.documentGet, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Download document',
      payload: {}, expectedStatus: 200,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: [...DEP_AUTH, 'POST /api/documents']
  }],
  ['documents-delete.json', {
    name: 'DELETE /api/documents/:id - Delete document',
    endpoint: `/api/documents/${DOC_ID}`, method: 'DELETE', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.documentGet, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Delete document',
      payload: {}, expectedStatus: 200,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: [...DEP_AUTH, 'POST /api/documents']
  }],
  ['documents-templates-create.json', {
    name: 'POST /api/documents/templates - Create template',
    endpoint: '/api/documents/templates', method: 'POST', requiresAuth: true, expectedStatus: 201,
    taskId: TASK.documentUpload, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Create template from document',
      payload: { name: 'Test Template', description: 'Template desc', document_id: DOC_ID },
      expectedStatus: 201,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: { 'documentsTemplates.create.response.data.id': 'data.id' },
    dependsOn: [...DEP_AUTH, 'POST /api/documents']
  }],
  ['documents-templates-list.json', {
    name: 'GET /api/documents/templates - List templates',
    endpoint: '/api/documents/templates', method: 'GET', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.documentGet, sprintId: SPRINT_ID,
    testCases: [{
      name: 'List templates',
      payload: {}, expectedStatus: 200,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: DEP_AUTH
  }],
  ['documents-templates-get.json', {
    name: 'GET /api/documents/templates/:id - Get template',
    endpoint: `/api/documents/templates/${TEMPLATE_ID}`, method: 'GET', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.documentGet, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Get template',
      payload: {}, expectedStatus: 200,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: [...DEP_AUTH, 'POST /api/documents/templates']
  }],
  ['documents-templates-use.json', {
    name: 'POST /api/documents/templates/:id/use - Use template',
    endpoint: `/api/documents/templates/${TEMPLATE_ID}/use`, method: 'POST', requiresAuth: true, expectedStatus: 201,
    taskId: TASK.documentUpload, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Create document from template',
      payload: {}, expectedStatus: 201,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: [...DEP_AUTH, 'POST /api/documents/templates']
  }],
  ['documents-templates-delete.json', {
    name: 'DELETE /api/documents/templates/:id - Delete template',
    endpoint: `/api/documents/templates/${TEMPLATE_ID}`, method: 'DELETE', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.documentGet, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Delete template',
      payload: {}, expectedStatus: 200,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: [...DEP_AUTH, 'POST /api/documents/templates']
  }],
  ['documents-versions-create.json', {
    name: 'POST /api/documents/:id/versions - Create version',
    endpoint: `/api/documents/${DOC_ID}/versions`, method: 'POST', requiresAuth: true, expectedStatus: 201,
    taskId: TASK.documentUpload, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Upload new version',
      payload: { file_path: 'uploads/v2-{{timestamp}}.pdf' },
      expectedStatus: 201,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: { 'documentsVersions.create.response.data.id': 'data.id' },
    dependsOn: [...DEP_AUTH, 'POST /api/documents']
  }],
  ['documents-versions-list.json', {
    name: 'GET /api/documents/:id/versions - List versions',
    endpoint: `/api/documents/${DOC_ID}/versions`, method: 'GET', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.documentGet, sprintId: SPRINT_ID,
    testCases: [{
      name: 'List versions',
      payload: {}, expectedStatus: 200,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: [...DEP_AUTH, 'POST /api/documents']
  }],
  ['documents-versions-revert.json', {
    name: 'POST /api/documents/:id/versions/:versionId/revert - Revert version',
    endpoint: `/api/documents/${DOC_ID}/versions/${VERSION_ID}/revert`,
    method: 'POST', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.documentUpload, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Revert to prior version',
      payload: {}, expectedStatus: 200,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {},
    dependsOn: [...DEP_AUTH, 'POST /api/documents', 'POST /api/documents/:id/versions']
  }],
  ['documents-tags-add.json', {
    name: 'POST /api/documents/:id/tags - Add tags',
    endpoint: `/api/documents/${DOC_ID}/tags`, method: 'POST', requiresAuth: true, expectedStatus: 201,
    taskId: TASK.documentUpload, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Add tag to document',
      payload: { tags: ['contract', 'legal'] },
      expectedStatus: 201,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: [...DEP_AUTH, 'POST /api/documents']
  }],
  ['documents-tags-list.json', {
    name: 'GET /api/documents/:id/tags - List tags',
    endpoint: `/api/documents/${DOC_ID}/tags`, method: 'GET', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.documentGet, sprintId: SPRINT_ID,
    testCases: [{
      name: 'List document tags',
      payload: {}, expectedStatus: 200,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: [...DEP_AUTH, 'POST /api/documents']
  }],
  ['documents-tags-remove.json', {
    name: 'DELETE /api/documents/:id/tags/:tag - Remove tag',
    endpoint: `/api/documents/${DOC_ID}/tags/contract`, method: 'DELETE', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.documentUpload, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Remove tag from document',
      payload: {}, expectedStatus: 200,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {},
    dependsOn: [...DEP_AUTH, 'POST /api/documents', 'POST /api/documents/:id/tags']
  }],

  // --- signatures ---
  ['signatures-create.json', {
    name: 'POST /api/signatures - Create signature request',
    endpoint: '/api/signatures', method: 'POST', requiresAuth: true, expectedStatus: 201,
    taskId: TASK.signatureReq, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Create signature request',
      payload: { document_id: DOC_ID, signer_email: 'signer_{{timestamp}}@example.com' },
      expectedStatus: 201,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: { 'signatures.create.response.data.id': 'data.id' },
    dependsOn: [...DEP_AUTH, 'POST /api/documents']
  }],
  ['signatures-by-document.json', {
    name: 'GET /api/signatures/:documentId - List signatures for document',
    endpoint: `/api/signatures/${DOC_ID}`, method: 'GET', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.signatureTrack, sprintId: SPRINT_ID,
    testCases: [{
      name: 'List signatures for document',
      payload: {}, expectedStatus: 200,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: [...DEP_AUTH, 'POST /api/documents']
  }],
  ['signatures-sign.json', {
    name: 'PATCH /api/signatures/:id/sign - Sign document',
    endpoint: `/api/signatures/${SIGNATURE_ID}/sign`, method: 'PATCH', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.signatureCap, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Sign with user signature',
      payload: { user_signature_id: USER_SIG_ID },
      expectedStatus: 200,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {},
    dependsOn: [...DEP_AUTH, 'POST /api/signatures', 'POST /api/user-signatures']
  }],
  ['signatures-confirm.json', {
    name: 'POST /api/signatures/:id/confirm - Confirm signature',
    endpoint: `/api/signatures/${SIGNATURE_ID}/confirm`, method: 'POST', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.signatureCap, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Confirm signature',
      payload: { confirmation_token: 'test-token' },
      expectedStatus: 400,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {},
    dependsOn: [...DEP_AUTH, 'POST /api/signatures']
  }],

  // --- user-signatures ---
  ['user-signatures-create.json', {
    name: 'POST /api/user-signatures - Create user signature',
    endpoint: '/api/user-signatures', method: 'POST', requiresAuth: true, expectedStatus: 201,
    taskId: TASK.signatureCap, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Create typed signature',
      payload: {
        signature_type: 'typed',
        input_method: 'typed',
        signature_data: 'Test User',
        font_family: 'Dancing Script'
      },
      expectedStatus: 201,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: { 'userSignatures.create.response.data.id': 'data.id' },
    dependsOn: DEP_AUTH
  }],
  ['user-signatures-list.json', {
    name: 'GET /api/user-signatures - List user signatures',
    endpoint: '/api/user-signatures', method: 'GET', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.signatureRetr, sprintId: SPRINT_ID,
    testCases: [{
      name: 'List user signatures',
      payload: {}, expectedStatus: 200,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: DEP_AUTH
  }],
  ['user-signatures-get.json', {
    name: 'GET /api/user-signatures/:id - Get user signature',
    endpoint: `/api/user-signatures/${USER_SIG_ID}`, method: 'GET', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.signatureRetr, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Get user signature',
      payload: {}, expectedStatus: 200,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: [...DEP_AUTH, 'POST /api/user-signatures']
  }],
  ['user-signatures-update.json', {
    name: 'PUT /api/user-signatures/:id - Update user signature',
    endpoint: `/api/user-signatures/${USER_SIG_ID}`, method: 'PUT', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.signatureCap, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Update user signature',
      payload: { signature_data: 'Updated Name' },
      expectedStatus: 200,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: [...DEP_AUTH, 'POST /api/user-signatures']
  }],
  ['user-signatures-delete.json', {
    name: 'DELETE /api/user-signatures/:id - Delete user signature',
    endpoint: `/api/user-signatures/${USER_SIG_ID}`, method: 'DELETE', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.signatureCap, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Delete user signature',
      payload: {}, expectedStatus: 200,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: [...DEP_AUTH, 'POST /api/user-signatures']
  }],

  // --- notifications ---
  ['notifications-list.json', {
    name: 'GET /api/notifications - List notifications',
    endpoint: '/api/notifications', method: 'GET', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.signatureTrack, sprintId: SPRINT_ID,
    testCases: [{
      name: 'List notifications',
      payload: {}, expectedStatus: 200,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: DEP_AUTH
  }],
  ['notifications-mark-read.json', {
    name: 'PATCH /api/notifications/read - Mark as read',
    endpoint: '/api/notifications/read', method: 'PATCH', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.signatureTrack, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Mark all notifications as read',
      payload: {}, expectedStatus: 200,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: DEP_AUTH
  }],
  ['notifications-send.json', {
    name: 'POST /api/notifications/send - Send notification',
    endpoint: '/api/notifications/send', method: 'POST', requiresAuth: true, expectedStatus: 201,
    taskId: TASK.signatureTrack, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Send notification',
      payload: {
        userId: SIGNER_USER_ID, type: 'info', message: 'Test message',
        channels: ['in_app'], actionUrl: '/test'
      },
      expectedStatus: 201,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: DEP_AUTH
  }],
  ['notifications-stream.json', {
    name: 'GET /api/notifications/stream - SSE stream',
    endpoint: '/api/notifications/stream', method: 'GET', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.signatureTrack, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Open SSE stream',
      payload: {}, expectedStatus: 200,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: DEP_AUTH
  }],
  ['notifications-preferences-get.json', {
    name: 'GET /api/notifications/preferences - Get preferences',
    endpoint: '/api/notifications/preferences', method: 'GET', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.signatureTrack, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Get notification prefs',
      payload: {}, expectedStatus: 200,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: DEP_AUTH
  }],
  ['notifications-preferences-update.json', {
    name: 'PUT /api/notifications/preferences - Update preferences',
    endpoint: '/api/notifications/preferences', method: 'PUT', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.signatureTrack, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Update notification prefs',
      payload: { email_enabled: true, in_app_enabled: true },
      expectedStatus: 200,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: DEP_AUTH
  }],

  // --- users ---
  ['users-roles.json', {
    name: 'GET /api/users/roles - List roles',
    endpoint: '/api/users/roles', method: 'GET', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.register, sprintId: SPRINT_ID,
    testCases: [{
      name: 'List roles (admin only)',
      payload: {}, expectedStatus: 403,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: DEP_AUTH
  }],
  ['users-list.json', {
    name: 'GET /api/users - List users',
    endpoint: '/api/users', method: 'GET', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.register, sprintId: SPRINT_ID,
    testCases: [{
      name: 'List users (admin only)',
      payload: {}, expectedStatus: 403,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: DEP_AUTH
  }],
  ['users-assign-role.json', {
    name: 'PUT /api/users/:id/role - Assign role',
    endpoint: `/api/users/${SIGNER_USER_ID}/role`, method: 'PUT', requiresAuth: true, expectedStatus: 403,
    taskId: TASK.register, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Assign role (admin only)',
      payload: { role: 'user' },
      expectedStatus: 403,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: DEP_AUTH
  }],
  ['users-language.json', {
    name: 'PUT /api/users/language - Update language',
    endpoint: '/api/users/language', method: 'PUT', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.login, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Update language preference',
      payload: { language: 'en' },
      expectedStatus: 200,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: DEP_AUTH
  }],

  // --- organizations ---
  ['organizations-create.json', {
    name: 'POST /api/organizations - Create organization',
    endpoint: '/api/organizations', method: 'POST', requiresAuth: true, expectedStatus: 201,
    taskId: TASK.register, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Create organization',
      payload: { name: 'Org {{timestamp}}' },
      expectedStatus: 201,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: { 'organizations.create.response.data.id': 'data.id' },
    dependsOn: DEP_AUTH
  }],
  ['organizations-get.json', {
    name: 'GET /api/organizations/:id - Get organization',
    endpoint: `/api/organizations/${ORG_ID}`, method: 'GET', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.register, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Get organization',
      payload: {}, expectedStatus: 200,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: [...DEP_AUTH, 'POST /api/organizations']
  }],

  // --- workflows ---
  ['workflows-create.json', {
    name: 'POST /api/workflows - Create workflow',
    endpoint: '/api/workflows', method: 'POST', requiresAuth: true, expectedStatus: 201,
    taskId: TASK.signatureReq, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Create signing workflow',
      payload: {
        document_id: DOC_ID,
        workflow_type: 'sequential',
        recipients: [{ signer_email: 'a_{{timestamp}}@example.com', signer_name: 'Signer A', signing_order: 1, role: 'signer' }],
        signature_fields: []
      },
      expectedStatus: 201,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: { 'workflows.create.response.data.id': 'data.workflow.id' },
    dependsOn: [...DEP_AUTH, 'POST /api/documents']
  }],
  ['workflows-list.json', {
    name: 'GET /api/workflows - List workflows',
    endpoint: '/api/workflows', method: 'GET', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.signatureTrack, sprintId: SPRINT_ID,
    testCases: [{
      name: 'List workflows',
      payload: {}, expectedStatus: 200,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: DEP_AUTH
  }],
  ['workflows-admin-process-completions.json', {
    name: 'POST /api/workflows/admin/process-completions - Process completions',
    endpoint: '/api/workflows/admin/process-completions', method: 'POST', requiresAuth: true, expectedStatus: 403,
    taskId: TASK.signatureTrack, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Process completions (admin only)',
      payload: {}, expectedStatus: 403,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: DEP_AUTH
  }],
  ['workflows-get.json', {
    name: 'GET /api/workflows/:id - Get workflow',
    endpoint: `/api/workflows/${WORKFLOW_ID}`, method: 'GET', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.signatureTrack, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Get workflow',
      payload: {}, expectedStatus: 200,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: [...DEP_AUTH, 'POST /api/workflows']
  }],
  ['workflows-update.json', {
    name: 'PUT /api/workflows/:id - Update workflow',
    endpoint: `/api/workflows/${WORKFLOW_ID}`, method: 'PUT', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.signatureReq, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Update workflow',
      payload: { recipients: [], fields: [] },
      expectedStatus: 200,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: [...DEP_AUTH, 'POST /api/workflows']
  }],
  ['workflows-start.json', {
    name: 'POST /api/workflows/:id/start - Start workflow',
    endpoint: `/api/workflows/${WORKFLOW_ID}/start`, method: 'POST', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.signatureReq, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Start signing workflow',
      payload: {}, expectedStatus: 200,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: [...DEP_AUTH, 'POST /api/workflows']
  }],
  ['workflows-cancel.json', {
    name: 'POST /api/workflows/:id/cancel - Cancel workflow',
    endpoint: `/api/workflows/${WORKFLOW_ID}/cancel`, method: 'POST', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.signatureReq, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Cancel workflow',
      payload: {}, expectedStatus: 200,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: [...DEP_AUTH, 'POST /api/workflows']
  }],
  ['workflows-sign.json', {
    name: 'PATCH /api/workflows/:id/sign - Sign workflow',
    endpoint: `/api/workflows/${WORKFLOW_ID}/sign`, method: 'PATCH', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.signatureCap, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Sign workflow',
      payload: {}, expectedStatus: 200,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: [...DEP_AUTH, 'POST /api/workflows']
  }],
  ['workflows-decline.json', {
    name: 'PATCH /api/workflows/:id/decline - Decline workflow',
    endpoint: `/api/workflows/${WORKFLOW_ID}/decline`, method: 'PATCH', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.signatureCap, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Decline workflow',
      payload: {}, expectedStatus: 200,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: [...DEP_AUTH, 'POST /api/workflows']
  }],
  ['workflows-status.json', {
    name: 'GET /api/workflows/:id/status - Workflow status',
    endpoint: `/api/workflows/${WORKFLOW_ID}/status`, method: 'GET', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.signatureTrack, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Get workflow status',
      payload: {}, expectedStatus: 200,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: [...DEP_AUTH, 'POST /api/workflows']
  }],
  ['workflows-remind.json', {
    name: 'POST /api/workflows/:id/remind - Send reminders',
    endpoint: `/api/workflows/${WORKFLOW_ID}/remind`, method: 'POST', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.signatureReq, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Send signing reminders',
      payload: {}, expectedStatus: 200,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: [...DEP_AUTH, 'POST /api/workflows']
  }],
  ['workflows-reminders-configure.json', {
    name: 'PUT /api/workflows/:id/reminders - Configure reminders',
    endpoint: `/api/workflows/${WORKFLOW_ID}/reminders`, method: 'PUT', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.signatureReq, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Configure reminder settings',
      payload: { enabled: true, interval_hours: 24 },
      expectedStatus: 200,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: [...DEP_AUTH, 'POST /api/workflows']
  }],
  ['workflows-history.json', {
    name: 'GET /api/workflows/:id/history - History',
    endpoint: `/api/workflows/${WORKFLOW_ID}/history`, method: 'GET', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.signatureTrack, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Get workflow history',
      payload: {}, expectedStatus: 200,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: [...DEP_AUTH, 'POST /api/workflows']
  }],
  ['workflows-history-export.json', {
    name: 'GET /api/workflows/:id/history/export - Export history',
    endpoint: `/api/workflows/${WORKFLOW_ID}/history/export?format=csv`, method: 'GET', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.signatureTrack, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Export history as CSV',
      payload: {}, expectedStatus: 200,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: [...DEP_AUTH, 'POST /api/workflows']
  }],
  ['workflows-downloads.json', {
    name: 'GET /api/workflows/:id/downloads - Download signed docs',
    endpoint: `/api/workflows/${WORKFLOW_ID}/downloads`, method: 'GET', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.signatureTrack, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Get signed documents',
      payload: {}, expectedStatus: 200,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: [...DEP_AUTH, 'POST /api/workflows']
  }],
  ['workflows-self-sign.json', {
    name: 'POST /api/workflows/:id/self-sign - Self-sign',
    endpoint: `/api/workflows/${WORKFLOW_ID}/self-sign`, method: 'POST', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.signatureCap, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Self-sign workflow',
      payload: {}, expectedStatus: 200,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: [...DEP_AUTH, 'POST /api/workflows']
  }],

  // --- audit-logs ---
  ['audit-logs-search.json', {
    name: 'GET /api/audit-logs - Search audit logs',
    endpoint: '/api/audit-logs', method: 'GET', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.signatureTrack, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Search audit logs (admin)',
      payload: {}, expectedStatus: 403,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: DEP_AUTH
  }],

  // --- compliance ---
  ['compliance-report.json', {
    name: 'GET /api/compliance/report - Compliance report',
    endpoint: '/api/compliance/report', method: 'GET', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.signatureTrack, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Generate compliance report (admin)',
      payload: {}, expectedStatus: 403,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: DEP_AUTH
  }],
  ['compliance-alerts-config.json', {
    name: 'POST /api/compliance/alerts/config - Configure alerts',
    endpoint: '/api/compliance/alerts/config', method: 'POST', requiresAuth: true, expectedStatus: 201,
    taskId: TASK.signatureTrack, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Configure alert (admin)',
      payload: { rule_type: 'failed_login', threshold: 5, enabled: true },
      expectedStatus: 403,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: { 'complianceAlertsConfig.response.data.id': 'data.id' },
    dependsOn: DEP_AUTH
  }],
  ['compliance-alerts-list.json', {
    name: 'GET /api/compliance/alerts - List alerts',
    endpoint: '/api/compliance/alerts', method: 'GET', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.signatureTrack, sprintId: SPRINT_ID,
    testCases: [{
      name: 'List alerts (admin)',
      payload: {}, expectedStatus: 403,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: DEP_AUTH
  }],
  ['compliance-export.json', {
    name: 'GET /api/compliance/export - Export audit logs',
    endpoint: '/api/compliance/export', method: 'GET', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.signatureTrack, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Export logs (admin)',
      payload: {}, expectedStatus: 403,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: DEP_AUTH
  }],
  ['compliance-esign-metadata-get.json', {
    name: 'GET /api/compliance/esign-metadata/:signatureId - Get metadata',
    endpoint: `/api/compliance/esign-metadata/${SIGNATURE_ID}`, method: 'GET', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.signatureTrack, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Get ESIGN metadata',
      payload: {}, expectedStatus: 200,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: [...DEP_AUTH, 'POST /api/signatures']
  }],
  ['compliance-esign-metadata-create.json', {
    name: 'POST /api/compliance/esign-metadata - Create metadata',
    endpoint: '/api/compliance/esign-metadata', method: 'POST', requiresAuth: true, expectedStatus: 201,
    taskId: TASK.signatureCap, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Create ESIGN metadata',
      payload: { signature_id: SIGNATURE_ID, consent_given: true },
      expectedStatus: 201,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: [...DEP_AUTH, 'POST /api/signatures']
  }],

  // --- analytics ---
  ['analytics-signature-event.json', {
    name: 'POST /api/analytics/signature-event - Track event',
    endpoint: '/api/analytics/signature-event', method: 'POST', requiresAuth: true, expectedStatus: 201,
    taskId: TASK.signatureTrack, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Track signature event',
      payload: { event_type: 'viewed', metadata: { source: 'test' } },
      expectedStatus: 201,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: DEP_AUTH
  }],

  // --- sign (public signing portal) ---
  ['sign-context.json', {
    name: 'GET /api/sign/:token - Get signing context',
    endpoint: '/api/sign/invalid-token', method: 'GET', requiresAuth: false, expectedStatus: 404,
    taskId: TASK.signatureCap, sprintId: SPRINT_ID,
    testCases: [{ name: 'Invalid signing token', payload: {}, expectedStatus: 404 }],
    captureResponse: {}, dependsOn: []
  }],
  ['sign-document.json', {
    name: 'GET /api/sign/:token/document - Get document for signing',
    endpoint: '/api/sign/invalid-token/document', method: 'GET', requiresAuth: false, expectedStatus: 404,
    taskId: TASK.signatureCap, sprintId: SPRINT_ID,
    testCases: [{ name: 'Invalid signing token', payload: {}, expectedStatus: 404 }],
    captureResponse: {}, dependsOn: []
  }],
  ['sign-started.json', {
    name: 'POST /api/sign/:token/started - Mark started',
    endpoint: '/api/sign/invalid-token/started', method: 'POST', requiresAuth: false, expectedStatus: 404,
    taskId: TASK.signatureCap, sprintId: SPRINT_ID,
    testCases: [{ name: 'Invalid signing token', payload: {}, expectedStatus: 404 }],
    captureResponse: {}, dependsOn: []
  }],
  ['sign-complete.json', {
    name: 'POST /api/sign/:token/complete - Complete signing',
    endpoint: '/api/sign/invalid-token/complete', method: 'POST', requiresAuth: false, expectedStatus: 404,
    taskId: TASK.signatureCap, sprintId: SPRINT_ID,
    testCases: [{ name: 'Invalid signing token', payload: { signatures: [] }, expectedStatus: 404 }],
    captureResponse: {}, dependsOn: []
  }],

  // --- billing ---
  ['billing-checkout.json', {
    name: 'POST /api/billing/checkout - Create checkout session',
    endpoint: '/api/billing/checkout', method: 'POST', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.register, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Create Stripe checkout',
      payload: { plan: 'pro', interval: 'monthly' },
      expectedStatus: 200,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: DEP_AUTH
  }],
  ['billing-portal.json', {
    name: 'POST /api/billing/portal - Open customer portal',
    endpoint: '/api/billing/portal', method: 'POST', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.register, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Open customer portal',
      payload: {}, expectedStatus: 200,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: DEP_AUTH
  }],
  ['billing-subscription.json', {
    name: 'GET /api/billing/subscription - Get subscription',
    endpoint: '/api/billing/subscription', method: 'GET', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.register, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Get subscription',
      payload: {}, expectedStatus: 200,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: DEP_AUTH
  }],
  ['billing-webhook.json', {
    name: 'POST /api/billing/webhook - Stripe webhook',
    endpoint: '/api/billing/webhook', method: 'POST', requiresAuth: false, expectedStatus: 400,
    taskId: TASK.register, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Webhook without signature',
      payload: {}, expectedStatus: 400
    }],
    captureResponse: {}, dependsOn: []
  }],

  // --- teams ---
  ['teams-create.json', {
    name: 'POST /api/teams - Create team',
    endpoint: '/api/teams', method: 'POST', requiresAuth: true, expectedStatus: 201,
    taskId: TASK.register, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Create team',
      payload: { name: 'Team {{timestamp}}', plan: 'free' },
      expectedStatus: 201,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: { 'teams.create.response.data.id': 'data.team.id' },
    dependsOn: DEP_AUTH
  }],
  ['teams-mine.json', {
    name: 'GET /api/teams/mine - Get my team',
    endpoint: '/api/teams/mine', method: 'GET', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.register, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Get current team',
      payload: {}, expectedStatus: 200,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: DEP_AUTH
  }],
  ['teams-join-info.json', {
    name: 'GET /api/teams/join/:token - Get invite info',
    endpoint: '/api/teams/join/invalid-token', method: 'GET', requiresAuth: false, expectedStatus: 404,
    taskId: TASK.register, sprintId: SPRINT_ID,
    testCases: [{ name: 'Invalid invite token', payload: {}, expectedStatus: 404 }],
    captureResponse: {}, dependsOn: []
  }],
  ['teams-join-accept.json', {
    name: 'POST /api/teams/join/:token - Accept invite',
    endpoint: '/api/teams/join/invalid-token', method: 'POST', requiresAuth: true, expectedStatus: 404,
    taskId: TASK.register, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Accept invalid invite',
      payload: {}, expectedStatus: 404,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: DEP_AUTH
  }],
  ['teams-get.json', {
    name: 'GET /api/teams/:id - Get team',
    endpoint: `/api/teams/${TEAM_ID}`, method: 'GET', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.register, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Get team details',
      payload: {}, expectedStatus: 200,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: [...DEP_AUTH, 'POST /api/teams']
  }],
  ['teams-invite.json', {
    name: 'POST /api/teams/:id/invite - Invite members',
    endpoint: `/api/teams/${TEAM_ID}/invite`, method: 'POST', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.register, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Invite members',
      payload: { emails: ['invitee_{{timestamp}}@example.com'] },
      expectedStatus: 200,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: { 'teamsInvite.response.data.id': 'data.invites.0.id' },
    dependsOn: [...DEP_AUTH, 'POST /api/teams']
  }],
  ['teams-invite-delete.json', {
    name: 'DELETE /api/teams/:id/invites/:inviteId - Delete invite',
    endpoint: `/api/teams/${TEAM_ID}/invites/${INVITE_ID}`, method: 'DELETE', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.register, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Delete pending invite',
      payload: {}, expectedStatus: 200,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {},
    dependsOn: [...DEP_AUTH, 'POST /api/teams', 'POST /api/teams/:id/invite']
  }],
  ['teams-member-remove.json', {
    name: 'DELETE /api/teams/:id/members/:userId - Remove member',
    endpoint: `/api/teams/${TEAM_ID}/members/${SIGNER_USER_ID}`, method: 'DELETE', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.register, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Remove team member',
      payload: {}, expectedStatus: 404,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: [...DEP_AUTH, 'POST /api/teams']
  }],
  ['teams-member-update-role.json', {
    name: 'PATCH /api/teams/:id/members/:userId - Update member role',
    endpoint: `/api/teams/${TEAM_ID}/members/${SIGNER_USER_ID}`, method: 'PATCH', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.register, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Update member role',
      payload: { role: 'member' },
      expectedStatus: 404,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: [...DEP_AUTH, 'POST /api/teams']
  }],
  ['teams-leave.json', {
    name: 'POST /api/teams/:id/leave - Leave team',
    endpoint: `/api/teams/${TEAM_ID}/leave`, method: 'POST', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.register, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Leave team',
      payload: {}, expectedStatus: 200,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: [...DEP_AUTH, 'POST /api/teams']
  }],
  ['teams-delete.json', {
    name: 'DELETE /api/teams/:id - Delete team',
    endpoint: `/api/teams/${TEAM_ID}`, method: 'DELETE', requiresAuth: true, expectedStatus: 200,
    taskId: TASK.register, sprintId: SPRINT_ID,
    testCases: [{
      name: 'Delete team (owner only)',
      payload: {}, expectedStatus: 200,
      headers: { Authorization: AUTH_HEADER }
    }],
    captureResponse: {}, dependsOn: [...DEP_AUTH, 'POST /api/teams']
  }],
];

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
let written = 0;
for (const [filename, spec] of defs) {
  const p = path.join(OUT_DIR, filename);
  fs.writeFileSync(p, JSON.stringify(spec, null, 2) + '\n');
  written++;
}
console.log(`Wrote ${written} api_definition files to ${OUT_DIR}`);
