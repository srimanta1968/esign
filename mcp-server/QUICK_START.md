# Quick Start Guide

Get your AI coding assistant generating code in 5 minutes.

---

## Setup

### 1. Extract Your Project

```bash
unzip your-project-export.zip
cd your-project-export
```

### 2. Start MCP Server

```bash
cd mcp-server
docker-compose up -d
```

Wait about 30 seconds for services to initialize.

### 3. Verify It's Running

```bash
curl http://localhost:8766/health
```

You should see:
```json
{
  "status": "healthy",
  "uptime": "...",
  "workspace": "/workspace"
}
```

### 4. Configure Your AI Coding Tool

**For Claude Code**, add to your settings (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "projexlight": {
      "url": "http://localhost:8766"
    }
  }
}
```

### 5. Start Coding!

Open your AI coding assistant and give it a prompt like:

> "Read the bootstrap instructions in .claude/instructions/bootstrap.md and start working on the first task."

Your AI assistant will:
1. Read the project context and requirements
2. Connect to the MCP server for task instructions
3. Generate code for each task
4. Validate and complete tasks automatically

---

## Git Setup (When Ready)

After generating some code, initialize git:

```bash
cd ..  # Back to project root
git init
git remote add origin https://github.com/your-repo.git
```

The MCP server automatically installs git hooks for:
- **Pre-commit**: Duplicate API detection
- **Pre-push**: Automatic API testing

---

## Common Commands

```bash
# Check MCP server health
curl http://localhost:8766/health

# View logs
docker logs projexlight-mcp

# Restart services
cd mcp-server
docker-compose restart

# Stop services
docker-compose down
```

---

## Troubleshooting

### Health Check Fails

```bash
# Wait longer for startup
sleep 30
curl http://localhost:8766/health

# Check containers
docker ps | grep projexlight
```

### AI Can't Connect to MCP

1. Verify server is running: `curl http://localhost:8766/health`
2. Check your AI tool's MCP configuration is correct
3. Restart your AI coding tool

### Restart Everything

```bash
cd mcp-server
docker-compose down
docker-compose up -d
```

---

## Summary

1. **Extract** - `unzip project-export.zip`
2. **Start MCP** - `cd mcp-server && docker-compose up -d`
3. **Configure AI tool** - Add MCP server URL to settings
4. **Start coding** - Tell your AI to read bootstrap.md and start
5. **Git init** - Initialize git when ready (hooks auto-install)

---

## Need Help?

- **[README.md](README.md)** - Full documentation
- **[DEBUGGING.md](DEBUGGING.md)** - Troubleshooting guide
- View logs: `docker logs projexlight-mcp`
