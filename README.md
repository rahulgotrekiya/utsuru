# ✳ utsuru

**Self-hosted download manager for your Jellyfin media server.**

Queue movie and TV show downloads via aria2c, browse your media library, and trigger Jellyfin scans — all from a clean, dark web UI.

[![CI](https://github.com/rahulgotrekiya/utsuru/actions/workflows/ci.yml/badge.svg)](https://github.com/rahulgotrekiya/utsuru/actions/workflows/ci.yml)

---

## Features

- **Download Queue** — Add movies and TV episodes by URL; aria2c handles the rest
- **Live Progress** — Real-time speed, ETA, and progress via Server-Sent Events
- **Media Library** — Browse your movies and TV folders in a file-tree view
- **Jellyfin Integration** — Trigger library scans directly from the UI
- **History** — Filter and search all past downloads by status or type
- **Dark / Light Mode** — Persisted theme toggle
- **Self-contained** — Single Node.js process, SQLite database, no external services required beyond aria2c

---

## Quick Start (Docker — Recommended)

```bash
# Clone the repo
git clone https://github.com/rahulgotrekiya/utsuru.git
cd utsuru

# Copy and edit the environment file
cp .env.example .env   # edit SECRET_KEY and ADMIN_PASSWORD at minimum

# Build and start
docker compose up -d --build

# Open in browser
open http://localhost:4096
```

Default credentials: **admin / utsuru** — change via Settings → Account after first login.

---

## Quick Start (Local / Dev)

```bash
# Requires Node.js 20+
npm install
npm run dev
```

You also need aria2c running separately:

```bash
aria2c --enable-rpc --rpc-listen-port=6800 --dir=./media --daemon
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4096` | Port the server listens on |
| `HOST` | `0.0.0.0` | Bind address |
| `SECRET_KEY` | `change-me` | JWT signing secret — **change this in production** |
| `ADMIN_PASSWORD` | `utsuru` | Initial admin password |
| `MEDIA_MOVIES_DIR` | `/media/movies` | Absolute path to movies folder |
| `MEDIA_TV_DIR` | `/media/tv` | Absolute path to TV folder |
| `ARIA2_RPC_URL` | `http://localhost:6800/jsonrpc` | aria2c RPC endpoint |
| `ARIA2_RPC_SECRET` | _(empty)_ | aria2c RPC secret token |
| `JELLYFIN_URL` | _(empty)_ | Jellyfin server URL (optional) |
| `JELLYFIN_API_KEY` | _(empty)_ | Jellyfin API key (optional) |
| `DATABASE_PATH` | `./data/utsuru.db` | SQLite database file path |
| `TZ` | `UTC` | Container timezone |

---

## Docker Compose — Custom Media Paths

To point utsuru at your existing media directories, set `MOVIES_PATH` and `TV_PATH` before running:

```bash
MOVIES_PATH=/mnt/nas/movies TV_PATH=/mnt/nas/tv docker compose up -d
```

Or set them permanently in your `.env` file:

```env
MOVIES_PATH=/mnt/nas/movies
TV_PATH=/mnt/nas/tv
```

---

## Jellyfin Setup

1. In Jellyfin: **Dashboard → API Keys → +**
2. In utsuru: **Settings → Integrations → Jellyfin**
3. Enter your Jellyfin URL (e.g. `http://localhost:8096`) and paste the API key
4. Click **Save** — the status indicator will turn green when connected

---

## aria2c Setup

utsuru uses aria2c as the download backend. Make sure it is reachable from wherever utsuru runs.

**With Docker (sidecar approach):**
Add aria2c as a second service in `docker-compose.yml`:

```yaml
  aria2:
    image: p3terx/aria2-pro
    container_name: aria2
    environment:
      - RPC_SECRET=your-secret
      - RPC_PORT=6800
    volumes:
      - ./media:/downloads
    ports:
      - "6800:6800"
```

Then update the environment in the utsuru service:
```yaml
- ARIA2_RPC_URL=http://aria2:6800/jsonrpc
- ARIA2_RPC_SECRET=your-secret
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 22 (ESM) |
| Server | Express 5 |
| Database | SQLite via sql.js |
| Auth | JWT (httpOnly cookie) |
| Security | Helmet, express-rate-limit |
| Icons | Lucide |
| Font | JetBrains Mono |
| Container | Docker + tini |

---

## Project Structure

```
utsuru/
├── db/              # Database init and queries
├── lib/             # Logger
├── middleware/      # Auth middleware
├── public/          # Static frontend (HTML, CSS, JS)
│   ├── css/
│   ├── js/
│   └── favicon.svg
├── routes/          # API routes (auth, downloads, library…)
├── server.js        # Entry point
├── Dockerfile
└── docker-compose.yml
```

---

## License

[MIT](./LICENSE) © Rahul Gotrekiya
