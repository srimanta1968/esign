# Requirements - Quick Prototype Sprint

## Project: Electronic document sign

I want to build app similar to docusign which will build a secure, scalable platform that enables users to upload documents, request signatures, sign electronically, and manage agreements end-to-end with auditability and compliance.

## Sprint Overview

Quick prototype sprint for generated project structure

## Epics

### User Management and Document Workflow

The User Management and Document Workflow epic is designed to enhance the software development project by integrating robust user authentication, efficient document management, and seamless signature workflows. This initiative aims to deliver a Minimum Viable Product (MVP) that encapsulates core business functionalities essential for optimal user engagement and operational efficiency. Through comprehensive market research and competitive analysis, the epic seeks to leverage the latest trends in user experience and document processing, positioning the project favorably against industry competitors. The successful implementation of this epic is considered critical for achieving strategic business value, ensuring a competitive edge, and maximizing return on investment (ROI). The acceptance criteria for this epic will focus on the effectiveness of user authentication processes, the reliability of document management systems, and the efficiency of signature workflows, thereby ensuring that all functionalities meet user needs and business objectives.

### User Management Module

This epic focuses on the User Management Module, which is critical for enabling users to register and log into the system through email and Single Sign-On (SSO). The module will incorporate role-based access controls tailored to different user types, ensuring secure access management. The design will support multi-tenant functionality, allowing various organizations to utilize the system effectively. Integration with existing authentication systems will be a key feature, as it will facilitate the verification of user identities and the management of user sessions in a secure manner. 
The implementation of this User Management Module is poised to significantly enhance security and improve overall user experience. By allowing personalized access and management features, organizations will benefit from streamlined user permissions and greater administrative control. This module is expected to not only improve operational efficiency but also provide a competitive edge in the market by aligning with the latest trends in user authentication and access management. 
The successful implementation of this epic will be measured against the following criteria: 1) Users can successfully register and log in using both email and SSO. 2) Role-based access controls are correctly applied according to user types. 3) Multi-tenant capabilities are functional, allowing separate organizations to operate within the same system without data overlap. 4) Integration with authentication systems meets security standards and effectively manages user sessions.

### E-Signature Capabilities

**Epic Status:** Pending  
**Epic Priority:** High  
**Epic Type:** Business Epic  
This epic focuses on enhancing E-Signature capabilities, enabling users to sign documents electronically with ease and flexibility. Users can choose to draw, type, or upload their signatures, accommodating personal preferences and ensuring a user-friendly signing process. Designed to be fully mobile-friendly, this feature caters to users on-the-go, while also supporting multiple languages to meet the diverse needs of a global audience.  
Incorporating various signing methods is expected to significantly boost user satisfaction and adoption rates, as users can select the signing method that aligns with their preferences and convenience. This flexibility not only enhances the overall user experience but also helps build trust in the platform, contributing to higher retention and engagement levels. Additionally, by aligning with current market trends and competitive analysis, the E-Signature capabilities can position the product favorably against competitors, implementing best practices and innovations that are currently shaping the e-signature landscape. The investment in these features is projected to yield a high return on investment (ROI) by attracting new users and maintaining existing ones.  
1. Users can successfully draw, type, or upload their signatures across all supported devices.  
2. The signing process is seamless and intuitive, with clear instructions for each signing method.  
3. The feature is fully functional on mobile devices and tablets, ensuring accessibility on various platforms.  
4. Multi-language support is available and functions correctly in all supported languages.  
5. User feedback is collected post-implementation to gauge satisfaction and areas for improvement.  
6. The feature is benchmarked against at least three competitors in the e-signature market, demonstrating a competitive advantage in functionality and user experience.

### Signature Workflow Engine

The Signature Workflow Engine epic is designed to enhance document signing processes, allowing users to efficiently add recipients, establish signing orders, and manage signature fields. This functionality encompasses both parallel and sequential signing flows, ensuring that documents are executed in the necessary order. Users will benefit from integrated notifications and reminders, keeping them informed throughout the signing lifecycle. 

Implementing the Signature Workflow Engine will significantly streamline the signing process, leading to reduced turnaround times and an improved overall user experience. Additionally, it offers enhanced tracking and management capabilities for document statuses, which are essential for maintaining compliance with regulatory requirements. 

Market research indicates a growing demand for efficient digital signing solutions, particularly in industries such as finance, healthcare, and legal, where document integrity and timeliness are critical. Competitively, this engine positions our offering favorably against existing solutions by emphasizing user-centric design and robust functionality that meets current market expectations.

The strategic value of the Signature Workflow Engine lies in its potential to improve operational efficiencies and deliver a higher return on investment (ROI) by reducing manual processes and the costs associated with traditional signing methods. This evolution will not only meet user needs but also ensure we stay ahead in a competitive landscape. 
for this epic include: 1) Users must be able to add multiple recipients and set specific signing orders; 2) The system should support both parallel and sequential signing workflows; 3) Notifications and reminders for signers must be operational; 4) Document status tracking must be visible and easily accessible to users; 5) Compliance reporting capabilities should be integrated into the workflow.

## Features

### Signed Document PDF Generation

Generate final signed PDF with all signatures embedded at their placed positions. Overlay signature images onto original PDF at exact coordinates. Flatten PDF after all parties sign.

### E-Signature Capabilities

Allow users to sign documents electronically using various methods.

### Workflow Compliance & Action History

E-signature regulation compliance, complete history of all document actions for compliance.

### Single Sign-On (SSO) Integration

SSO login from supported providers, secure identity verification through external auth systems.

### User Registration & Authentication

Email registration, login, password reset. Covers: register via email, login with email/password, secure password reset process.

## Tasks

### Render verification stamp next to signature in signed PDF

In signed PDF generator, draw a small verification stamp adjacent to each signature containing: Verified label, signing date-time, signer IP, short envelope id. Green border, light-green fill, small monospace text. Applies to typed, drawn, uploaded signatures.

**Acceptance Criteria:**

### Track signing-started event when recipient opens signing page

When a recipient opens the public signing page via their token, record a signing_started event with timestamp + IP on the Recipient row and emit a workflow_history audit event. Idempotent (only first open triggers). New API POST /api/signing/started/:token called once by client on page mount.

**Acceptance Criteria:**

### [UNTRACKED] Define API specs for 92 APIs

## Untracked APIs Detected

**Total untracked APIs:** 92

These APIs were discovered during git hooks but were not created through ProjexLight task flow.

| # | Method | Endpoint | Route File |
|---|--------|----------|------------|
| 1 | GET | /:id | server/src/routes/documentRoutes.ts |
| 2 | DELETE | /:id | server/src/routes/documentRoutes.ts |
| 3 | PATCH | /:id/sign | server/src/routes/signatureRoutes.ts |
| 4 | POST | / | server/src/routes/documentRoutes.ts |
| 5 | GET | / | server/src/routes/documentRoutes.ts |
| 6 | POST | /api/documents/ | server/src/routes/documentRoutes.ts |
| 7 | GET | /api/documents/ | server/src/routes/documentRoutes.ts |
| 8 | GET | /api/documents/:id/download | server/src/routes/documentRoutes.ts |
| 9 | PATCH | /read | server/src/routes/notificationRoutes.ts |
| 10 | POST | /signature-event | server/src/routes/analyticsRoutes.ts |
| 11 | GET | /report | server/src/routes/complianceRoutes.ts |
| 12 | POST | /alerts/config | server/src/routes/complianceRoutes.ts |
| 13 | GET | /alerts | server/src/routes/complianceRoutes.ts |
| 14 | GET | /export | server/src/routes/complianceRoutes.ts |
| 15 | GET | /esign-metadata/:signatureId | server/src/routes/complianceRoutes.ts |
| 16 | POST | /esign-metadata | server/src/routes/complianceRoutes.ts |
| 17 | GET | /api/documents/search | server/src/routes/documentRoutes.ts |
| 18 | POST | /api/documents/templates | server/src/routes/documentRoutes.ts |
| 19 | GET | /api/documents/templates | server/src/routes/documentRoutes.ts |
| 20 | GET | /api/documents/templates/:id | server/src/routes/documentRoutes.ts |
| 21 | DELETE | /api/documents/templates/:id | server/src/routes/documentRoutes.ts |
| 22 | POST | /api/documents/:id/versions | server/src/routes/documentRoutes.ts |
| 23 | GET | /api/documents/:id/versions | server/src/routes/documentRoutes.ts |
| 24 | POST | /api/documents/:id/versions/:versionId/revert | server/src/routes/documentRoutes.ts |
| 25 | POST | /api/documents/:id/tags | server/src/routes/documentRoutes.ts |
| 26 | GET | /api/documents/:id/tags | server/src/routes/documentRoutes.ts |
| 27 | DELETE | /api/documents/:id/tags/:tag | server/src/routes/documentRoutes.ts |
| 28 | GET | /api/documents/:id/file | server/src/routes/documentRoutes.ts |
| 29 | GET | /api/notifications/ | server/src/routes/notificationRoutes.ts |
| 30 | PATCH | /api/notifications/read | server/src/routes/notificationRoutes.ts |
| 31 | POST | /api/notifications/send | server/src/routes/notificationRoutes.ts |
| 32 | GET | /api/notifications/stream | server/src/routes/notificationRoutes.ts |
| 33 | GET | /api/notifications/preferences | server/src/routes/notificationRoutes.ts |
| 34 | PUT | /api/notifications/preferences | server/src/routes/notificationRoutes.ts |
| 35 | POST | /api/signatures/ | server/src/routes/signatureRoutes.ts |
| 36 | GET | /:token | server/src/routes/signingRoutes.ts |
| 37 | GET | /:token/document | server/src/routes/signingRoutes.ts |
| 38 | POST | /:token/complete | server/src/routes/signingRoutes.ts |
| 39 | PUT | /language | server/src/routes/userRoutes.ts |
| 40 | GET | /roles | server/src/routes/userRoutes.ts |
| 41 | PUT | /:id/role | server/src/routes/userRoutes.ts |
| 42 | POST | /api/user-signatures/ | server/src/routes/userSignatureRoutes.ts |
| 43 | GET | /api/user-signatures/ | server/src/routes/userSignatureRoutes.ts |
| 44 | PUT | /:id | server/src/routes/workflowRoutes.ts |
| 45 | POST | /:id/start | server/src/routes/workflowRoutes.ts |
| 46 | PATCH | /:id/decline | server/src/routes/workflowRoutes.ts |
| 47 | GET | /:id/status | server/src/routes/workflowRoutes.ts |
| 48 | POST | /:id/remind | server/src/routes/workflowRoutes.ts |
| 49 | PUT | /:id/reminders | server/src/routes/workflowRoutes.ts |
| 50 | GET | /:id/history | server/src/routes/workflowRoutes.ts |
| 51 | POST | /:id/self-sign | server/src/routes/workflowRoutes.ts |
| 52 | GET | /api/auth/me | server/src/routes/authRoutes.ts |
| 53 | GET | /api/auth/profile | server/src/routes/authRoutes.ts |
| 54 | PUT | /api/auth/profile | server/src/routes/authRoutes.ts |
| 55 | POST | /api/auth/api-keys | server/src/routes/authRoutes.ts |
| 56 | GET | /api/auth/api-keys | server/src/routes/authRoutes.ts |
| 57 | DELETE | /api/auth/api-keys/:id | server/src/routes/authRoutes.ts |
| 58 | POST | /api/billing/checkout | server/src/routes/billingRoutes.ts |
| 59 | POST | /api/billing/portal | server/src/routes/billingRoutes.ts |
| 60 | GET | /api/billing/subscription | server/src/routes/billingRoutes.ts |
| 61 | POST | /api/billing/webhook | server/src/routes/billingRoutes.ts |
| 62 | POST | /api/documents/templates/:id/use | server/src/routes/documentRoutes.ts |
| 63 | POST | /api/teams/ | server/src/routes/teamRoutes.ts |
| 64 | GET | /api/teams/mine | server/src/routes/teamRoutes.ts |
| 65 | GET | /api/teams/join/:token | server/src/routes/teamRoutes.ts |
| 66 | POST | /api/teams/join/:token | server/src/routes/teamRoutes.ts |
| 67 | GET | /api/teams/:id | server/src/routes/teamRoutes.ts |
| 68 | POST | /api/teams/:id/invite | server/src/routes/teamRoutes.ts |
| 69 | DELETE | /api/teams/:id/invites/:inviteId | server/src/routes/teamRoutes.ts |
| 70 | DELETE | /api/teams/:id/members/:userId | server/src/routes/teamRoutes.ts |
| 71 | PATCH | /api/teams/:id/members/:userId | server/src/routes/teamRoutes.ts |
| 72 | POST | /api/teams/:id/leave | server/src/routes/teamRoutes.ts |
| 73 | DELETE | /api/teams/:id | server/src/routes/teamRoutes.ts |
| 74 | PUT | /api/user-signatures/:id | server/src/routes/userSignatureRoutes.ts |
| 75 | DELETE | /api/user-signatures/:id | server/src/routes/userSignatureRoutes.ts |
| 76 | POST | /api/workflows/ | server/src/routes/workflowRoutes.ts |
| 77 | GET | /api/workflows/ | server/src/routes/workflowRoutes.ts |
| 78 | POST | /api/workflows/admin/process-completions | server/src/routes/workflowRoutes.ts |
| 79 | GET | /api/workflows/:id/downloads | server/src/routes/workflowRoutes.ts |
| 80 | POST | /api/workflows/:id/cancel | server/src/routes/workflowRoutes.ts |
| 81 | PATCH | /api/workflows/:id/decline | server/src/routes/workflowRoutes.ts |
| 82 | GET | /api/workflows/:id/history/export | server/src/routes/workflowRoutes.ts |
| 83 | POST | /api/workflows/:id/self-sign | server/src/routes/workflowRoutes.ts |
| 84 | POST | /api/auth/verify-email | server/src/routes/authRoutes.ts |
| 85 | POST | /api/auth/resend-verification | server/src/routes/authRoutes.ts |
| 86 | GET | /api/sign/:token | server/src/routes/signingRoutes.ts |
| 87 | GET | /api/sign/:token/document | server/src/routes/signingRoutes.ts |
| 88 | POST | /api/sign/:token/complete | server/src/routes/signingRoutes.ts |
| 89 | GET | /api/audit-logs/ | server/src/routes/auditRoutes.ts |
| 90 | POST | /api/compliance/esign-metadata | server/src/routes/complianceRoutes.ts |
| 91 | POST | /api/organizations/ | server/src/routes/organizationRoutes.ts |
| 92 | GET | /api/users/ | server/src/routes/userRoutes.ts |

### Required Steps
For EACH API listed above:
1. Open the route file implementing the endpoint
2. Create a test definition JSON file in `tests/api_definitions/` with proper payload using `{{dynamic:...}}` or `{{cache:...}}` placeholders
3. Add a `// @governance-tracked` comment at the top of the route file (after imports)
4. On next `git push`, all APIs will be tested and tracked automatically

**Acceptance Criteria:**

### [TEST-DATA] Create test definitions for 144 APIs

## Test Definitions Missing

**Total APIs without test data:** 144

The following APIs were discovered but have no test definition files in `tests/api_definitions/`.

| # | Method | Endpoint | Reason |
|---|--------|----------|--------|
| 1 | POST | /api/auth/verify-email | Requires a real verification code from email which cannot be captured in automated tests |
| 2 | POST | /api/teams/:id/invite | Skipped - no captured values for path params: ['id'] |
| 3 | POST | /api/teams/join/:token | Requires a valid invite token and a different authenticated user than the team owner to join |
| 4 | POST | /api/documents/templates/:id/use | Skipped - no captured values for path params: ['id'] |
| 5 | POST | /api/documents/:id/versions | Requires multipart file upload which cannot be sent via JSON API test payload |
| 6 | POST | /api/documents/:id/versions/:versionId/revert | Requires a document with multiple versions (via file upload) to have a versionId to revert to |
| 7 | POST | /api/billing/checkout | Requires Stripe configuration and real payment processing which cannot be automated in test environment |
| 8 | POST | /api/billing/portal | Requires existing Stripe billing account which is not available in test environment |
| 9 | POST | /api/billing/webhook | Stripe webhook requires valid stripe-signature header with HMAC verification which cannot be automated |
| 10 | POST | /api/workflows/:id/self-sign | Self-signing requires a workflow where the creator is also a recipient, plus a saved user signature |
| 11 | POST | /api/teams/:id/leave | Team owner cannot leave their own team; would need a second user account to test this |
| 12 | POST | /api/workflows/:id/cancel | Would cancel the workflow created by the test suite, breaking downstream sign/decline tests that depend on it |
| 13 | GET | /api/auth/sso/:provider | Skipped - no captured values for path params: ['provider'] |
| 14 | GET | /api/auth/sso/callback | SSO callback requires real OAuth provider authorization code exchange which cannot be automated |
| 15 | GET | /api/user-signatures/:id | Skipped - no captured values for path params: ['id'] |
| 16 | GET | /api/teams/:id | Skipped - no captured values for path params: ['id'] |
| 17 | GET | /api/documents/:id/download | Requires a real uploaded document with file on S3/disk; JSON-stubbed documents have no downloadable file |
| 18 | GET | /api/documents/:id/file | Requires a real uploaded document with file on S3/disk; JSON-stubbed documents have no servable file |
| 19 | GET | /api/documents/templates/:id | Skipped - no captured values for path params: ['id'] |
| 20 | GET | /api/workflows/:id/downloads | Requires a completed workflow with signed PDF generated, which involves the full signing lifecycle |
| 21 | GET | /api/teams/join/:token | Skipped - no captured values for path params: ['token'] |
| 22 | PUT | /api/users/:id/role | Skipped - no captured values for path params: ['id'] |
| 23 | PUT | /api/user-signatures/:id | Skipped - no captured values for path params: ['id'] |
| 24 | PATCH | /api/teams/:id/members/:userId | Requires a second user as team member to update their role; single-user test environment cannot test this |
| 25 | PATCH | /api/workflows/:id/decline | Requires the authenticated user to be a pending recipient of a started workflow, which needs a multi-step flow |
| 26 | DELETE | /api/auth/sessions/:id | Skipped - no captured values for path params: ['id'] |
| 27 | DELETE | /api/auth/api-keys/:id | Skipped - no captured values for path params: ['id'] |
| 28 | DELETE | /api/teams/:id | Skipped - no captured values for path params: ['id'] |
| 29 | DELETE | /api/teams/:id/members/:userId | Requires a second user who has joined the team; single-user test environment cannot test member removal |
| 30 | DELETE | /api/teams/:id/invites/:inviteId | Skipped - no captured values for path params: ['id', 'inviteId'] |
| 31 | DELETE | /api/documents/templates/:id | Skipped - no captured values for path params: ['id'] |
| 32 | DELETE | /api/documents/:id/tags/:tag | Skipped - no captured values for path params: ['tag'] |
| 33 | DELETE | /api/user-signatures/:id | Skipped - no captured values for path params: ['id'] |
| 34 | ALL | /api/* | Catch-all wildcard route cannot be tested directly - audit middleware is validated implicitly by all other API tests |
| 35 | POST | /api/auth/register | Local server not running - test skipped |
| 36 | POST | /api/auth/login | Local server not running - test skipped |
| 37 | POST | /api/auth/forgot-password | Local server not running - test skipped |
| 38 | POST | /api/auth/resend-verification | Local server not running - test skipped |
| 39 | POST | /api/auth/reset-password | Local server not running - test skipped |
| 40 | POST | /api/documents | Local server not running - test skipped |
| 41 | POST | /api/auth/api-keys | Local server not running - test skipped |
| 42 | POST | /api/organizations | Local server not running - test skipped |
| 43 | POST | /api/teams/ | Local server not running - test skipped |
| 44 | POST | /api/signatures | Local server not running - test skipped |
| 45 | POST | /api/workflows | Local server not running - test skipped |
| 46 | POST | /api/compliance/alerts/config | Local server not running - test skipped |
| 47 | POST | /api/auth/refresh-token | Local server not running - test skipped |
| 48 | POST | /api/notifications/send | Local server not running - test skipped |
| 49 | POST | /api/signatures/:id/confirm | Local server not running - test skipped |
| 50 | POST | /api/documents/templates | Local server not running - test skipped |
| 51 | POST | /api/documents/:id/tags | Local server not running - test skipped |
| 52 | POST | /api/analytics/signature-event | Local server not running - test skipped |
| 53 | POST | /api/user-signatures | Local server not running - test skipped |
| 54 | POST | /api/workflows/:id/start | Local server not running - test skipped |
| 55 | POST | /api/workflows/:id/remind | Local server not running - test skipped |
| 56 | POST | /api/documents/ | Local server not running - test skipped |
| 57 | POST | /api/signatures/ | Local server not running - test skipped |
| 58 | POST | /api/user-signatures/ | Local server not running - test skipped |
| 59 | POST | /api/workflows/admin/process-completions | Local server not running - test skipped |
| 60 | POST | /api/workflows/ | Local server not running - test skipped |
| 61 | GET | /api/auth/profile | Local server not running - test skipped |
| 62 | GET | /api/users | Local server not running - test skipped |
| 63 | GET | /api/users/roles | Local server not running - test skipped |
| 64 | GET | /api/documents/:id | Local server not running - test skipped |
| 65 | GET | /api/organizations/:id | Local server not running - test skipped |
| 66 | GET | /api/teams/mine | Local server not running - test skipped |
| 67 | GET | /api/audit-logs | Local server not running - test skipped |
| 68 | GET | /api/compliance/alerts | Local server not running - test skipped |
| 69 | GET | /api/compliance/export | Local server not running - test skipped |
| 70 | GET | /api/compliance/report | Local server not running - test skipped |
| 71 | GET | /api/workflows/:id/history/export | Local server not running - test skipped |
| 72 | GET | /api/signatures/:documentId | Local server not running - test skipped |
| 73 | GET | /api/compliance/esign-metadata/:signatureId | Local server not running - test skipped |
| 74 | GET | /api/workflows/:id/status | Local server not running - test skipped |
| 75 | GET | /api/auth/api-keys | Local server not running - test skipped |
| 76 | GET | /api/auth/me | Local server not running - test skipped |
| 77 | GET | /api/billing/subscription | Local server not running - test skipped |
| 78 | GET | /api/documents/ | Local server not running - test skipped |
| 79 | GET | /api/documents/:id/tags | Local server not running - test skipped |
| 80 | GET | /api/documents/:id/versions | Local server not running - test skipped |
| 81 | GET | /api/documents/search | Local server not running - test skipped |
| 82 | GET | /api/notifications/ | Local server not running - test skipped |
| 83 | GET | /api/user-signatures/ | Local server not running - test skipped |
| 84 | GET | /api/workflows/ | Local server not running - test skipped |
| 85 | GET | /api/documents | Local server not running - test skipped |
| 86 | GET | /api/workflows/:id | Local server not running - test skipped |
| 87 | GET | /api/workflows/:id/history | Local server not running - test skipped |
| 88 | GET | /api/auth/sessions | Local server not running - test skipped |
| 89 | GET | /api/user-signatures | Local server not running - test skipped |
| 90 | PUT | /api/notifications/preferences | Local server not running - test skipped |
| 91 | PUT | /api/users/language | Local server not running - test skipped |
| 92 | PUT | /api/workflows/:id | Local server not running - test skipped |
| 93 | PUT | /api/workflows/:id/reminders | Local server not running - test skipped |
| 94 | PUT | /api/auth/profile | Local server not running - test skipped |
| 95 | PATCH | /api/signatures/:id/sign | Local server not running - test skipped |
| 96 | PATCH | /api/workflows/:id/sign | Local server not running - test skipped |
| 97 | PATCH | /api/notifications/read | Local server not running - test skipped |
| 98 | DELETE | /api/documents/:id | Local server not running - test skipped |
| 99 | POST | /api/sign/:token/started | Requires a valid signing token issued via email from the workflow signing flow; the token is not returned in any API response and cannot be captured in automated tests. |
| 100 | GET | /api/notifications/stream | Server not reachable |
| 101 | GET | /api/* | Catch-all wildcard route cannot be tested directly - audit middleware is validated implicitly by all other API tests |
| 102 | POST | /api/documents/{{cache:documents.upload.response.data.id}}/tags | Skipped - no captured values for path params: ['documents'] |
| 103 | POST | /api/documents/{{cache:documents.upload.response.data.id}}/versions | Skipped - no captured values for path params: ['documents'] |
| 104 | POST | /api/documents/{{cache:documents.upload.response.data.id}}/versions/{{cache:documentsVersions.create.response.data.id}}/revert | Skipped - no captured values for path params: ['documents', 'documentsVersions'] |
| 105 | POST | /api/teams/{{cache:teams.create.response.data.id}}/invite | Skipped - no captured values for path params: ['teams'] |
| 106 | POST | /api/teams/{{cache:teams.create.response.data.id}}/leave | Skipped - no captured values for path params: ['teams'] |
| 107 | POST | /api/documents/templates/{{cache:documentsTemplates.create.response.data.id}}/use | Skipped - no captured values for path params: ['documentsTemplates'] |
| 108 | POST | /api/signatures/{{cache:signatures.create.response.data.id}}/confirm | Skipped - no captured values for path params: ['signatures'] |
| 109 | POST | /api/workflows/{{cache:workflows.create.response.data.id}}/cancel | Skipped - no captured values for path params: ['workflows'] |
| 110 | POST | /api/workflows/{{cache:workflows.create.response.data.id}}/remind | Skipped - no captured values for path params: ['workflows'] |
| 111 | POST | /api/workflows/{{cache:workflows.create.response.data.id}}/self-sign | Skipped - no captured values for path params: ['workflows'] |
| 112 | POST | /api/workflows/{{cache:workflows.create.response.data.id}}/start | Skipped - no captured values for path params: ['workflows'] |
| 113 | GET | /api/documents/{{cache:documents.upload.response.data.id}}/download | Skipped - no captured values for path params: ['documents'] |
| 114 | GET | /api/documents/{{cache:documents.upload.response.data.id}}/file | Skipped - no captured values for path params: ['documents'] |
| 115 | GET | /api/documents/{{cache:documents.upload.response.data.id}} | Skipped - no captured values for path params: ['documents'] |
| 116 | GET | /api/documents/{{cache:documents.upload.response.data.id}}/tags | Skipped - no captured values for path params: ['documents'] |
| 117 | GET | /api/documents/{{cache:documents.upload.response.data.id}}/versions | Skipped - no captured values for path params: ['documents'] |
| 118 | GET | /api/signatures/{{cache:documents.upload.response.data.id}} | Skipped - no captured values for path params: ['documents'] |
| 119 | GET | /api/organizations/{{cache:organizations.create.response.data.id}} | Skipped - no captured values for path params: ['organizations'] |
| 120 | GET | /api/teams/{{cache:teams.create.response.data.id}} | Skipped - no captured values for path params: ['teams'] |
| 121 | GET | /api/user-signatures/{{cache:userSignatures.create.response.data.id}} | Skipped - no captured values for path params: ['userSignatures'] |
| 122 | GET | /api/documents/templates/{{cache:documentsTemplates.create.response.data.id}} | Skipped - no captured values for path params: ['documentsTemplates'] |
| 123 | GET | /api/compliance/esign-metadata/{{cache:signatures.create.response.data.id}} | Skipped - no captured values for path params: ['signatures'] |
| 124 | GET | /api/workflows/{{cache:workflows.create.response.data.id}}/downloads | Skipped - no captured values for path params: ['workflows'] |
| 125 | GET | /api/workflows/{{cache:workflows.create.response.data.id}} | Skipped - no captured values for path params: ['workflows'] |
| 126 | GET | /api/workflows/{{cache:workflows.create.response.data.id}}/history/export?format=csv | Skipped - no captured values for path params: ['workflows'] |
| 127 | GET | /api/workflows/{{cache:workflows.create.response.data.id}}/history | Skipped - no captured values for path params: ['workflows'] |
| 128 | GET | /api/workflows/{{cache:workflows.create.response.data.id}}/status | Skipped - no captured values for path params: ['workflows'] |
| 129 | PUT | /api/users/{{cache:auth.login.response.data.userId}}/role | Skipped - no captured values for path params: ['auth'] |
| 130 | PUT | /api/user-signatures/{{cache:userSignatures.create.response.data.id}} | Skipped - no captured values for path params: ['userSignatures'] |
| 131 | PUT | /api/workflows/{{cache:workflows.create.response.data.id}}/reminders | Skipped - no captured values for path params: ['workflows'] |
| 132 | PUT | /api/workflows/{{cache:workflows.create.response.data.id}} | Skipped - no captured values for path params: ['workflows'] |
| 133 | PATCH | /api/teams/{{cache:teams.create.response.data.id}}/members/{{cache:auth.login.response.data.userId}} | Skipped - no captured values for path params: ['teams', 'auth'] |
| 134 | PATCH | /api/signatures/{{cache:signatures.create.response.data.id}}/sign | Skipped - no captured values for path params: ['signatures'] |
| 135 | PATCH | /api/workflows/{{cache:workflows.create.response.data.id}}/decline | Skipped - no captured values for path params: ['workflows'] |
| 136 | PATCH | /api/workflows/{{cache:workflows.create.response.data.id}}/sign | Skipped - no captured values for path params: ['workflows'] |
| 137 | DELETE | /api/auth/api-keys/{{cache:authApiKeys.create.response.data.id}} | Skipped - no captured values for path params: ['authApiKeys'] |
| 138 | DELETE | /api/documents/{{cache:documents.upload.response.data.id}} | Skipped - no captured values for path params: ['documents'] |
| 139 | DELETE | /api/documents/{{cache:documents.upload.response.data.id}}/tags/contract | Skipped - no captured values for path params: ['documents'] |
| 140 | DELETE | /api/teams/{{cache:teams.create.response.data.id}} | Skipped - no captured values for path params: ['teams'] |
| 141 | DELETE | /api/teams/{{cache:teams.create.response.data.id}}/invites/{{cache:teamsInvite.response.data.id}} | Skipped - no captured values for path params: ['teams', 'teamsInvite'] |
| 142 | DELETE | /api/teams/{{cache:teams.create.response.data.id}}/members/{{cache:auth.login.response.data.userId}} | Skipped - no captured values for path params: ['teams', 'auth'] |
| 143 | DELETE | /api/user-signatures/{{cache:userSignatures.create.response.data.id}} | Skipped - no captured values for path params: ['userSignatures'] |
| 144 | DELETE | /api/documents/templates/{{cache:documentsTemplates.create.response.data.id}} | Skipped - no captured values for path params: ['documentsTemplates'] |

### Required Steps
For EACH API listed above:
1. Identify the route file that implements the endpoint
2. Create a test definition JSON file in `tests/api_definitions/`
3. Include proper payload with `{{dynamic:...}}` or `{{cache:...}}` placeholders
4. Add `dependsOn` if the API requires data created by another API
5. Add a `// @governance-tracked` comment at the top of the route file (after imports)

On next `git push`, all APIs will be tested and tracked automatically.

**Acceptance Criteria:**

### [AUTO-FIX] API Test Failures (1 APIs) - Reopened #1

## Consolidated API Test Failures

**Total Failed APIs:** 1
**Generated:** 2026-05-13T04:26:16.091Z

**Feedback File:** `.projexlight/feedback/failed_tests_latest.json`
> Read this file for the most up-to-date error details. This file is always overwritten on each push.

---

### 1. POST /api/auth/login

**Error:** Status 429 - Error: Too many login attempts. Please try again later.

---

### Required Steps
1. Read the feedback file at the path above for full error context
2. For each failed API, identify the route file implementing it
3. Investigate the root cause — is it a code bug, test data issue, or dependency problem?
4. Fix the root cause in the implementation code OR update the test definition in `tests/api_definitions/`
5. Ensure test definitions have proper `{{dynamic:...}}` or `{{cache:...}}` placeholders
6. Add `dependsOn` in test definitions if APIs require data from other APIs first
7. After fixing, commit and push to re-run tests

**Acceptance Criteria:**

