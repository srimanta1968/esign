# Project Registration Guide

This guide explains how to register your project with the ProjexLight MCP Server for code analysis, review, and pre-commit scanning.

## Multi-Project Architecture

ProjexLight MCP supports a **multi-project architecture** where a single set of MCP containers serves multiple projects:

- **First project** creates all containers (Dev MCP, Test MCP, Database)
- **Subsequent projects** reuse existing containers
- Each project gets its own database within shared containers
- Projects are registered via UI or API

## Quick Start

### First Project Setup

```bash
# Run the setup script - this creates all containers
./mcp-server/setup-all.sh

# Or run individual scripts
./mcp-server/setup-database.sh start
./mcp-server/setup-dev-mcp.sh start
./mcp-server/setup-test-mcp.sh start
```

### Additional Project Setup

```bash
# Run setup - it will detect existing containers and reuse them
./mcp-server/setup-all.sh

# Or just install hooks if containers are already running
./mcp-server/setup-all.sh --install-hooks
```

## Project Registration

### Method 1: Web UI (Recommended)

1. Open your browser and navigate to: **http://localhost:8766/projects**
2. Click "Register New Project"
3. Fill in the project details:
   - **Project Name**: Human-readable name (e.g., "E-Commerce Platform")
   - **Project ID**: Unique identifier (e.g., "ecommerce-platform")
   - **Project Path**: Absolute path to your project root
   - **Database Name**: Database name for this project (optional)
4. Click "Register"

### Method 2: API Registration

```bash
# Register via API
curl -X POST http://localhost:8766/api/projects/register \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "my-project",
    "projectName": "My Project",
    "projectPath": "/path/to/my-project",
    "workspacePath": "/path/to/my-project"
  }'
```

### Method 3: Automatic Registration

The `setup-all.sh` script attempts to auto-register your project on first run. If auto-registration fails, you'll see a message prompting you to register via the UI.

## Checking Registration Status

### Check via API

```bash
# List all registered projects
curl http://localhost:8766/api/projects

# Check specific project
curl http://localhost:8766/api/projects/my-project-id
```

### Check via UI

Navigate to **http://localhost:8766/projects** to see all registered projects.

## Container Status

Check the status of all containers:

```bash
./mcp-server/setup-all.sh --status
```

This shows:
- Dev MCP status (port 8766)
- Test MCP status (port 8000)
- Database container status
- Current project information

## Git Hooks

After registration, install git hooks for pre-commit scanning:

```bash
./mcp-server/setup-all.sh --install-hooks
```

This installs:
- **pre-commit**: Scans staged files for issues before commit
- **pre-push**: Runs additional checks before push (optional)

## Database Configuration

Each project can have its own database. The database type is configured in `mcp-config.json`:

```json
{
  "databaseConfig": {
    "enabled": true,
    "type": "postgresql",
    "host": "host.docker.internal",
    "port": 5432,
    "database": "my_project_db",
    "username": "appuser",
    "password": "apppassword"
  }
}
```

### Supported Database Types

| Type       | Container Name          | Default Port |
|------------|------------------------|--------------|
| PostgreSQL | projexlight-postgres   | 5432         |
| MySQL      | projexlight-mysql      | 3306         |
| MariaDB    | projexlight-mariadb    | 3306         |
| MongoDB    | projexlight-mongodb    | 27017        |
| Redis      | projexlight-redis      | 6379         |
| Cassandra  | projexlight-cassandra  | 9042         |
| DynamoDB   | projexlight-dynamodb   | 8000         |
| SQLite     | (no container needed)  | N/A          |

## Troubleshooting

### MCP Not Running

```bash
# Check status
./mcp-server/setup-all.sh --status

# Force restart
./mcp-server/setup-all.sh --force
```

### Registration Failed

1. Ensure MCP is running: `curl http://localhost:8766/health`
2. Check logs: `./mcp-server/setup-dev-mcp.sh logs`
3. Try manual registration via UI

### Pre-commit Hook Not Working

1. Verify hook is installed: `ls -la .git/hooks/pre-commit`
2. Check hook has correct permissions: `chmod +x .git/hooks/pre-commit`
3. Verify MCP is running: `curl http://localhost:8766/health`
4. Check hook logs in your terminal during commit

## Endpoints

| Endpoint | Description |
|----------|-------------|
| http://localhost:8766 | Dev MCP Server |
| http://localhost:8766/health | Health check |
| http://localhost:8766/projects | Project management UI |
| http://localhost:8766/api/projects | Projects API |
| http://localhost:8000 | Test MCP Server |

## Support

For issues and feature requests, please refer to the main documentation or contact your administrator.
