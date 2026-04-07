# Automated Git Hooks Installation

## Overview

The MCP server automatically installs git hooks when it starts up. This ensures duplicate detection works at both **pre-commit** and **pre-push** stages without requiring manual developer setup.

## How It Works

### Automatic Installation on MCP Startup

When you start the MCP server with `docker-compose up -d`, the server automatically:

1. **Detects .git directory** - Searches up from workspace path to find your git repository
2. **Installs hooks** - Copies pre-commit and pre-push hooks to `.git/hooks/`
3. **Makes executable** - Sets execute permissions automatically (Unix/Mac)
4. **Verifies installation** - Confirms hooks are working correctly

**No manual installation required!** 🎉

### First Time Setup - No .git Folder Yet

**Scenario:** You extracted the CLI export zip, but haven't run `git init` yet.

**What Happens:**

```bash
# Step 1: User extracts CLI export
unzip project-export.zip
cd project-export

# Step 2: Start MCP server (no git repo yet)
cd mcp-server
docker-compose up -d
```

**Console Output:**
```
📋 Step 3/4: Installing Git Hooks...

WARNING: Git repository not found - skipping hook installation
   Workspace: /workspace
   Hooks will not be installed automatically

📋 Step 4/4: Configuration Summary
   ...

✅ MCP Server Ready!
```

**MCP server still works!** It just skips hook installation until you initialize git.

**Solution Options:**

**Option 1: Initialize Git, Then Restart MCP (Recommended)**
```bash
# Initialize git repository
git init

# Restart MCP server to auto-install hooks
docker-compose restart
```

**Console after restart:**
```
📋 Step 3/4: Installing Git Hooks...
============================================================
Installing Git Hooks
============================================================
   Git directory: C:\Users\...\your-project\.git
   Hooks directory: C:\Users\...\your-project\.git\hooks
   [OK] Installed: pre-commit
   [OK] Installed: pre-push
============================================================
[OK] Installed 2 git hook(s)
```

**Option 2: Manual Installation Without Restart**
```bash
# Initialize git repository
git init

# Trigger manual hook installation (no restart needed)
curl -X POST http://localhost:8766/hooks/install
```

**Response:**
```json
{
  "success": true,
  "installed": true,
  "hooksInstalled": true,
  "gitDirectory": "C:\\Users\\...\\your-project\\.git",
  "hooks": {
    "pre-commit": {
      "installed": true,
      "executable": true,
      "upToDate": true
    },
    "pre-push": {
      "installed": true,
      "executable": true,
      "upToDate": true
    }
  },
  "message": "Hooks installed successfully",
  "timestamp": "2025-11-14T14:30:00Z"
}
```

**Recommended Workflow for New Projects:**

```bash
# 1. Extract CLI export
unzip project-export.zip
cd project-export

# 2. Initialize git FIRST
git init

# 3. Start MCP server (hooks auto-install)
cd mcp-server
docker-compose up -d

# ✅ Hooks are now installed automatically!
```

### Startup Output

When the MCP server starts, you'll see:

```
============================================================
🚀 ProjexLight MCP Server Starting...
============================================================

📋 Step 1/4: Loading configuration...
   ✅ Configuration loaded successfully

📋 Step 2/4: Initializing MCP Agent...
   ✅ MCP Agent started successfully

📋 Step 3/4: Installing Git Hooks...
============================================================
Installing Git Hooks
============================================================
   Git directory: C:\Users\...\your-project\.git
   Hooks directory: C:\Users\...\your-project\.git\hooks
   [OK] Installed: pre-commit
   [OK] Installed: pre-push
============================================================
[OK] Installed 2 git hook(s)

Git hooks will now automatically scan for duplicates:
   - Pre-commit: Scans staged files before commit
   - Pre-push: Runs API tests before push

Bypass hook if needed: git commit --no-verify

📋 Step 4/4: Configuration Summary
   ...

============================================================
✅ MCP Server Ready!
============================================================
```

## Git Hook Behavior

### Pre-Commit Hook

**Triggers:** Before every `git commit`

**What It Does:**
1. Scans all staged files for duplicate APIs
2. Checks for component similarities (non-blocking)
3. Blocks commit if duplicate APIs found
4. Provides developer with 3 options:
   - Reuse existing API (recommended)
   - Modify endpoint path
   - Add justification comment

**Output Example:**

```bash
$ git commit -m "Add user routes"

🔍 ProjexLight Pre-Commit Duplicate Scan
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ MCP server is running

📋 Scanning 5 staged file(s)...

📊 Scan Results:
   Files scanned: 5
   🚨 Duplicate APIs: 1

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 COMMIT BLOCKED: Duplicate APIs detected
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Duplicate APIs found:

  🚨 POST /api/users
     File: server/src/routes/userRoutes.ts
     Conflicts with: server/src/routes/legacy/userRoutes.ts
     Sprint: Sprint 1

Action Required:
  1. ✅ Reuse existing API (recommended)
  2. 🔄 Modify endpoint path to make it unique
  3. 📝 Add justification comment if duplicate is intentional

To bypass this check (not recommended):
  git commit --no-verify -m "your message"
```

### Pre-Push Hook

**Triggers:** Before every `git push`

**What It Does:**
1. Runs API tests (CURL tests against generated endpoints)
2. Scans for duplicate components (LLM-based analysis)
3. Reports results but typically **non-blocking**
4. Updates Leadership Dashboard with results

**Output Example:**

```bash
$ git push origin main

🚀 ProjexLight Pre-Push Hook
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ MCP server is running

🧪 Running API tests...
✓ API Testing completed
  Total APIs: 15
  Passed: 15
  Failed: 0

🔍 Scanning for duplicate components...
✓ Component scan completed
  No duplicate components detected

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Pre-push checks completed
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 View detailed results in Leadership Dashboard
```

## Graceful Degradation

If MCP server is offline, hooks gracefully allow commits/pushes:

```bash
🔍 ProjexLight Pre-Commit Duplicate Scan
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  MCP server not running at http://localhost:8766
   Pre-commit scan skipped (graceful degradation)
   Start MCP server: cd mcp-server && docker-compose up -d

[commit proceeds normally]
```

## Verifying Hook Installation

### From Command Line

Check if hooks are installed:

```bash
ls -la .git/hooks/pre-commit
ls -la .git/hooks/pre-push
```

Expected output:
```
-rwxr-xr-x 1 user group 5327 Nov 14 14:23 .git/hooks/pre-commit
-rwxr-xr-x 1 user group 4463 Nov 14 14:23 .git/hooks/pre-push
```

### From MCP Server API

Check hook status via HTTP endpoint:

```bash
curl http://localhost:8766/hooks/status
```

Response:
```json
{
  "success": true,
  "hooksInstalled": true,
  "gitDirectory": "C:\\Users\\...\\your-project\\.git",
  "hooks": {
    "pre-commit": {
      "installed": true,
      "executable": true,
      "upToDate": true
    },
    "pre-push": {
      "installed": true,
      "executable": true,
      "upToDate": true
    }
  },
  "timestamp": "2025-11-14T14:25:00Z"
}
```

## Manual Installation (Not Required)

**Note:** Manual installation is NOT required - hooks install automatically when MCP server starts.

However, if you need to reinstall manually:

```bash
cd mcp-server
python hook_installer.py ..
```

Output:
```
Testing Git Hook Installer...

1. Attempting installation...

============================================================
Installing Git Hooks
============================================================
   Git directory: C:\Users\...\your-project\.git
   Hooks directory: C:\Users\...\your-project\.git\hooks
   [OK] Installed: pre-commit
   [OK] Installed: pre-push
============================================================
[OK] Installed 2 git hook(s)
```

## Bypassing Hooks

### When to Bypass

✅ **Acceptable:**
- Emergency hotfix with time constraints
- Duplicate is intentional and documented
- False positive from detection system

❌ **Not Acceptable:**
- "I don't want to fix the duplicate"
- "It's faster this way"
- "Testing the duplicate detection"

### How to Bypass

#### Pre-Commit Hook:
```bash
git commit --no-verify -m "Emergency hotfix"
```

#### Pre-Push Hook:
```bash
git push --no-verify
```

⚠️ **Warning:** Bypasses are visible in git history!

## Troubleshooting

### Hook Not Running

**Check if hook exists:**
```bash
ls -la .git/hooks/pre-commit
```

**Restart MCP server to reinstall:**
```bash
cd mcp-server
docker-compose restart
```

### Hook Says "MCP Server Not Running"

**Check MCP server health:**
```bash
curl http://localhost:8766/health
```

**Start MCP server:**
```bash
cd mcp-server
docker-compose up -d
```

### Hook Is Too Slow

**Commit smaller batches:**
```bash
# Instead of:
git add .
git commit -m "Add all files"

# Do:
git add server/src/routes/userRoutes.ts
git commit -m "Add user routes"
```

### Windows Git Bash Issues

**If hooks don't execute:**
1. Ensure you're using Git Bash (not CMD or PowerShell)
2. Check `curl` and `jq` are installed:
   ```bash
   which curl
   which jq
   ```
3. Install jq if missing: Download from https://stedolan.github.io/jq/download/

## Hook Updates

When you download a new CLI export package, hooks are automatically updated:

1. MCP server detects hook content has changed
2. Backs up old hook: `.git/hooks/pre-commit.backup`
3. Installs new version
4. Logs update in console output

## Architecture

### File Structure

```
mcp-server/
├── hook_installer.py       # Auto-installer script
├── templates/
│   ├── pre-commit         # Pre-commit hook template
│   └── pre-push           # Pre-push hook template
└── server.py              # MCP server (calls installer on startup)
```

### Hook Installation Flow

```
MCP Server Startup
    ↓
Step 3: Install Git Hooks
    ↓
hook_installer.py
    ↓
Find .git directory (search up from workspace)
    ↓
Copy templates/pre-commit → .git/hooks/pre-commit
Copy templates/pre-push   → .git/hooks/pre-push
    ↓
Make hooks executable (chmod +x)
    ↓
Verify installation
    ↓
Log results to console
```

### Hook Execution Flow

```
Developer: git commit -m "message"
    ↓
.git/hooks/pre-commit executes
    ↓
Check if MCP server running (curl health check)
    ↓
If offline → Allow commit (graceful degradation)
If online  → Scan staged files
    ↓
POST /api/pre-commit-scan
    ↓
MCP processes files, checks duplicates
    ↓
Returns: { blocking: true/false, duplicates: [...] }
    ↓
If blocking == true  → Exit 1 (block commit)
If blocking == false → Exit 0 (allow commit)
```

## Best Practices

1. **Keep MCP Running** - Start MCP server when beginning work session
2. **Review Feedback** - Read duplicate reports, don't just bypass
3. **Fix Duplicates Properly** - Reuse existing code instead of duplicating
4. **Document Bypasses** - If you use `--no-verify`, explain why in commit message
5. **Monitor Dashboard** - Check Leadership Dashboard for trends

## Support

- **Documentation:** `docs/support/MCP_Duplicate_Detection_User_Guide.md`
- **Quick Reference:** `docs/support/MCP_Duplicate_Detection_Quick_Reference.md`
- **Timeline Example:** `docs/support/MCP_Timeline_Example.md`
- **Email:** support@projexlight.com

---

**Version:** 1.0.0
**Last Updated:** 2025-11-14
**Automated Installation:** ✅ Enabled by Default
