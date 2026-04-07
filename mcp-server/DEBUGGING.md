# MCP Server Debugging Guide

## Overview

The MCP Server writes comprehensive logs to help you debug issues related to code reviews, API testing, component scanning, and git hook operations.

---

## Log File Locations

### Inside Docker Container:
```
/feedback/logs/
├── mcp-server-YYYYMMDD-HHMMSS.log      # Main server log
├── file-activity-YYYYMMDD-HHMMSS.log   # File change detection log
├── code-reviews-YYYYMMDD-HHMMSS.log    # Code review activity log
├── errors-YYYYMMDD-HHMMSS.log          # Error-specific log
├── latest-server.log                   # Symlink to latest main log
├── latest-activity.log                 # Symlink to latest activity log
├── latest-reviews.log                  # Symlink to latest review log
└── latest-errors.log                   # Symlink to latest error log
```

### On Host Machine (CLI Export):
```
project-name/
└── mcp-server/
    └── feedback/
        └── logs/
            ├── mcp-server-YYYYMMDD-HHMMSS.log
            ├── file-activity-YYYYMMDD-HHMMSS.log
            ├── code-reviews-YYYYMMDD-HHMMSS.log
            ├── errors-YYYYMMDD-HHMMSS.log
            └── latest-*.log (symlinks)
```

**Quick Access:**
```bash
cd mcp-server/feedback/logs/
ls -ltr  # List logs by time (most recent last)
```

---

## Log File Contents

### 1. Main Server Log (`mcp-server-*.log`)

**Contains:**
- Server startup/shutdown events
- Session information (Project ID, LLM provider, models)
- API endpoint calls
- Configuration decryption status
- Git hook installation status
- File monitoring activity
- General operational messages

**Example:**
```
2025-11-14 15:30:00 | session_main | INFO | ================================================================================
2025-11-14 15:30:00 | session_main | INFO | MCP SERVER SESSION STARTED
2025-11-14 15:30:00 | session_main | INFO | ================================================================================
2025-11-14 15:30:00 | session_main | INFO | Session ID: 20251114-153000
2025-11-14 15:30:00 | session_main | INFO | Workspace: /workspace
2025-11-14 15:30:00 | session_main | INFO | Project ID: proj-abc123
2025-11-14 15:30:00 | session_main | INFO | LLM Provider: openrouter
2025-11-14 15:30:00 | session_main | INFO | Review Model: anthropic/claude-3.5-sonnet
2025-11-14 15:30:00 | config_main | INFO | ✅ Configuration decrypted successfully
```

### 2. File Activity Log (`file-activity-*.log`)

**Contains:**
- File change detection events
- Modified/created/deleted files
- File watcher events
- Git repository changes

**Example:**
```
2025-11-14 15:32:15 | agent_activity | INFO | 📝 File modified: server/routes/userRoutes.ts
2025-11-14 15:32:20 | agent_activity | INFO | 📝 File created: client/components/UserCard.tsx
```

### 3. Code Reviews Log (`code-reviews-*.log`)

**Contains:**
- Review start/completion events
- Compliance scores
- Violation counts
- LLM token usage and costs
- Review results

**Example:**
```
2025-11-14 15:32:16 | agent_review | INFO | 🔍 REVIEW START: server/routes/userRoutes.ts
2025-11-14 15:32:16 | agent_review | INFO |    Language: typescript
2025-11-14 15:32:16 | agent_review | INFO |    Size: 2456 bytes
2025-11-14 15:32:25 | agent_review | INFO | ✅ REVIEW COMPLETE: server/routes/userRoutes.ts
2025-11-14 15:32:25 | agent_review | INFO |    Compliance Score: 92%
2025-11-14 15:32:25 | agent_review | INFO |    Total Violations: 3
2025-11-14 15:32:25 | agent_review | INFO |    Auto-fixable: 2
2025-11-14 15:32:25 | agent_review | INFO |    LLM Tokens: 1250
2025-11-14 15:32:25 | agent_review | INFO |    Cost: $0.0125
```

### 4. Errors Log (`errors-*.log`)

**Contains:**
- All error messages
- Stack traces
- Failed operations
- Exception details

**Example:**
```
2025-11-14 15:35:00 | agent_error | ERROR | ❌ REVIEW FAILED: server/routes/brokenFile.ts
2025-11-14 15:35:00 | agent_error | ERROR |    Error: SyntaxError: Unexpected token
```

---

## Viewing Logs

### 1. View Logs via HTTP (Easiest!)

**NEW: The MCP server now provides an HTTP endpoint to view logs!**

```bash
# View last 100 lines of server log
curl http://localhost:8766/logs/server

# View last 50 lines of error log
curl http://localhost:8766/logs/errors?lines=50

# View last 200 lines of code review log
curl http://localhost:8766/logs/reviews?lines=200

# View all logs combined (last 100 lines each)
curl http://localhost:8766/logs/all

# Or open in browser:
# http://localhost:8766/logs/server
# http://localhost:8766/logs/errors
```

**Available log types:**
- `server` - Main server log
- `errors` - Error log only
- `reviews` - Code review activity
- `activity` - File change detection
- `all` - All logs combined

**Parameters:**
- `lines` - Number of lines to show (default: 100, max: 1000)

**Example Response:**
```json
{
  "logs": "2025-11-14 15:30:00 | server_main | INFO | MCP SERVER SESSION STARTED\n...",
  "file": "/feedback/logs/latest-server.log",
  "lines": 100
}
```

### 2. View Latest Logs (Real-time via File)

**Using symlinks:**
```bash
cd mcp-server/feedback/logs/

# Main server log
tail -f latest-server.log

# Error log
tail -f latest-errors.log

# Code reviews
tail -f latest-reviews.log

# File activity
tail -f latest-activity.log
```

### 3. View All Recent Activity

```bash
# Last 100 lines from main log
tail -100 mcp-server/feedback/logs/latest-server.log

# Search for specific errors
grep "ERROR" mcp-server/feedback/logs/latest-errors.log

# Search for API test results
grep "API Testing" mcp-server/feedback/logs/latest-server.log
```

### 4. View Docker Container Logs

**MCP Server stdout/stderr:**
```bash
# View real-time logs
docker logs -f projexlight-mcp

# View last 100 lines
docker logs --tail 100 projexlight-mcp

# Search for errors
docker logs projexlight-mcp 2>&1 | grep ERROR
```

**Note:** Docker logs show console output (print statements), while file logs show structured logging.

---

## Common Debugging Scenarios

### Scenario 1: Git Hooks Not Working

**Symptoms:**
- Pre-commit hook doesn't run
- Pre-push hook doesn't trigger API tests
- No duplicate detection

**Debug Steps:**

1. **Check if hooks are installed:**
```bash
cd your-project/.git/hooks/
ls -la pre-commit pre-push
```

Expected output:
```
-rwxr-xr-x 1 user user 5234 Nov 14 15:00 pre-commit
-rwxr-xr-x 1 user user 4456 Nov 14 15:00 pre-push
```

2. **Check hook installation logs:**
```bash
grep "hook" mcp-server/feedback/logs/latest-server.log
```

Look for:
```
✅ Hooks installed successfully
```

3. **Check MCP server health:**
```bash
curl http://localhost:8766/health
```

Expected:
```json
{"status": "healthy", "version": "1.0.0"}
```

4. **Check git monitor status:**
```bash
curl http://localhost:8766/monitor/status
```

5. **Manual hook test:**
```bash
cd your-project
bash .git/hooks/pre-commit
```

---

### Scenario 2: API Tests Not Running

**Symptoms:**
- `git push` doesn't trigger API tests
- No test results in logs
- Hook completes but no tests run

**Debug Steps:**

1. **Check pre-push hook logs:**
```bash
grep "API tests" mcp-server/feedback/logs/latest-server.log
```

2. **Check if MCP server received request:**
```bash
grep "POST /api/test" mcp-server/feedback/logs/latest-server.log
```

3. **Check for changed files detection:**
```bash
grep "changed files" mcp-server/feedback/logs/latest-server.log
```

Look for:
```
📋 OPTIMIZED: Scanning only 13 changed files
```

4. **Check for route file discovery:**
```bash
grep "route files" mcp-server/feedback/logs/latest-server.log
```

Look for:
```
🔍 OPTIMIZED: Scanning 4 route files from 13 changed files
```

5. **Manual API test trigger:**
```bash
curl -X POST http://localhost:8766/api/test \
  -H "Content-Type: application/json" \
  -d '{
    "project_root": "/workspace",
    "triggered_by": "manual"
  }'
```

---

### Scenario 3: Configuration Decryption Failed

**Symptoms:**
- MCP server starts but doesn't review code
- Error: "Configuration not loaded"
- 503 errors from API endpoints

**Debug Steps:**

1. **Check configuration decryption logs:**
```bash
grep "Configuration decryption" mcp-server/feedback/logs/latest-errors.log
```

Look for:
```
❌ Configuration decryption failed: Invalid encryption key
```

2. **Verify encryption key:**
```bash
# Check if MCP_ENCRYPTION_KEY is set in docker-compose
grep MCP_ENCRYPTION_KEY mcp-server/docker-compose.yml
```

3. **Check mcp-config.json exists:**
```bash
ls -la mcp-server/mcp-config.json
```

4. **Validate config file format:**
```bash
cat mcp-server/mcp-config.json | jq .
```

Expected structure:
```json
{
  "encryptedConfig": "base64-encrypted-string-here...",
  "iv": "base64-iv-here..."
}
```

---

### Scenario 4: Component Duplication Scan Not Working

**Symptoms:**
- No component warnings
- Component scan completes with 0 results
- Expected duplicates not detected

**Debug Steps:**

1. **Check component scan logs:**
```bash
grep "Component scan" mcp-server/feedback/logs/latest-server.log
```

2. **Check component file discovery:**
```bash
grep "component files" mcp-server/feedback/logs/latest-server.log
```

Look for:
```
📦 Found 15 component files
```

3. **Check LLM analysis:**
```bash
grep "LLM" mcp-server/feedback/logs/latest-server.log
```

4. **Manual component scan trigger:**
```bash
curl -X POST http://localhost:8766/api/components/scan \
  -H "Content-Type: application/json" \
  -d '{
    "project_root": "/workspace",
    "triggered_by": "manual"
  }'
```

---

### Scenario 5: MCP Server Not Starting

**Symptoms:**
- Docker container exits immediately
- Cannot access http://localhost:8766
- Health check fails

**Debug Steps:**

1. **Check Docker container status:**
```bash
docker ps -a | grep projexlight-mcp
```

2. **View container startup logs:**
```bash
docker logs projexlight-mcp
```

3. **Check for port conflicts:**
```bash
lsof -i :8766
# or on Windows:
netstat -ano | findstr :8766
```

4. **Restart container with verbose logging:**
```bash
cd mcp-server
docker-compose down
docker-compose up
```

5. **Check if workspace path exists:**
```bash
ls -la mcp-server/workspace/
```

---

## Increasing Log Verbosity

### Method 1: Environment Variable

Add to `docker-compose.yml`:
```yaml
environment:
  - LOG_LEVEL=DEBUG  # Options: DEBUG, INFO, WARNING, ERROR
```

Then restart:
```bash
docker-compose restart
```

### Method 2: Uvicorn Log Level

Modify `server.py`:
```python
uvicorn.run(
    app,
    host=host,
    port=port,
    log_level="debug",  # Change from "info" to "debug"
    access_log=True
)
```

Rebuild:
```bash
docker-compose up --build
```

---

## Log Rotation

Logs automatically rotate when they reach **10 MB**, keeping **5 backup files**.

**Example rotation:**
```
mcp-server-20251114-153000.log       (current, 8 MB)
mcp-server-20251114-153000.log.1     (backup, 10 MB)
mcp-server-20251114-153000.log.2     (backup, 10 MB)
...
```

**To view old logs:**
```bash
cd mcp-server/feedback/logs/
ls -lh *.log*
cat mcp-server-20251114-153000.log.1
```

---

## Troubleshooting Commands Cheat Sheet

```bash
# Quick health check
curl http://localhost:8766/health

# View logs via HTTP (NEW - easiest way!)
curl http://localhost:8766/logs/server        # Main log
curl http://localhost:8766/logs/errors        # Errors only
curl http://localhost:8766/logs/all           # All logs combined

# View real-time server logs (file-based)
tail -f mcp-server/feedback/logs/latest-server.log

# View real-time errors (file-based)
tail -f mcp-server/feedback/logs/latest-errors.log

# Search for specific errors
grep "ERROR" mcp-server/feedback/logs/latest-errors.log

# Check hook installation
grep "hook" mcp-server/feedback/logs/latest-server.log

# Check API testing
grep "API test" mcp-server/feedback/logs/latest-server.log

# Check component scanning
grep "Component scan" mcp-server/feedback/logs/latest-server.log

# View Docker container logs
docker logs -f projexlight-mcp

# Restart MCP server
cd mcp-server && docker-compose restart

# View all logs by time
cd mcp-server/feedback/logs && ls -ltr
```

---

## Getting Help

If you encounter issues not covered in this guide:

1. **Collect logs:**
```bash
cd mcp-server/feedback/logs/
tar -czf mcp-logs-$(date +%Y%m%d).tar.gz *.log
```

2. **Check GitHub Issues:**
- Search existing issues: https://github.com/projexlight/mcp-server/issues

3. **Create New Issue:**
- Include log files (compress if large)
- Describe the issue
- Steps to reproduce
- Expected vs actual behavior

---

## Log Analysis Tips

### Find All Errors in Last Hour:
```bash
grep "$(date -d '1 hour ago' '+%Y-%m-%d %H')" mcp-server/feedback/logs/latest-errors.log
```

### Count API Calls Today:
```bash
grep "$(date '+%Y-%m-%d')" mcp-server/feedback/logs/latest-server.log | grep -c "POST /api"
```

### Find Slowest Code Reviews:
```bash
grep "REVIEW COMPLETE" mcp-server/feedback/logs/latest-reviews.log | grep -E "Cost: \$[0-9]+\.[0-9]+" | sort -t '$' -k2 -n
```

### Find Failed API Tests:
```bash
grep "failedAPIs" mcp-server/feedback/logs/latest-server.log | grep -v '"failedAPIs": 0'
```

---

## Summary

**Quick Debugging Steps:**

1. **Check health:** `curl http://localhost:8766/health`
2. **View logs:** `tail -f mcp-server/feedback/logs/latest-server.log`
3. **Check errors:** `cat mcp-server/feedback/logs/latest-errors.log`
4. **Restart if needed:** `docker-compose restart`
5. **Test manually:** Use curl commands to test endpoints directly

**Remember:**
- Logs persist across container restarts
- Multiple log files for different purposes
- Symlinks always point to latest logs
- Logs automatically rotate at 10MB
- Docker logs show stdout, file logs show structured data
