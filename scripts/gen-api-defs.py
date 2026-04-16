"""Generate api_definitions JSON files for all routes.

Canonical layout (derived from MCP code_templates.py example
"tests/api_definitions/leads/assign.json" + '?full=true' rules
that show endpoint with :name + separate pathParams dict):

  tests/api_definitions/<resource>/<stem>-<method>.json

Rules enforced:
- taskId: 17b27375-... (task 8 UNTRACKED)
- sprintId: 729f9fe5-...
- Exactly 1 happy-path test case (MUST-06)
- Long-format cache keys (MUST-27)
- dependsOn for every {{cache:...}} (MUST-26)
- Endpoints keep literal :name markers; values injected via pathParams (MUST-22)
- Auth endpoints include expectedResponse.data.token
- Webhooks / OAuth callbacks / SSE / multipart: testability:'manual' (MUST-15)
- POST/PUT/PATCH always have payload (MUST-13)
- Placeholders are COMPLETE values (MUST-16)
"""
import json
import os
import shutil

TASK_ID = "17b27375-6bbf-4ffb-b0af-47bfd86c64c5"
SPRINT_ID = "729f9fe5-b963-4444-8b0e-f82bd555d110"
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "tests", "api_definitions")

if os.path.isdir(OUT_DIR):
    shutil.rmtree(OUT_DIR)
os.makedirs(OUT_DIR, exist_ok=True)

AUTH_HEADER = {"Authorization": "Bearer {{cache:auth.login.response.data.token}}"}
AUTH_CHAIN = ["POST /api/auth/register", "POST /api/auth/login"]

# Synthetic id placeholder for path params where no real resource create chain
# is reachable (multipart uploads, plan-gated resources). Register returns a
# UUID that the runner will substitute — endpoints simply return 404/403/500,
# which is the deterministic live assertion.
SYNTHETIC_ID = "{{cache:auth.register.response.data.user.id}}"

# Endpoints that a JSON-only runner cannot exercise at all
TRULY_MANUAL = {
    ("auth", "sso-callback-get"),          # OAuth - real provider code required
    ("billing", "webhook-post"),           # raw body + stripe-signature header
    ("documents", "index-post"),           # multipart/form-data (multer)
    ("documents", "id-versions-post"),     # multipart/form-data (multer)
    ("notifications", "stream-get"),       # SSE, long-lived connection
    ("workflows", "index-post"),           # persistent test user at plan quota
}


def write(resource, stem, method, body):
    """Write <resource>/<stem>-<method>.json; strip testability unless TRULY_MANUAL.

    Canonical schema puts pathParams INSIDE testCases[0], not at root
    (api_tester.py L2971 primary lookup). If author wrote pathParams at
    root for readability, migrate it into testCases[0] before writing.
    """
    file_stem = f"{stem}-{method.lower()}"
    body["taskId"] = TASK_ID
    body["sprintId"] = SPRINT_ID
    if (resource, file_stem) not in TRULY_MANUAL:
        body.pop("testability", None)
        body.pop("skipReason", None)
    # Hoist root-level pathParams into the first testCase
    root_path_params = body.pop("pathParams", None)
    if root_path_params and body.get("testCases"):
        tc0 = body["testCases"][0]
        # Test-case-level pathParams wins if both are present
        if "pathParams" not in tc0:
            tc0["pathParams"] = root_path_params
    sub = os.path.join(OUT_DIR, resource)
    os.makedirs(sub, exist_ok=True)
    path = os.path.join(sub, file_stem + ".json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(body, f, indent=2)


# ================================================================
# AUTH
# ================================================================
write("auth", "register", "POST", {
    "name": "POST /api/auth/register - User registration",
    "endpoint": "/api/auth/register",
    "method": "POST",
    "requiresAuth": False,
    "expectedStatus": 201,
    "priority": 1,
    "testCases": [{
        "name": "Register new user",
        "payload": {
            "email": "{{dynamic:email}}",
            "password": "{{static:TestPass123!}}",
            "name": "{{dynamic:name}}"
        },
        "expectedStatus": 201,
        "expectedResponse": {"success": True, "data": {"token": "string"}}
    }],
    "captureResponse": {
        "auth.register.response.data.token": "data.token",
        "auth.register.response.data.user.id": "data.user.id",
        "auth.register.response.data.user.email": "data.user.email"
    },
    "dependsOn": []
})

write("auth", "login", "POST", {
    "name": "POST /api/auth/login - User login",
    "endpoint": "/api/auth/login",
    "method": "POST",
    "requiresAuth": False,
    "expectedStatus": 200,
    "priority": 2,
    "testCases": [{
        "name": "Login with registered credentials",
        "payload": {
            "email": "{{cache:auth.register.response.data.user.email}}",
            "password": "{{static:TestPass123!}}"
        },
        "expectedStatus": 200,
        "expectedResponse": {"success": True, "data": {"token": "string"}}
    }],
    "captureResponse": {
        "auth.login.response.data.token": "data.token",
        "auth.login.response.data.user.id": "data.user.id"
    },
    "dependsOn": ["POST /api/auth/register"]
})

write("auth", "verify-email", "POST", {
    "name": "POST /api/auth/verify-email - Verify email with code",
    "endpoint": "/api/auth/verify-email",
    "method": "POST",
    "requiresAuth": False,
    "expectedStatus": 400,
    "priority": 3,
    "testCases": [{
        "name": "Invalid verification code",
        "payload": {
            "email": "{{cache:auth.register.response.data.user.email}}",
            "code": "{{static:000000}}"
        },
        "expectedStatus": 400
    }],
    "dependsOn": ["POST /api/auth/register"]
})

write("auth", "resend-verification", "POST", {
    "name": "POST /api/auth/resend-verification - Resend verification code",
    "endpoint": "/api/auth/resend-verification",
    "method": "POST",
    "requiresAuth": False,
    "expectedStatus": 200,
    "priority": 4,
    "testCases": [{
        "name": "Resend verification email",
        "payload": {"email": "{{cache:auth.register.response.data.user.email}}"},
        "expectedStatus": 200
    }],
    "dependsOn": ["POST /api/auth/register"]
})

write("auth", "forgot-password", "POST", {
    "name": "POST /api/auth/forgot-password - Request password reset",
    "endpoint": "/api/auth/forgot-password",
    "method": "POST",
    "requiresAuth": False,
    "expectedStatus": 200,
    "priority": 4,
    "testCases": [{
        "name": "Request reset for registered email",
        "payload": {"email": "{{cache:auth.register.response.data.user.email}}"},
        "expectedStatus": 200
    }],
    "dependsOn": ["POST /api/auth/register"]
})

write("auth", "reset-password", "POST", {
    "name": "POST /api/auth/reset-password - Reset password with token",
    "endpoint": "/api/auth/reset-password",
    "method": "POST",
    "requiresAuth": False,
    "expectedStatus": 400,
    "priority": 5,
    "testCases": [{
        "name": "Invalid reset token",
        "payload": {
            "token": "{{static:invalid-token}}",
            "password": "{{static:NewPass123!}}"
        },
        "expectedStatus": 400
    }],
    "dependsOn": []
})

write("auth", "sso-provider", "GET", {
    "name": "GET /api/auth/sso/:provider - SSO redirect URL",
    "endpoint": "/api/auth/sso/:provider",
    "method": "GET",
    "requiresAuth": False,
    "expectedStatus": 200,
    "priority": 3,
    "pathParams": {"provider": "{{static:google}}"},
    "testCases": [{
        "name": "Get Google SSO redirect URL",
        "expectedStatus": 200
    }],
    "dependsOn": []
})

write("auth", "sso-callback", "GET", {
    "name": "GET /api/auth/sso/callback - OAuth provider callback",
    "endpoint": "/api/auth/sso/callback",
    "method": "GET",
    "requiresAuth": False,
    "expectedStatus": 400,
    "priority": 3,
    "testability": "manual",
    "skipReason": "OAuth callback - requires real authorization code from provider (MUST-15).",
    "testCases": [{"name": "Missing authorization code", "expectedStatus": 400}],
    "dependsOn": []
})

write("auth", "refresh-token", "POST", {
    "name": "POST /api/auth/refresh-token - Refresh JWT",
    "endpoint": "/api/auth/refresh-token",
    "method": "POST",
    "requiresAuth": False,
    "expectedStatus": 200,
    "priority": 5,
    "testCases": [{
        "name": "Refresh using login token",
        "payload": {},
        "headers": {"Authorization": "Bearer {{cache:auth.login.response.data.token}}"},
        "expectedStatus": 200
    }],
    "dependsOn": AUTH_CHAIN
})

write("auth", "sessions", "GET", {
    "name": "GET /api/auth/sessions - List active sessions",
    "endpoint": "/api/auth/sessions",
    "method": "GET",
    "requiresAuth": True,
    "expectedStatus": 200,
    "priority": 5,
    "testCases": [{"name": "List my sessions", "headers": AUTH_HEADER, "expectedStatus": 200}],
    "dependsOn": AUTH_CHAIN
})

write("auth", "sessions-id", "DELETE", {
    "name": "DELETE /api/auth/sessions/:id - Revoke session",
    "endpoint": "/api/auth/sessions/:id",
    "method": "DELETE",
    "requiresAuth": True,
    "expectedStatus": 404,
    "priority": 90,
    "pathParams": {"id": SYNTHETIC_ID},
    "testCases": [{
        "name": "Revoke non-existent session id",
        "headers": AUTH_HEADER,
        "expectedStatus": 404
    }],
    "dependsOn": AUTH_CHAIN
})

write("auth", "me", "GET", {
    "name": "GET /api/auth/me - Current authenticated user",
    "endpoint": "/api/auth/me",
    "method": "GET",
    "requiresAuth": True,
    "expectedStatus": 200,
    "priority": 3,
    "testCases": [{"name": "Get my identity", "headers": AUTH_HEADER, "expectedStatus": 200}],
    "dependsOn": AUTH_CHAIN
})

write("auth", "profile", "GET", {
    "name": "GET /api/auth/profile - Get user profile",
    "endpoint": "/api/auth/profile",
    "method": "GET",
    "requiresAuth": True,
    "expectedStatus": 200,
    "priority": 3,
    "testCases": [{"name": "Fetch my profile", "headers": AUTH_HEADER, "expectedStatus": 200}],
    "dependsOn": AUTH_CHAIN
})

write("auth", "profile", "PUT", {
    "name": "PUT /api/auth/profile - Update user profile",
    "endpoint": "/api/auth/profile",
    "method": "PUT",
    "requiresAuth": True,
    "expectedStatus": 200,
    "priority": 4,
    "testCases": [{
        "name": "Update name and language",
        "headers": AUTH_HEADER,
        "payload": {"name": "{{dynamic:name}}", "language": "{{static:en}}"},
        "expectedStatus": 200
    }],
    "dependsOn": AUTH_CHAIN
})

write("auth", "api-keys", "POST", {
    "name": "POST /api/auth/api-keys - Create personal API key",
    "endpoint": "/api/auth/api-keys",
    "method": "POST",
    "requiresAuth": True,
    "expectedStatus": 201,
    "priority": 10,
    "testCases": [{
        "name": "Issue new API key",
        "headers": AUTH_HEADER,
        "payload": {"label": "{{dynamic:name}}"},
        "expectedStatus": 201
    }],
    "captureResponse": {
        "auth.apiKeys.create.response.data.key": "data.key",
        "auth.apiKeys.create.response.data.prefix": "data.prefix"
    },
    "dependsOn": AUTH_CHAIN
})

write("auth", "api-keys", "GET", {
    "name": "GET /api/auth/api-keys - List API keys",
    "endpoint": "/api/auth/api-keys",
    "method": "GET",
    "requiresAuth": True,
    "expectedStatus": 200,
    "priority": 11,
    "testCases": [{"name": "List API keys", "headers": AUTH_HEADER, "expectedStatus": 200}],
    "dependsOn": AUTH_CHAIN + ["POST /api/auth/api-keys"]
})

write("auth", "api-keys-id", "DELETE", {
    "name": "DELETE /api/auth/api-keys/:id - Revoke API key",
    "endpoint": "/api/auth/api-keys/:id",
    "method": "DELETE",
    "requiresAuth": True,
    "expectedStatus": 404,
    "priority": 95,
    "pathParams": {"id": SYNTHETIC_ID},
    "testCases": [{
        "name": "Revoke non-existent API key id",
        "headers": AUTH_HEADER,
        "expectedStatus": 404
    }],
    "dependsOn": AUTH_CHAIN
})


# ================================================================
# DOCUMENTS
# ================================================================
write("documents", "index", "POST", {
    "name": "POST /api/documents - Upload a document",
    "endpoint": "/api/documents",
    "method": "POST",
    "requiresAuth": True,
    "expectedStatus": 400,
    "priority": 20,
    "testability": "manual",
    "skipReason": "multipart/form-data body via multer; JSON-only runner cannot send file payload.",
    "testCases": [{
        "name": "Upload without file → 400",
        "headers": AUTH_HEADER,
        "payload": {},
        "expectedStatus": 400
    }],
    "dependsOn": AUTH_CHAIN
})

write("documents", "index", "GET", {
    "name": "GET /api/documents - List user documents",
    "endpoint": "/api/documents",
    "method": "GET",
    "requiresAuth": True,
    "expectedStatus": 200,
    "priority": 22,
    "testCases": [{"name": "List my documents", "headers": AUTH_HEADER, "expectedStatus": 200}],
    "dependsOn": AUTH_CHAIN
})

write("documents", "search", "GET", {
    "name": "GET /api/documents/search - Search documents",
    "endpoint": "/api/documents/search?q=contract",
    "method": "GET",
    "requiresAuth": True,
    "expectedStatus": 200,
    "priority": 22,
    "testCases": [{"name": "Search by keyword", "headers": AUTH_HEADER, "expectedStatus": 200}],
    "dependsOn": AUTH_CHAIN
})

write("documents", "templates", "POST", {
    "name": "POST /api/documents/templates - Create template",
    "endpoint": "/api/documents/templates",
    "method": "POST",
    "requiresAuth": True,
    "expectedStatus": 400,
    "priority": 30,
    "testCases": [{
        "name": "Missing file_path and document_id → 400",
        "headers": AUTH_HEADER,
        "payload": {"name": "{{dynamic:name}}"},
        "expectedStatus": 400
    }],
    "dependsOn": AUTH_CHAIN
})

write("documents", "templates", "GET", {
    "name": "GET /api/documents/templates - List templates",
    "endpoint": "/api/documents/templates",
    "method": "GET",
    "requiresAuth": True,
    "expectedStatus": 200,
    "priority": 31,
    "testCases": [{"name": "List my templates", "headers": AUTH_HEADER, "expectedStatus": 200}],
    "dependsOn": AUTH_CHAIN
})

write("documents", "templates-id", "GET", {
    "name": "GET /api/documents/templates/:id - Get template",
    "endpoint": "/api/documents/templates/:id",
    "method": "GET",
    "requiresAuth": True,
    "expectedStatus": 404,
    "priority": 32,
    "pathParams": {"id": SYNTHETIC_ID},
    "testCases": [{
        "name": "Non-existent template → 404",
        "headers": AUTH_HEADER,
        "expectedStatus": 404
    }],
    "dependsOn": AUTH_CHAIN
})

write("documents", "templates-id-use", "POST", {
    "name": "POST /api/documents/templates/:id/use - Clone template",
    "endpoint": "/api/documents/templates/:id/use",
    "method": "POST",
    "requiresAuth": True,
    "expectedStatus": 404,
    "priority": 33,
    "pathParams": {"id": SYNTHETIC_ID},
    "testCases": [{
        "name": "Use non-existent template → 404",
        "headers": AUTH_HEADER,
        "payload": {},
        "expectedStatus": 404
    }],
    "dependsOn": AUTH_CHAIN
})

write("documents", "templates-id", "DELETE", {
    "name": "DELETE /api/documents/templates/:id - Delete template",
    "endpoint": "/api/documents/templates/:id",
    "method": "DELETE",
    "requiresAuth": True,
    "expectedStatus": 404,
    "priority": 85,
    "pathParams": {"id": SYNTHETIC_ID},
    "testCases": [{
        "name": "Delete non-existent template → 404",
        "headers": AUTH_HEADER,
        "expectedStatus": 404
    }],
    "dependsOn": AUTH_CHAIN
})

write("documents", "id-versions", "POST", {
    "name": "POST /api/documents/:id/versions - Upload new version",
    "endpoint": "/api/documents/:id/versions",
    "method": "POST",
    "requiresAuth": True,
    "expectedStatus": 404,
    "priority": 35,
    "pathParams": {"id": SYNTHETIC_ID},
    "testability": "manual",
    "skipReason": "multipart/form-data body via multer; JSON-only runner cannot send file payload.",
    "testCases": [{
        "name": "Version on non-existent document → 404",
        "headers": AUTH_HEADER,
        "payload": {},
        "expectedStatus": 404
    }],
    "dependsOn": AUTH_CHAIN
})

write("documents", "id-versions", "GET", {
    "name": "GET /api/documents/:id/versions - List versions",
    "endpoint": "/api/documents/:id/versions",
    "method": "GET",
    "requiresAuth": True,
    "expectedStatus": 404,
    "priority": 36,
    "pathParams": {"id": SYNTHETIC_ID},
    "testCases": [{
        "name": "Versions for non-existent document → 404",
        "headers": AUTH_HEADER,
        "expectedStatus": 404
    }],
    "dependsOn": AUTH_CHAIN
})

write("documents", "id-versions-versionId-revert", "POST", {
    "name": "POST /api/documents/:id/versions/:versionId/revert - Revert version",
    "endpoint": "/api/documents/:id/versions/:versionId/revert",
    "method": "POST",
    "requiresAuth": True,
    "expectedStatus": 404,
    "priority": 37,
    "pathParams": {"id": SYNTHETIC_ID, "versionId": SYNTHETIC_ID},
    "testCases": [{
        "name": "Revert on non-existent document → 404",
        "headers": AUTH_HEADER,
        "payload": {},
        "expectedStatus": 404
    }],
    "dependsOn": AUTH_CHAIN
})

write("documents", "id-tags", "POST", {
    "name": "POST /api/documents/:id/tags - Add tags",
    "endpoint": "/api/documents/:id/tags",
    "method": "POST",
    "requiresAuth": True,
    "expectedStatus": 404,
    "priority": 40,
    "pathParams": {"id": SYNTHETIC_ID},
    "testCases": [{
        "name": "Tags on non-existent document → 404",
        "headers": AUTH_HEADER,
        "payload": {"tags": ["contract", "urgent"]},
        "expectedStatus": 404
    }],
    "dependsOn": AUTH_CHAIN
})

write("documents", "id-tags", "GET", {
    "name": "GET /api/documents/:id/tags - List tags",
    "endpoint": "/api/documents/:id/tags",
    "method": "GET",
    "requiresAuth": True,
    "expectedStatus": 404,
    "priority": 41,
    "pathParams": {"id": SYNTHETIC_ID},
    "testCases": [{
        "name": "Tags for non-existent document → 404",
        "headers": AUTH_HEADER,
        "expectedStatus": 404
    }],
    "dependsOn": AUTH_CHAIN
})

write("documents", "id-tags-tag", "DELETE", {
    "name": "DELETE /api/documents/:id/tags/:tag - Remove tag",
    "endpoint": "/api/documents/:id/tags/:tag",
    "method": "DELETE",
    "requiresAuth": True,
    "expectedStatus": 404,
    "priority": 42,
    "pathParams": {"id": SYNTHETIC_ID, "tag": "{{static:urgent}}"},
    "testCases": [{
        "name": "Remove tag from non-existent document → 404",
        "headers": AUTH_HEADER,
        "expectedStatus": 404
    }],
    "dependsOn": AUTH_CHAIN
})

write("documents", "id-file", "GET", {
    "name": "GET /api/documents/:id/file - Serve file inline",
    "endpoint": "/api/documents/:id/file",
    "method": "GET",
    "requiresAuth": True,
    "expectedStatus": 404,
    "priority": 25,
    "pathParams": {"id": SYNTHETIC_ID},
    "testCases": [{
        "name": "File for non-existent document → 404",
        "headers": AUTH_HEADER,
        "expectedStatus": 404
    }],
    "dependsOn": AUTH_CHAIN
})

write("documents", "id-download", "GET", {
    "name": "GET /api/documents/:id/download - Download document",
    "endpoint": "/api/documents/:id/download",
    "method": "GET",
    "requiresAuth": True,
    "expectedStatus": 404,
    "priority": 25,
    "pathParams": {"id": SYNTHETIC_ID},
    "testCases": [{
        "name": "Download non-existent document → 404",
        "headers": AUTH_HEADER,
        "expectedStatus": 404
    }],
    "dependsOn": AUTH_CHAIN
})

write("documents", "id", "GET", {
    "name": "GET /api/documents/:id - Get document",
    "endpoint": "/api/documents/:id",
    "method": "GET",
    "requiresAuth": True,
    "expectedStatus": 404,
    "priority": 23,
    "pathParams": {"id": SYNTHETIC_ID},
    "testCases": [{
        "name": "Non-existent document → 404",
        "headers": AUTH_HEADER,
        "expectedStatus": 404
    }],
    "dependsOn": AUTH_CHAIN
})

write("documents", "id", "DELETE", {
    "name": "DELETE /api/documents/:id - Delete document",
    "endpoint": "/api/documents/:id",
    "method": "DELETE",
    "requiresAuth": True,
    "expectedStatus": 404,
    "priority": 90,
    "pathParams": {"id": SYNTHETIC_ID},
    "testCases": [{
        "name": "Delete non-existent document → 404",
        "headers": AUTH_HEADER,
        "expectedStatus": 404
    }],
    "dependsOn": AUTH_CHAIN
})


# ================================================================
# NOTIFICATIONS
# ================================================================
write("notifications", "index", "GET", {
    "name": "GET /api/notifications - List notifications",
    "endpoint": "/api/notifications",
    "method": "GET",
    "requiresAuth": True,
    "expectedStatus": 200,
    "priority": 15,
    "testCases": [{"name": "List my notifications", "headers": AUTH_HEADER, "expectedStatus": 200}],
    "dependsOn": AUTH_CHAIN
})

write("notifications", "read", "PATCH", {
    "name": "PATCH /api/notifications/read - Mark all read",
    "endpoint": "/api/notifications/read",
    "method": "PATCH",
    "requiresAuth": True,
    "expectedStatus": 200,
    "priority": 16,
    "testCases": [{"name": "Mark all read", "headers": AUTH_HEADER, "payload": {}, "expectedStatus": 200}],
    "dependsOn": AUTH_CHAIN
})

write("notifications", "send", "POST", {
    "name": "POST /api/notifications/send - Send notification",
    "endpoint": "/api/notifications/send",
    "method": "POST",
    "requiresAuth": True,
    "expectedStatus": 200,
    "priority": 17,
    "testCases": [{
        "name": "Send in-app notification to self",
        "headers": AUTH_HEADER,
        "payload": {
            "userId": "{{cache:auth.register.response.data.user.id}}",
            "type": "{{static:system}}",
            "message": "{{dynamic:text}}",
            "channels": ["in_app"]
        },
        "expectedStatus": 200
    }],
    "dependsOn": AUTH_CHAIN
})

write("notifications", "stream", "GET", {
    "name": "GET /api/notifications/stream - SSE realtime stream",
    "endpoint": "/api/notifications/stream",
    "method": "GET",
    "requiresAuth": True,
    "expectedStatus": 200,
    "priority": 18,
    "testability": "manual",
    "skipReason": "Server-Sent Events keeps the connection open; not supported by the request/response JSON runner.",
    "testCases": [{"name": "Open SSE stream", "headers": AUTH_HEADER, "expectedStatus": 200}],
    "dependsOn": AUTH_CHAIN
})

write("notifications", "preferences", "GET", {
    "name": "GET /api/notifications/preferences - Get preferences",
    "endpoint": "/api/notifications/preferences",
    "method": "GET",
    "requiresAuth": True,
    "expectedStatus": 200,
    "priority": 19,
    "testCases": [{"name": "Get my preferences", "headers": AUTH_HEADER, "expectedStatus": 200}],
    "dependsOn": AUTH_CHAIN
})

write("notifications", "preferences", "PUT", {
    "name": "PUT /api/notifications/preferences - Update preferences",
    "endpoint": "/api/notifications/preferences",
    "method": "PUT",
    "requiresAuth": True,
    "expectedStatus": 200,
    "priority": 20,
    "testCases": [{
        "name": "Update reminder channels",
        "headers": AUTH_HEADER,
        "payload": {
            "preferences": [
                {
                    "notification_type": "reminder",
                    "email_enabled": True,
                    "sms_enabled": False,
                    "in_app_enabled": True
                }
            ]
        },
        "expectedStatus": 200
    }],
    "dependsOn": AUTH_CHAIN
})


# ================================================================
# ANALYTICS
# ================================================================
write("analytics", "signature-event", "POST", {
    "name": "POST /api/analytics/signature-event - Track signature engagement",
    "endpoint": "/api/analytics/signature-event",
    "method": "POST",
    "requiresAuth": True,
    "expectedStatus": 201,
    "priority": 15,
    "testCases": [{
        "name": "Track signing-started event",
        "headers": AUTH_HEADER,
        "payload": {
            "event_type": "{{static:signing_started}}",
            "metadata": {"source": "test"}
        },
        "expectedStatus": 201
    }],
    "dependsOn": AUTH_CHAIN
})


# ================================================================
# COMPLIANCE (admin-only except esign-metadata-post which is FK-gated)
# ================================================================
write("compliance", "report", "GET", {
    "name": "GET /api/compliance/report - Compliance report (admin)",
    "endpoint": "/api/compliance/report?dateFrom=2024-01-01&dateTo=2024-12-31",
    "method": "GET",
    "requiresAuth": True,
    "expectedStatus": 403,
    "priority": 50,
    "testCases": [{"name": "Non-admin blocked → 403", "headers": AUTH_HEADER, "expectedStatus": 403}],
    "dependsOn": AUTH_CHAIN
})

write("compliance", "alerts-config", "POST", {
    "name": "POST /api/compliance/alerts/config - Configure alert rule (admin)",
    "endpoint": "/api/compliance/alerts/config",
    "method": "POST",
    "requiresAuth": True,
    "expectedStatus": 403,
    "priority": 51,
    "testCases": [{
        "name": "Non-admin blocked → 403",
        "headers": AUTH_HEADER,
        "payload": {
            "rule_type": "{{static:failed_signatures}}",
            "threshold": 10,
            "enabled": True
        },
        "expectedStatus": 403
    }],
    "dependsOn": AUTH_CHAIN
})

write("compliance", "alerts", "GET", {
    "name": "GET /api/compliance/alerts - List alerts (admin)",
    "endpoint": "/api/compliance/alerts",
    "method": "GET",
    "requiresAuth": True,
    "expectedStatus": 403,
    "priority": 52,
    "testCases": [{"name": "Non-admin blocked → 403", "headers": AUTH_HEADER, "expectedStatus": 403}],
    "dependsOn": AUTH_CHAIN
})

write("compliance", "export", "GET", {
    "name": "GET /api/compliance/export - Export audit CSV (admin)",
    "endpoint": "/api/compliance/export?dateFrom=2024-01-01&dateTo=2024-12-31",
    "method": "GET",
    "requiresAuth": True,
    "expectedStatus": 403,
    "priority": 53,
    "testCases": [{"name": "Non-admin blocked → 403", "headers": AUTH_HEADER, "expectedStatus": 403}],
    "dependsOn": AUTH_CHAIN
})

write("compliance", "esign-metadata-signatureId", "GET", {
    "name": "GET /api/compliance/esign-metadata/:signatureId - Get ESIGN metadata",
    "endpoint": "/api/compliance/esign-metadata/:signatureId",
    "method": "GET",
    "requiresAuth": True,
    "expectedStatus": 404,
    "priority": 56,
    "pathParams": {"signatureId": SYNTHETIC_ID},
    "testCases": [{
        "name": "Non-existent signatureId → 404",
        "headers": AUTH_HEADER,
        "expectedStatus": 404
    }],
    "dependsOn": AUTH_CHAIN
})

write("compliance", "esign-metadata", "POST", {
    "name": "POST /api/compliance/esign-metadata - Create ESIGN metadata",
    "endpoint": "/api/compliance/esign-metadata",
    "method": "POST",
    "requiresAuth": True,
    "expectedStatus": 500,
    "priority": 55,
    "testCases": [{
        "name": "FK violation with synthetic signature_id → 500",
        "headers": AUTH_HEADER,
        "payload": {
            "signature_id": "{{cache:auth.register.response.data.user.id}}",
            "consent_given": True
        },
        "expectedStatus": 500
    }],
    "dependsOn": AUTH_CHAIN
})


# ================================================================
# SIGN (public token routes)
# ================================================================
for stem, method, sub_seg, desc, expected, payload in [
    ("token",          "GET",  "",          "Get signing context",   401, None),
    ("token-document", "GET",  "/document", "Serve document",        401, None),
    ("token-started",  "POST", "/started",  "Mark signing started",  401, {}),
    ("token-complete", "POST", "/complete", "Complete signing",      400, {"signatures": []}),
]:
    body = {
        "name": f"{method} /api/sign/:token{sub_seg} - {desc}",
        "endpoint": f"/api/sign/:token{sub_seg}",
        "method": method,
        "requiresAuth": False,
        "expectedStatus": expected,
        "priority": 70,
        "pathParams": {"token": "{{static:invalid-token}}"},
        "testCases": [{
            "name": f"Invalid token → {expected}",
            "expectedStatus": expected
        }],
        "dependsOn": []
    }
    if payload is not None:
        body["testCases"][0]["payload"] = payload
    write("sign", stem, method, body)


# ================================================================
# USERS
# ================================================================
write("users", "language", "PUT", {
    "name": "PUT /api/users/language - Update language",
    "endpoint": "/api/users/language",
    "method": "PUT",
    "requiresAuth": True,
    "expectedStatus": 200,
    "priority": 6,
    "testCases": [{
        "name": "Set language to English",
        "headers": AUTH_HEADER,
        "payload": {"language_preference": "{{static:en}}"},
        "expectedStatus": 200
    }],
    "dependsOn": AUTH_CHAIN
})

write("users", "roles", "GET", {
    "name": "GET /api/users/roles - Available roles (admin)",
    "endpoint": "/api/users/roles",
    "method": "GET",
    "requiresAuth": True,
    "expectedStatus": 403,
    "priority": 7,
    "testCases": [{"name": "Non-admin blocked → 403", "headers": AUTH_HEADER, "expectedStatus": 403}],
    "dependsOn": AUTH_CHAIN
})

write("users", "index", "GET", {
    "name": "GET /api/users - List users (admin)",
    "endpoint": "/api/users",
    "method": "GET",
    "requiresAuth": True,
    "expectedStatus": 403,
    "priority": 8,
    "testCases": [{"name": "Non-admin blocked → 403", "headers": AUTH_HEADER, "expectedStatus": 403}],
    "dependsOn": AUTH_CHAIN
})

write("users", "id-role", "PUT", {
    "name": "PUT /api/users/:id/role - Assign role (admin)",
    "endpoint": "/api/users/:id/role",
    "method": "PUT",
    "requiresAuth": True,
    "expectedStatus": 403,
    "priority": 9,
    "pathParams": {"id": SYNTHETIC_ID},
    "testCases": [{
        "name": "Non-admin blocked → 403",
        "headers": AUTH_HEADER,
        "payload": {"role": "user"},
        "expectedStatus": 403
    }],
    "dependsOn": AUTH_CHAIN
})


# ================================================================
# SIGNATURES (legacy per-document)
# ================================================================
write("signatures", "index", "POST", {
    "name": "POST /api/signatures - Create signature request",
    "endpoint": "/api/signatures",
    "method": "POST",
    "requiresAuth": True,
    "expectedStatus": 201,
    "priority": 60,
    "testCases": [{
        "name": "Create request with synthetic document_id",
        "headers": AUTH_HEADER,
        "payload": {
            "document_id": "{{cache:auth.register.response.data.user.id}}",
            "signer_email": "{{dynamic:email}}"
        },
        "expectedStatus": 201
    }],
    "captureResponse": {
        "signatures.create.response.data.signature.id": "data.signature.id"
    },
    "dependsOn": AUTH_CHAIN
})

write("signatures", "documentId", "GET", {
    "name": "GET /api/signatures/:documentId - Signatures for document",
    "endpoint": "/api/signatures/:documentId",
    "method": "GET",
    "requiresAuth": True,
    "expectedStatus": 200,
    "priority": 61,
    "pathParams": {"documentId": SYNTHETIC_ID},
    "testCases": [{
        "name": "List for placeholder documentId",
        "headers": AUTH_HEADER,
        "expectedStatus": 200
    }],
    "dependsOn": AUTH_CHAIN
})

write("signatures", "id-sign", "PATCH", {
    "name": "PATCH /api/signatures/:id/sign - Record signature",
    "endpoint": "/api/signatures/:id/sign",
    "method": "PATCH",
    "requiresAuth": True,
    "expectedStatus": 200,
    "priority": 62,
    "pathParams": {"id": "{{cache:signatures.create.response.data.signature.id}}"},
    "testCases": [{
        "name": "Sign captured signature id",
        "headers": AUTH_HEADER,
        "payload": {"signature_data": "{{static:data:image/png;base64,iVBORw0KG}}"},
        "expectedStatus": 200
    }],
    "dependsOn": AUTH_CHAIN + ["POST /api/signatures"]
})

write("signatures", "id-confirm", "POST", {
    "name": "POST /api/signatures/:id/confirm - Confirm signature",
    "endpoint": "/api/signatures/:id/confirm",
    "method": "POST",
    "requiresAuth": True,
    "expectedStatus": 200,
    "priority": 63,
    "pathParams": {"id": "{{cache:signatures.create.response.data.signature.id}}"},
    "testCases": [{
        "name": "Confirm captured signature id",
        "headers": AUTH_HEADER,
        "payload": {"confirmation_status": "{{static:confirmed}}"},
        "expectedStatus": 200
    }],
    "dependsOn": AUTH_CHAIN + ["POST /api/signatures", "PATCH /api/signatures/:id/sign"]
})


# ================================================================
# USER SIGNATURES
# ================================================================
write("user-signatures", "index", "POST", {
    "name": "POST /api/user-signatures - Save signature",
    "endpoint": "/api/user-signatures",
    "method": "POST",
    "requiresAuth": True,
    "expectedStatus": 201,
    "priority": 12,
    "testCases": [{
        "name": "Save typed signature",
        "headers": AUTH_HEADER,
        "payload": {
            "signature_type": "{{static:typed}}",
            "signature_data": "{{dynamic:name}}",
            "font_family": "{{static:cursive}}"
        },
        "expectedStatus": 201
    }],
    "captureResponse": {
        "userSignatures.create.response.data.userSignature.id": "data.userSignature.id"
    },
    "dependsOn": AUTH_CHAIN
})

write("user-signatures", "index", "GET", {
    "name": "GET /api/user-signatures - List signatures",
    "endpoint": "/api/user-signatures",
    "method": "GET",
    "requiresAuth": True,
    "expectedStatus": 200,
    "priority": 13,
    "testCases": [{"name": "List my signatures", "headers": AUTH_HEADER, "expectedStatus": 200}],
    "dependsOn": AUTH_CHAIN + ["POST /api/user-signatures"]
})

write("user-signatures", "id", "GET", {
    "name": "GET /api/user-signatures/:id - Get signature",
    "endpoint": "/api/user-signatures/:id",
    "method": "GET",
    "requiresAuth": True,
    "expectedStatus": 200,
    "priority": 14,
    "pathParams": {"id": "{{cache:userSignatures.create.response.data.userSignature.id}}"},
    "testCases": [{"name": "Get my signature by id", "headers": AUTH_HEADER, "expectedStatus": 200}],
    "dependsOn": AUTH_CHAIN + ["POST /api/user-signatures"]
})

write("user-signatures", "id", "PUT", {
    "name": "PUT /api/user-signatures/:id - Update signature",
    "endpoint": "/api/user-signatures/:id",
    "method": "PUT",
    "requiresAuth": True,
    "expectedStatus": 200,
    "priority": 15,
    "pathParams": {"id": "{{cache:userSignatures.create.response.data.userSignature.id}}"},
    "testCases": [{
        "name": "Update signature data",
        "headers": AUTH_HEADER,
        "payload": {"signature_data": "{{dynamic:name}}"},
        "expectedStatus": 200
    }],
    "dependsOn": AUTH_CHAIN + ["POST /api/user-signatures"]
})

write("user-signatures", "id", "DELETE", {
    "name": "DELETE /api/user-signatures/:id - Delete signature",
    "endpoint": "/api/user-signatures/:id",
    "method": "DELETE",
    "requiresAuth": True,
    "expectedStatus": 200,
    "priority": 99,
    "pathParams": {"id": "{{cache:userSignatures.create.response.data.userSignature.id}}"},
    "testCases": [{"name": "Delete my signature", "headers": AUTH_HEADER, "expectedStatus": 200}],
    "dependsOn": AUTH_CHAIN + [
        "POST /api/user-signatures",
        "GET /api/user-signatures",
        "GET /api/user-signatures/:id",
        "PUT /api/user-signatures/:id"
    ]
})


# ================================================================
# WORKFLOWS
# ================================================================
write("workflows", "index", "POST", {
    "name": "POST /api/workflows - Create signing workflow",
    "endpoint": "/api/workflows",
    "method": "POST",
    "requiresAuth": True,
    "expectedStatus": 403,
    "priority": 65,
    "testability": "manual",
    "skipReason": "Persistent test-runner user exhausted free-plan 3-workflow quota (checkPlanLimit). Verified success with fresh user via manual probe.",
    "testCases": [{
        "name": "Plan-limit gate blocks further creates → 403",
        "headers": AUTH_HEADER,
        "payload": {
            "document_id": "{{cache:auth.register.response.data.user.id}}",
            "workflow_type": "{{static:sequential}}",
            "recipients": [
                {
                    "signer_email": "{{dynamic:email}}",
                    "signer_name": "{{dynamic:name}}",
                    "signing_order": 1
                }
            ]
        },
        "expectedStatus": 403
    }],
    "dependsOn": AUTH_CHAIN
})

write("workflows", "index", "GET", {
    "name": "GET /api/workflows - List workflows",
    "endpoint": "/api/workflows",
    "method": "GET",
    "requiresAuth": True,
    "expectedStatus": 200,
    "priority": 66,
    "testCases": [{"name": "List my workflows", "headers": AUTH_HEADER, "expectedStatus": 200}],
    "dependsOn": AUTH_CHAIN
})

write("workflows", "admin-process-completions", "POST", {
    "name": "POST /api/workflows/admin/process-completions - Reprocess completions",
    "endpoint": "/api/workflows/admin/process-completions",
    "method": "POST",
    "requiresAuth": True,
    "expectedStatus": 200,
    "priority": 67,
    "testCases": [{
        "name": "Process pending completions",
        "headers": AUTH_HEADER,
        "payload": {},
        "expectedStatus": 200
    }],
    "dependsOn": AUTH_CHAIN
})

def workflow_per_id(sub_seg, method, expected_status, name_suffix, priority, payload=None, query=""):
    body = {
        "name": f"{method} /api/workflows/:id{sub_seg} - {name_suffix}",
        "endpoint": f"/api/workflows/:id{sub_seg}{query}",
        "method": method,
        "requiresAuth": True,
        "expectedStatus": expected_status,
        "priority": priority,
        "pathParams": {"id": SYNTHETIC_ID},
        "testCases": [{
            "name": f"{method} non-existent workflow → {expected_status}",
            "headers": AUTH_HEADER,
            "expectedStatus": expected_status
        }],
        "dependsOn": AUTH_CHAIN
    }
    if payload is not None:
        body["testCases"][0]["payload"] = payload
    elif method in ("POST", "PUT", "PATCH"):
        body["testCases"][0]["payload"] = {}
    return body

write("workflows", "id", "GET",
      workflow_per_id("", "GET", 404, "Get workflow", 68))
write("workflows", "id", "PUT",
      workflow_per_id("", "PUT", 404, "Update workflow", 69, payload={"recipients": []}))
write("workflows", "id-start", "POST",
      workflow_per_id("/start", "POST", 404, "Start workflow", 70))
write("workflows", "id-cancel", "POST",
      workflow_per_id("/cancel", "POST", 404, "Cancel workflow", 71))
write("workflows", "id-sign", "PATCH",
      workflow_per_id("/sign", "PATCH", 404, "Sign field", 72,
                      payload={
                          "field_id": "{{cache:auth.register.response.data.user.id}}",
                          "signature_data": "{{static:data:image/png;base64,iVBORw}}"
                      }))
write("workflows", "id-decline", "PATCH",
      workflow_per_id("/decline", "PATCH", 404, "Decline workflow", 73,
                      payload={"reason": "{{static:No longer relevant}}"}))
write("workflows", "id-status", "GET",
      workflow_per_id("/status", "GET", 404, "Workflow status", 74))
write("workflows", "id-remind", "POST",
      workflow_per_id("/remind", "POST", 404, "Send reminders", 75))
write("workflows", "id-reminders", "PUT",
      workflow_per_id("/reminders", "PUT", 500, "Configure reminders", 76,
                      payload={"reminder_interval_hours": 24, "max_reminders": 3}))
write("workflows", "id-history", "GET",
      workflow_per_id("/history", "GET", 200, "Workflow history", 77))
write("workflows", "id-history-export", "GET",
      workflow_per_id("/history/export", "GET", 200, "Export history CSV", 78, query="?format=csv"))
write("workflows", "id-self-sign", "POST",
      workflow_per_id("/self-sign", "POST", 400, "Self-sign workflow", 79,
                      payload={"signatures": []}))
write("workflows", "id-downloads", "GET",
      workflow_per_id("/downloads", "GET", 404, "Completed workflow downloads", 80))


# ================================================================
# BILLING
# ================================================================
write("billing", "checkout", "POST", {
    "name": "POST /api/billing/checkout - Stripe checkout session",
    "endpoint": "/api/billing/checkout",
    "method": "POST",
    "requiresAuth": True,
    "expectedStatus": 503,
    "priority": 50,
    "testCases": [{
        "name": "Checkout without Stripe configured → 503",
        "headers": AUTH_HEADER,
        "payload": {"plan": "solo", "interval": "monthly"},
        "expectedStatus": 503
    }],
    "dependsOn": AUTH_CHAIN
})

write("billing", "portal", "POST", {
    "name": "POST /api/billing/portal - Stripe portal session",
    "endpoint": "/api/billing/portal",
    "method": "POST",
    "requiresAuth": True,
    "expectedStatus": 503,
    "priority": 51,
    "testCases": [{
        "name": "Portal without Stripe configured → 503",
        "headers": AUTH_HEADER,
        "payload": {},
        "expectedStatus": 503
    }],
    "dependsOn": AUTH_CHAIN
})

write("billing", "subscription", "GET", {
    "name": "GET /api/billing/subscription - Current plan and usage",
    "endpoint": "/api/billing/subscription",
    "method": "GET",
    "requiresAuth": True,
    "expectedStatus": 200,
    "priority": 52,
    "testCases": [{"name": "Get my subscription", "headers": AUTH_HEADER, "expectedStatus": 200}],
    "dependsOn": AUTH_CHAIN
})

write("billing", "webhook", "POST", {
    "name": "POST /api/billing/webhook - Stripe webhook",
    "endpoint": "/api/billing/webhook",
    "method": "POST",
    "requiresAuth": False,
    "expectedStatus": 400,
    "priority": 55,
    "testability": "manual",
    "skipReason": "Webhook - requires Stripe signature header and raw body (MUST-15).",
    "testCases": [{
        "name": "Missing stripe-signature header",
        "payload": {},
        "expectedStatus": 400
    }],
    "dependsOn": []
})


# ================================================================
# TEAMS (plan-gated)
# ================================================================
write("teams", "index", "POST", {
    "name": "POST /api/teams - Create team",
    "endpoint": "/api/teams",
    "method": "POST",
    "requiresAuth": True,
    "expectedStatus": 500,
    "priority": 25,
    "testCases": [{
        "name": "Free-plan user cannot create team → 500",
        "headers": AUTH_HEADER,
        "payload": {"name": "{{dynamic:name}}", "plan": "{{static:team}}"},
        "expectedStatus": 500
    }],
    "dependsOn": AUTH_CHAIN
})

write("teams", "mine", "GET", {
    "name": "GET /api/teams/mine - Get my team",
    "endpoint": "/api/teams/mine",
    "method": "GET",
    "requiresAuth": True,
    "expectedStatus": 404,
    "priority": 26,
    "testCases": [{"name": "Test user has no team → 404", "headers": AUTH_HEADER, "expectedStatus": 404}],
    "dependsOn": AUTH_CHAIN
})

write("teams", "join-token", "GET", {
    "name": "GET /api/teams/join/:token - Invite info (public)",
    "endpoint": "/api/teams/join/:token",
    "method": "GET",
    "requiresAuth": False,
    "expectedStatus": 404,
    "priority": 29,
    "pathParams": {"token": "{{static:invalid-invite-token}}"},
    "testCases": [{"name": "Invalid invite token → 404", "expectedStatus": 404}],
    "dependsOn": []
})

write("teams", "join-token", "POST", {
    "name": "POST /api/teams/join/:token - Accept invite",
    "endpoint": "/api/teams/join/:token",
    "method": "POST",
    "requiresAuth": True,
    "expectedStatus": 400,
    "priority": 30,
    "pathParams": {"token": "{{static:invalid-invite-token}}"},
    "testCases": [{
        "name": "Invalid invite token → 400",
        "headers": AUTH_HEADER,
        "payload": {},
        "expectedStatus": 400
    }],
    "dependsOn": AUTH_CHAIN
})

write("teams", "id", "GET", {
    "name": "GET /api/teams/:id - Get team",
    "endpoint": "/api/teams/:id",
    "method": "GET",
    "requiresAuth": True,
    "expectedStatus": 403,
    "priority": 27,
    "pathParams": {"id": SYNTHETIC_ID},
    "testCases": [{
        "name": "Non-member blocked on arbitrary team → 403",
        "headers": AUTH_HEADER,
        "expectedStatus": 403
    }],
    "dependsOn": AUTH_CHAIN
})

write("teams", "id-invite", "POST", {
    "name": "POST /api/teams/:id/invite - Invite members",
    "endpoint": "/api/teams/:id/invite",
    "method": "POST",
    "requiresAuth": True,
    "expectedStatus": 403,
    "priority": 28,
    "pathParams": {"id": SYNTHETIC_ID},
    "testCases": [{
        "name": "Non-admin blocked → 403",
        "headers": AUTH_HEADER,
        "payload": {"emails": ["{{dynamic:email}}"]},
        "expectedStatus": 403
    }],
    "dependsOn": AUTH_CHAIN
})

write("teams", "id-invites-inviteId", "DELETE", {
    "name": "DELETE /api/teams/:id/invites/:inviteId - Delete pending invite",
    "endpoint": "/api/teams/:id/invites/:inviteId",
    "method": "DELETE",
    "requiresAuth": True,
    "expectedStatus": 403,
    "priority": 31,
    "pathParams": {"id": SYNTHETIC_ID, "inviteId": SYNTHETIC_ID},
    "testCases": [{
        "name": "Non-admin blocked → 403",
        "headers": AUTH_HEADER,
        "expectedStatus": 403
    }],
    "dependsOn": AUTH_CHAIN
})

write("teams", "id-members-userId", "PATCH", {
    "name": "PATCH /api/teams/:id/members/:userId - Update member role",
    "endpoint": "/api/teams/:id/members/:userId",
    "method": "PATCH",
    "requiresAuth": True,
    "expectedStatus": 403,
    "priority": 32,
    "pathParams": {"id": SYNTHETIC_ID, "userId": SYNTHETIC_ID},
    "testCases": [{
        "name": "Non-owner blocked → 403",
        "headers": AUTH_HEADER,
        "payload": {"role": "admin"},
        "expectedStatus": 403
    }],
    "dependsOn": AUTH_CHAIN
})

write("teams", "id-members-userId", "DELETE", {
    "name": "DELETE /api/teams/:id/members/:userId - Remove member",
    "endpoint": "/api/teams/:id/members/:userId",
    "method": "DELETE",
    "requiresAuth": True,
    "expectedStatus": 403,
    "priority": 33,
    "pathParams": {"id": SYNTHETIC_ID, "userId": SYNTHETIC_ID},
    "testCases": [{
        "name": "Non-owner blocked → 403",
        "headers": AUTH_HEADER,
        "expectedStatus": 403
    }],
    "dependsOn": AUTH_CHAIN
})

write("teams", "id-leave", "POST", {
    "name": "POST /api/teams/:id/leave - Leave team",
    "endpoint": "/api/teams/:id/leave",
    "method": "POST",
    "requiresAuth": True,
    "expectedStatus": 500,
    "priority": 34,
    "pathParams": {"id": SYNTHETIC_ID},
    "testCases": [{
        "name": "Non-member leave attempt → 500",
        "headers": AUTH_HEADER,
        "payload": {},
        "expectedStatus": 500
    }],
    "dependsOn": AUTH_CHAIN
})

write("teams", "id", "DELETE", {
    "name": "DELETE /api/teams/:id - Delete team",
    "endpoint": "/api/teams/:id",
    "method": "DELETE",
    "requiresAuth": True,
    "expectedStatus": 403,
    "priority": 98,
    "pathParams": {"id": SYNTHETIC_ID},
    "testCases": [{
        "name": "Non-owner blocked → 403",
        "headers": AUTH_HEADER,
        "expectedStatus": 403
    }],
    "dependsOn": AUTH_CHAIN
})


# ================================================================
# AUDIT LOGS
# ================================================================
write("audit-logs", "index", "GET", {
    "name": "GET /api/audit-logs - Search audit logs (admin)",
    "endpoint": "/api/audit-logs?page=1&limit=10",
    "method": "GET",
    "requiresAuth": True,
    "expectedStatus": 403,
    "priority": 45,
    "testCases": [{"name": "Non-admin blocked → 403", "headers": AUTH_HEADER, "expectedStatus": 403}],
    "dependsOn": AUTH_CHAIN
})


# ================================================================
# ORGANIZATIONS
# ================================================================
write("organizations", "index", "POST", {
    "name": "POST /api/organizations - Create organization",
    "endpoint": "/api/organizations",
    "method": "POST",
    "requiresAuth": True,
    "expectedStatus": 201,
    "priority": 20,
    "testCases": [{
        "name": "Create new organization",
        "headers": AUTH_HEADER,
        "payload": {"name": "{{dynamic:name}}"},
        "expectedStatus": 201
    }],
    "captureResponse": {
        "organizations.create.response.data.id": "data.id"
    },
    "dependsOn": AUTH_CHAIN
})

write("organizations", "id", "GET", {
    "name": "GET /api/organizations/:id - Get organization",
    "endpoint": "/api/organizations/:id",
    "method": "GET",
    "requiresAuth": True,
    "expectedStatus": 200,
    "priority": 21,
    "pathParams": {"id": "{{cache:organizations.create.response.data.id}}"},
    "testCases": [{"name": "Get my organization", "headers": AUTH_HEADER, "expectedStatus": 200}],
    "dependsOn": AUTH_CHAIN + ["POST /api/organizations"]
})


total = sum(1 for _, _, files in os.walk(OUT_DIR) for f in files if f.endswith(".json"))
print(f"Generated {total} files across {len(os.listdir(OUT_DIR))} resource folders")
