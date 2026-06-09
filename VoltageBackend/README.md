# Voltage Monitoring — Backend (FastAPI)

ESP32/SIM800L qurilmalaridan holat qabul qiluvchi va React dashboard'ga
real-time uzatuvchi backend.

## Texnologiyalar
- **FastAPI** + Uvicorn (async)
- **PostgreSQL** (SQLAlchemy 2.0 async, psycopg3)
- **Alembic** — migratsiyalar
- **Redis** — SSE uchun pub/sub (web-ishchilardan mustaqil)
- **Argon2** — parol hashlash
- **JWT + RBAC** — `admin` / `operator` / `viewer` rollari

## Arxitektura
```
ESP32  --TCP "id:value"-->  TCP listener (:5001)
                                  |
                            set_state()
                            /          \
                     Postgres        Redis PUBLISH "voltage:events"
                  (holat+tarix)            |
                                     SSE /events  -->  React monitor (ochiq)
```

## Ruxsatlar (RBAC)
| Endpoint                         | Talab           | Rollar                  |
|----------------------------------|-----------------|-------------------------|
| `GET /events,/status,/devices`   | — (ochiq)       | hamma                   |
| `POST /devices/{id}/state`, `/update` | device:write | operator, admin     |
| `POST /devices`, `DELETE /devices/{id}` | device:manage | operator, admin   |
| `POST /auth/users`, `GET /auth/users`   | user:manage  | admin               |

## O'rnatish

### 1. Postgres bazasini yarating
Mavjud Postgres konteyneriga superuser sifatida kiring va baza + user yarating:
```bash
podman exec -it ssmart-postgres psql -U postgres
```
psql ichida (`<PAROL>` ni o'zingiz tanlang):
```sql
CREATE USER voltage_user WITH PASSWORD '<PAROL>';
CREATE DATABASE voltage OWNER voltage_user;
GRANT ALL PRIVILEGES ON DATABASE voltage TO voltage_user;
\q
```

### 2. `.env` ni to'ldiring
`DATABASE_URL` ichidagi `<PAROL>` ni yuqorida tanlagan parolingiz bilan almashtiring.
`JWT_SECRET` allaqachon generatsiya qilingan. Kerak bo'lsa `ADMIN_PASSWORD` ni o'zgartiring.

### 3. Migratsiya + ishga tushirish
```bash
cd VoltageBackend
source .venv/bin/activate          # yoki: .venv/bin/<cmd>
alembic upgrade head               # jadvallarni yaratadi
uvicorn app.main:app --host 0.0.0.0 --port 5000
```
Birinchi startupda rollar va bootstrap admin (`.env` dagi `ADMIN_*`) yaratiladi.

- Dashboard:  http://localhost:5000/
- API docs:   http://localhost:5000/docs

## Sinov
```bash
# Login (admin)
curl -s -X POST http://localhost:5000/auth/login \
  -d "username=admin&password=admin12345" | tee /tmp/t.json
TOKEN=$(python -c "import json;print(json.load(open('/tmp/t.json'))['access_token'])")

# Qurilma holatini o'zgartirish (operator+)
curl -s -X POST http://localhost:5000/devices/11/state \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"value":1}'

# Ochiq holat (loginsiz)
curl -s http://localhost:5000/status

# ESP32 simulyatsiyasi (xom TCP)
printf "12:1\n" | nc localhost 5001

# Qurilma tarixi (uptime% + uzilishlar)
curl -s "http://localhost:5000/devices/12/history?hours=24"
```

## Testlar
```bash
cd VoltageBackend
.venv/bin/pip install pytest pytest-asyncio   # birinchi marta
.venv/bin/pytest
```

## Xavfsizlik eslatmalari
- `JWT_SECRET` va `ADMIN_PASSWORD` ni ishlab chiqarishda albatta almashtiring (startupda ogohlantirish chiqadi).
- `INGEST_TOKEN` o'rnatilsa, qurilma `TOKEN:id:value` yuboradi — spoofing'ga qarshi.
- `/auth/login` IP bo'yicha rate-limit qilingan (10 urinish / 10 daqiqa).
