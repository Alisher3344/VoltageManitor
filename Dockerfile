# ============================================================
# VoltageManitor — yagona image: React build (frontend) + FastAPI (backend)
# Build konteksti: VoltageManitor/ (repo ildizi) — VoltageBackend va
# VoltageFronend ikkalasiga ham kirish uchun.
# ============================================================

# ---- 1-bosqich: frontend build (base=/, chiroqbor.ssmart.uz root subdomeni) ----
FROM node:20-alpine AS frontend
WORKDIR /fe
COPY VoltageFronend/package.json VoltageFronend/package-lock.json ./
RUN npm ci
COPY VoltageFronend/ ./
RUN npm run build          # vite.config.js: base='/'

# ---- 2-bosqich: backend (FastAPI + build natijasini serve qiladi) ----
FROM python:3.12-slim AS backend
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1
WORKDIR /app

COPY VoltageBackend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Backend kodi
COPY VoltageBackend/ ./VoltageBackend/
# Frontend build natijasi — config.py kutgan joyga (BASE_DIR.parent/VoltageFronend/dist)
COPY --from=frontend /fe/dist ./VoltageFronend/dist

# Yuklangan rasmlar uchun papka (volume bilan ustiga mount qilinadi)
RUN mkdir -p /app/VoltageBackend/media

WORKDIR /app/VoltageBackend
EXPOSE 5000 5001

# Migratsiya + server. Migratsiya muvaffaqiyatsiz bo'lsa konteyner qayta urinadi.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 5000 --workers 1 --log-level info"]
