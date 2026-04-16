#!/usr/bin/env bash
# Manual cascade test that exercises every endpoint touched by the MCP API
# test definitions, in dependency order. Mirrors what the projexlight runner
# would do if its auto_detect_server worked.
#
# Outputs one line per endpoint: PASS / FAIL <code> / SKIP <reason>.
# Final summary mirrors the MCP runner's totals.

set -u
BASE="http://localhost:3002"
PASS=0
FAIL=0
SKIP=0
RESULTS=()

run() {
  local name="$1" expected="$2" method="$3" path="$4" body="${5-}" auth="${6-}"
  local hdr=(-H "Content-Type: application/json")
  [ -n "$auth" ] && hdr+=(-H "Authorization: Bearer $auth")
  local args=(-s -o /tmp/_resp.txt -w "%{http_code}" -X "$method" "${hdr[@]}")
  [ -n "$body" ] && args+=(-d "$body")
  local code
  code=$(curl "${args[@]}" "$BASE$path")
  if [ "$code" = "$expected" ]; then
    PASS=$((PASS+1))
    RESULTS+=("PASS  $code  $method $path  ($name)")
  else
    FAIL=$((FAIL+1))
    local snippet
    snippet=$(head -c 200 /tmp/_resp.txt)
    RESULTS+=("FAIL  $code (expected $expected)  $method $path  ($name) -- $snippet")
  fi
}

skip() {
  SKIP=$((SKIP+1))
  RESULTS+=("SKIP  $1")
}

# Generate unique email for this run
SUFFIX=$(date +%s)$RANDOM
EMAIL="testuser_${SUFFIX}@example.com"
PASSWORD="TestPass@1234"
ORG_NAME="Test Org $SUFFIX"

echo "=== 1. POST /api/auth/register ==="
REG_BODY="{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"name\":\"Test User\"}"
REG_CODE=$(curl -s -o /tmp/_reg.txt -w "%{http_code}" -X POST -H "Content-Type: application/json" -d "$REG_BODY" "$BASE/api/auth/register")
if [ "$REG_CODE" = "201" ]; then
  PASS=$((PASS+1))
  RESULTS+=("PASS  201  POST /api/auth/register  (Register)")
  TOKEN=$(jq -r '.data.token' /tmp/_reg.txt)
  USER_ID=$(jq -r '.data.user.id' /tmp/_reg.txt)
  echo "  token: ${TOKEN:0:30}..."
  echo "  user_id: $USER_ID"
else
  FAIL=$((FAIL+1))
  RESULTS+=("FAIL  $REG_CODE  POST /api/auth/register  -- $(head -c 200 /tmp/_reg.txt)")
  TOKEN=""
  USER_ID=""
fi

echo "=== 2. POST /api/auth/login ==="
run "Login with captured email" 200 POST /api/auth/login "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}"

echo "=== 3. POST /api/auth/forgot-password ==="
FP_CODE=$(curl -s -o /tmp/_fp.txt -w "%{http_code}" -X POST -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL\"}" "$BASE/api/auth/forgot-password")
if [ "$FP_CODE" = "200" ]; then
  PASS=$((PASS+1))
  RESULTS+=("PASS  200  POST /api/auth/forgot-password")
  RESET_TOKEN=$(jq -r '.data.resetToken' /tmp/_fp.txt)
else
  FAIL=$((FAIL+1))
  RESULTS+=("FAIL  $FP_CODE  POST /api/auth/forgot-password -- $(head -c 200 /tmp/_fp.txt)")
  RESET_TOKEN=""
fi

echo "=== 4. POST /api/auth/reset-password ==="
if [ -n "$RESET_TOKEN" ]; then
  run "Reset password with valid token" 200 POST /api/auth/reset-password "{\"token\":\"$RESET_TOKEN\",\"password\":\"NewPass@1234\"}"
else
  skip "POST /api/auth/reset-password (no resetToken captured)"
fi
# negative case
run "Reset password reject invalid token" 400 POST /api/auth/reset-password "{\"token\":\"invalid-token-value\",\"password\":\"NewPass@1234\"}"

echo "=== 5. POST /api/documents (JSON stub) ==="
DOC_CODE=$(curl -s -o /tmp/_doc.txt -w "%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"file_path\":\"stub-${SUFFIX}.pdf\",\"original_name\":\"stub-${SUFFIX}.pdf\",\"mime_type\":\"application/pdf\"}" \
  "$BASE/api/documents")
if [ "$DOC_CODE" = "201" ]; then
  PASS=$((PASS+1))
  RESULTS+=("PASS  201  POST /api/documents (JSON stub)")
  DOC_ID=$(jq -r '.data.document.id' /tmp/_doc.txt)
  echo "  document_id: $DOC_ID"
else
  FAIL=$((FAIL+1))
  RESULTS+=("FAIL  $DOC_CODE  POST /api/documents -- $(head -c 200 /tmp/_doc.txt)")
  DOC_ID=""
fi

echo "=== 6. GET /api/documents ==="
run "List documents" 200 GET /api/documents "" "$TOKEN"

echo "=== 7. GET /api/documents/:id ==="
if [ -n "$DOC_ID" ]; then
  run "Get document by id" 200 GET "/api/documents/$DOC_ID" "" "$TOKEN"
else
  skip "GET /api/documents/:id (no doc_id)"
fi

echo "=== 8. POST /api/organizations ==="
ORG_CODE=$(curl -s -o /tmp/_org.txt -w "%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"name\":\"$ORG_NAME\"}" \
  "$BASE/api/organizations")
if [ "$ORG_CODE" = "201" ]; then
  PASS=$((PASS+1))
  RESULTS+=("PASS  201  POST /api/organizations")
  ORG_ID=$(jq -r '.data.id' /tmp/_org.txt)
else
  FAIL=$((FAIL+1))
  RESULTS+=("FAIL  $ORG_CODE  POST /api/organizations -- $(head -c 200 /tmp/_org.txt)")
  ORG_ID=""
fi
# duplicate case
run "Reject duplicate organization name" 409 POST /api/organizations "{\"name\":\"$ORG_NAME\"}" "$TOKEN"

echo "=== 9. GET /api/organizations/:id ==="
if [ -n "$ORG_ID" ]; then
  run "Get organization by id" 200 GET "/api/organizations/$ORG_ID" "" "$TOKEN"
else
  skip "GET /api/organizations/:id (no org_id)"
fi

echo "=== 10. POST /api/compliance/alerts/config ==="
run "Create compliance alert rule (admin only)" 201 POST /api/compliance/alerts/config "{\"rule_type\":\"unauthorized_access\",\"threshold\":5,\"enabled\":true}" "$TOKEN"

echo "=== 11. POST /api/analytics/signature-event ==="
run "Track signature event" 201 POST /api/analytics/signature-event "{\"event_type\":\"signature_viewed\",\"metadata\":{\"document_id\":\"test\",\"duration_ms\":5000}}" "$TOKEN"

echo "=== 12. GET /api/users/roles ==="
run "List available roles" 200 GET /api/users/roles "" "$TOKEN"

echo "=== 13. GET /api/users ==="
run "List users (admin)" 200 GET /api/users "" "$TOKEN"

echo "=== 14. GET /api/audit-logs ==="
run "List audit logs" 200 GET /api/audit-logs "" "$TOKEN"

echo "=== 15. GET /api/compliance/alerts ==="
run "List compliance alerts" 200 GET /api/compliance/alerts "" "$TOKEN"

echo "=== 16. GET /api/compliance/export ==="
run "Compliance export" 200 GET "/api/compliance/export?dateFrom=2024-01-01T00:00:00Z&dateTo=2030-12-31T23:59:59Z" "" "$TOKEN"

echo "=== 17. GET /api/compliance/report ==="
run "Compliance report" 200 GET "/api/compliance/report?dateFrom=2024-01-01T00:00:00Z&dateTo=2030-12-31T23:59:59Z" "" "$TOKEN"

echo "=== 18. GET /api/compliance/esign-metadata/:id (negative) ==="
run "Esign metadata 404 path" 404 GET "/api/compliance/esign-metadata/00000000-0000-0000-0000-000000000000" "" "$TOKEN"

echo "=== 19. PUT /api/users/language ==="
run "Update user language" 200 PUT /api/users/language "{\"language_preference\":\"es\"}" "$TOKEN"

echo "=== 20. POST /api/workflows ==="
WF_BODY="{\"document_id\":\"$DOC_ID\",\"workflow_type\":\"sequential\",\"recipients\":[{\"signer_email\":\"r1_${SUFFIX}@ex.com\",\"signer_name\":\"R1\",\"signing_order\":1},{\"signer_email\":\"r2_${SUFFIX}@ex.com\",\"signer_name\":\"R2\",\"signing_order\":2}],\"fields\":[{\"recipient_index\":0,\"field_type\":\"signature\",\"page\":1,\"x\":100,\"y\":500,\"width\":200,\"height\":50}]}"
WF_CODE=$(curl -s -o /tmp/_wf.txt -w "%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "$WF_BODY" \
  "$BASE/api/workflows")
if [ "$WF_CODE" = "201" ]; then
  PASS=$((PASS+1))
  RESULTS+=("PASS  201  POST /api/workflows")
  WF_ID=$(jq -r '.data.workflow.id' /tmp/_wf.txt)
else
  FAIL=$((FAIL+1))
  RESULTS+=("FAIL  $WF_CODE  POST /api/workflows -- $(head -c 200 /tmp/_wf.txt)")
  WF_ID=""
fi

echo "=== 21. GET /api/workflows/:id ==="
if [ -n "$WF_ID" ]; then
  run "Get workflow by id" 200 GET "/api/workflows/$WF_ID" "" "$TOKEN"
else
  skip "GET /api/workflows/:id (no workflow_id)"
fi

echo "=== 22. POST /api/workflows/:id/start ==="
if [ -n "$WF_ID" ]; then
  run "Start workflow" 200 POST "/api/workflows/$WF_ID/start" "{}" "$TOKEN"
else
  skip "POST /api/workflows/:id/start (no workflow_id)"
fi

echo "=== 23. PUT /api/workflows/:id/reminders (the bug we fixed) ==="
if [ -n "$WF_ID" ]; then
  run "Configure reminders (was 500 inconsistent types)" 200 PUT "/api/workflows/$WF_ID/reminders" "{\"reminder_interval_hours\":24}" "$TOKEN"
else
  skip "PUT /api/workflows/:id/reminders (no workflow_id)"
fi

echo "=== 24. GET /api/workflows/:id/status ==="
if [ -n "$WF_ID" ]; then
  run "Workflow status" 200 GET "/api/workflows/$WF_ID/status" "" "$TOKEN"
else
  skip "GET /api/workflows/:id/status (no workflow_id)"
fi

echo "=== 25. GET /api/workflows/:id/history ==="
if [ -n "$WF_ID" ]; then
  run "Workflow history" 200 GET "/api/workflows/$WF_ID/history" "" "$TOKEN"
else
  skip "GET /api/workflows/:id/history (no workflow_id)"
fi

echo "=== 26. GET /api/auth/sessions ==="
run "List sessions" 200 GET /api/auth/sessions "" "$TOKEN"

echo "=== 27. POST /api/auth/refresh-token ==="
run "Refresh token" 200 POST /api/auth/refresh-token "{}" "$TOKEN"

echo "=== 28. GET /api/auth/sso/:provider ==="
run "SSO redirect Google" 200 GET "/api/auth/sso/google" "" ""

echo "=== 29. GET /api/auth/sso/callback (negative — fake code) ==="
run "SSO callback rejects fake code" 400 GET "/api/auth/sso/callback?code=test-auth-code&state=google" "" ""

echo
echo "================================================================"
echo "FINAL RESULTS"
echo "================================================================"
for r in "${RESULTS[@]}"; do echo "$r"; done
echo "----------------------------------------------------------------"
TOTAL=$((PASS+FAIL+SKIP))
echo "Total: $TOTAL  Passed: $PASS  Failed: $FAIL  Skipped: $SKIP"
exit $FAIL
