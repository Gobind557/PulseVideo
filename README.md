# Pulse Video Platform

Full-stack app: video upload, sensitivity processing, streaming — Express + MongoDB + Socket.io (backend), React + Vite + Redux Toolkit (frontend).

## Prerequisites

- Node.js **20 LTS** (or current LTS)
- **MongoDB** — [MongoDB Atlas](https://www.mongodb.com/atlas) connection string in `.env`, or optional **Docker** (`docker compose up -d`) for a local instance
- **FFmpeg** (required later for the processing worker; not needed for milestone 1)

## Quick start

1. **Clone & install**

   ```bash
   cp .env.example .env
   docker compose up -d
   cd backend && npm install
   cd ../frontend && npm install
   ```

2. **Run API** (from `backend/`)

   ```bash
   npm run dev
   ```

   Health check: [http://localhost:4000/api/health](http://localhost:4000/api/health)

3. **Run SPA** (from `frontend/`)

   ```bash
   npm run dev
   ```

   Open [http://localhost:5173](http://localhost:5173)

## Repo layout

| Path          | Description                    |
| ------------- | ------------------------------ |
| `backend/`    | Express API — modular **`src/app`**, **`routes/`**, **`middleware/`**, **`db/`**, **`bootstrap/`**, **`config/`** |
| `frontend/`   | Vite + React + Redux Toolkit; **`src/features/*`** (feature modules), **`src/shared/types`**, containers vs presentational UI |
| `docs/`       | Detailed docs (added later)    |
| `uploads/`    | Local video storage (gitignored) |

## Git

```bash
git init
git remote add origin https://github.com/Gobind557/PulseVideo.git
git branch -M main
git add .
git commit -m "<message>"
git push -u origin main
```

## Environment

See [.env.example](.env.example). `MONGODB_URI` must match your MongoDB instance (Docker Compose uses `mongodb://127.0.0.1:27017/pulse`).
