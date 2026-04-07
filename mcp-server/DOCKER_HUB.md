# ProjexLight MCP Servers - Docker Hub

ProjexLight provides two MCP server images:

| Image | Port | Purpose |
|-------|------|---------|
| [`projexlight/projex-dev-mcp`](https://hub.docker.com/r/projexlight/projex-dev-mcp) | 8766 | Code review, development assistance |
| [`projexlight/projex-test-mcp`](https://hub.docker.com/r/projexlight/projex-test-mcp) | 8000 | UI testing, API functional tests |

---

## Dev MCP - Quick Start

### Option 1: Docker Run (Simplest)

```bash
docker pull projexlight/projex-dev-mcp:latest

docker run -d \
  --name projexlight-mcp \
  -p 8766:8766 \
  -v $(pwd):/workspace \
  -v $(pwd)/mcp-server/mcp-config.json:/app/mcp-config.json:ro \
  -v $(pwd)/mcp-server/.env:/app/.env:ro \
  projexlight/projex-dev-mcp:latest
```

### Option 2: Docker Compose (Recommended)

Create a `docker-compose.yml` in your project:

```yaml
version: '3.8'

services:
  mcp-server:
    image: projexlight/projex-dev-mcp:latest
    container_name: projexlight-mcp
    ports:
      - "8766:8766"
    volumes:
      - ./:/workspace                          # Your project root
      - ./mcp-server/mcp-config.json:/app/mcp-config.json:ro
      - ./mcp-server/feedback:/feedback
    environment:
      - WORKSPACE_PATH=/workspace
      - FEEDBACK_PATH=/feedback
      - MCP_SERVER_PORT=8766
      - MCP_SERVER_HOST=0.0.0.0
      - MCP_CONFIG_FILE=/app/mcp-config.json
    extra_hosts:
      - "host.docker.internal:host-gateway"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8766/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

Then run:

```bash
docker-compose up -d
```

---

## Configuration

### Required Files

Your project should have these files:

```
your-project/
├── mcp-server/
│   ├── mcp-config.json      # Encrypted project configuration
│   ├── .env                 # Environment variables (optional)
│   └── feedback/            # Feedback directory (auto-created)
├── .projexlight/
│   └── context/
│       ├── requirements.md
│       ├── sprint-context.json
│       └── task-list.json
└── src/                     # Your code
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `WORKSPACE_PATH` | Path to project in container | `/workspace` |
| `FEEDBACK_PATH` | Path for feedback files | `/feedback` |
| `MCP_SERVER_PORT` | Server port | `8766` |
| `MCP_SERVER_HOST` | Server host | `0.0.0.0` |
| `MCP_CONFIG_FILE` | Config file path | `/app/mcp-config.json` |
| `PROJEXLIGHT_API_URL` | ProjexLight API URL | (from .env) |

### Using with External Database

If your project uses a database, add it to your docker-compose.yml:

```yaml
version: '3.8'

services:
  mcp-server:
    image: projexlight/mcp-server:latest
    container_name: projexlight-mcp
    ports:
      - "8766:8766"
    volumes:
      - ./:/workspace
      - ./mcp-server/mcp-config.json:/app/mcp-config.json:ro
      - ./mcp-server/feedback:/feedback
    environment:
      - WORKSPACE_PATH=/workspace
      - MCP_CONFIG_FILE=/app/mcp-config.json
    extra_hosts:
      - "host.docker.internal:host-gateway"
    networks:
      - mcp-network
    depends_on:
      - postgres
    restart: unless-stopped

  postgres:
    image: postgres:15-alpine
    container_name: projexlight-postgres
    environment:
      - POSTGRES_USER=appuser
      - POSTGRES_PASSWORD=apppassword
      - POSTGRES_DB=appdb
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init-scripts:/docker-entrypoint-initdb.d
    networks:
      - mcp-network
    restart: unless-stopped

networks:
  mcp-network:
    driver: bridge

volumes:
  postgres_data:
```

---

## Verify Installation

```bash
# Check container is running
docker ps | grep projexlight-mcp

# Health check
curl http://localhost:8766/health

# Expected response:
# {"status": "healthy", "uptime": "...", "workspace": "/workspace"}
```

---

## Configure AI Coding Tool

### Claude Code

Add to `~/.claude/settings.json` or `.claude/settings.json` in your project:

```json
{
  "mcpServers": {
    "projexlight": {
      "url": "http://localhost:8766"
    }
  }
}
```

### Cursor / Cline

Check their MCP configuration documentation for the equivalent setting.

---

## Logs & Debugging

### View Logs

```bash
# Container logs
docker logs projexlight-mcp

# Follow logs in real-time
docker logs -f projexlight-mcp

# Via HTTP API
curl http://localhost:8766/logs/server
curl http://localhost:8766/logs/errors
```

### Common Issues

**Container won't start:**
```bash
# Check for port conflicts
netstat -an | grep 8766

# View detailed logs
docker logs projexlight-mcp --tail 50
```

**Can't connect to MCP server:**
```bash
# Verify container is running
docker ps

# Check health
curl http://localhost:8766/health

# Restart container
docker restart projexlight-mcp
```

---

## Stop & Remove

```bash
# Stop container
docker stop projexlight-mcp

# Remove container
docker rm projexlight-mcp

# Or with docker-compose
docker-compose down

# Remove with volumes
docker-compose down -v
```

---

## Test MCP - Quick Start

The Test MCP server runs UI and API functional tests.

### Docker Run

```bash
docker pull projexlight/projex-test-mcp:latest

docker run -d \
  --name projexlight-test-mcp \
  -p 8000:8000 \
  -v $(pwd):/workspace:ro \
  -v $(pwd)/test-results:/results \
  -v $(pwd)/mcp-server/mcp-config.json:/app/mcp-config.json:ro \
  projexlight/projex-test-mcp:latest
```

### Docker Compose

Use `test-mcp-compose.yml` from your mcp-server folder:

```bash
cd mcp-server
docker-compose -f test-mcp-compose.yml up -d
```

Or use the setup script:

```bash
./setup-test-mcp.sh start
```

### Test MCP Authentication

The Test MCP supports **two authentication methods**:

#### Method 1: mcp-config.json (For Developers)

When using CLI export, the `mcp-config.json` is auto-decrypted on startup.

#### Method 2: Environment Variables (For QA Teams)

For QA teams without CLI export, edit `.env`:

```bash
# ProjexLight API Key (from tenant settings)
PROJEXLIGHT_API_KEY=your_api_key_here

# LLM API Key (for AI-powered self-healing)
OPENAI_API_KEY=sk-your_openai_key_here
```

### Verify Test MCP

```bash
# Health check
curl http://localhost:8000/health

# Check configuration source
curl http://localhost:8000/config-status
```

Expected response for QA (using env vars):
```json
{
  "config_source": "env_vars",
  "has_projexlight_key": true,
  "has_llm_key": true,
  "llm_provider": "openai"
}
```

### Running Tests

```bash
# Run UI tests
./run-all-tests.sh ui

# Run API tests
./run-all-tests.sh api

# Run tests against specific environment
./run-all-tests.sh api --env staging
./run-all-tests.sh api --env qa
./run-all-tests.sh api --env production

# Run with dataset filter
./run-all-tests.sh api --dataset positive
```

See **[TEST_EXECUTION.md](TEST_EXECUTION.md)** for complete testing options.

---

## Available Tags

| Tag | Description |
|-----|-------------|
| `latest` | Most recent stable release |
| `v1.0.0`, `v1.1.0`, etc. | Specific version releases |

Pull a specific version:

```bash
# Dev MCP
docker pull projexlight/projex-dev-mcp:v1.0.0

# Test MCP
docker pull projexlight/projex-test-mcp:v1.0.0
```

---

## Support

- **Documentation:** Check the included README.md in your project's mcp-server folder
- **[TEST_EXECUTION.md](TEST_EXECUTION.md)** - Complete testing guide
- **Issues:** Report issues through ProjexLight platform
- **Logs:** Use `docker logs projexlight-mcp` for troubleshooting
