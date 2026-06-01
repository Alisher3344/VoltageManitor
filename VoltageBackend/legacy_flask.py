import json
import socket
import threading
from pathlib import Path
from queue import Queue, Empty
from flask import Flask, request, jsonify, send_file, send_from_directory, Response

app = Flask(__name__)

# React (Vite) build natijasi: VoltageFronend/dist
DIST_DIR = Path(__file__).resolve().parent.parent / "VoltageFronend" / "dist"

# state = {"11": 0, "12": 1, ...} - har bir qurilmaning holati
state = {}
listeners = []


def notify(payload):
    """payload: {"id": "11", "value": 1}"""
    for q in list(listeners):
        q.put(payload)


def set_state(dev_id, value):
    dev_id = str(dev_id)
    value = int(value)
    state[dev_id] = value
    notify({"id": dev_id, "value": value})


# ============ Xom TCP listener (ESP32 uchun, port 5001) ============
# ESP32 yuboradi: "11:1\n" (ID 11 -> 1) yoki "11:0\n"
# Pinggy: ssh -p 443 -R0:localhost:5001 tcp@a.pinggy.io

def tcp_listener(port=5001):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    s.bind(("0.0.0.0", port))
    s.listen(5)
    print(f"Raw TCP listener :{port} (ESP32 uchun)")
    while True:
        conn, addr = s.accept()
        print(f"ESP32 ulandi: {addr}")
        threading.Thread(target=handle_client, args=(conn,), daemon=True).start()


def handle_client(conn):
    try:
        conn.settimeout(180)
        buf = b""
        while True:
            data = conn.recv(64)
            if not data:
                break
            buf += data
            while b"\n" in buf:
                line, buf = buf.split(b"\n", 1)
                line = line.strip().decode("ascii", "ignore")
                # Format: "id:value"
                if ":" in line:
                    dev_id, val = line.split(":", 1)
                    dev_id = dev_id.strip()
                    val = val.strip()
                    if dev_id and val in ("0", "1"):
                        set_state(dev_id, val)
                        print(f"  [TCP] {dev_id} -> {val}")
    except Exception:
        pass
    finally:
        conn.close()


# ============ HTTP / SSE (brauzer uchun) ============

@app.route("/update")
def update():
    # /update?id=11&value=1  yoki  /update?value=1 (id=default)
    dev_id = request.args.get("id", "default")
    val = request.args.get("value", "")
    if val not in ("0", "1"):
        return jsonify(ok=False, error="value 0 yoki 1"), 400
    set_state(dev_id, val)
    return jsonify(ok=True, id=dev_id, value=int(val))


@app.route("/status")
def status():
    response = jsonify(state)
    response.headers["Access-Control-Allow-Origin"] = "*"
    return response


@app.route("/events")
def events():
    def stream():
        q = Queue()
        listeners.append(q)
        try:
            # Ulanish boshida hammasini yuboramiz
            yield f"data: {json.dumps({'all': state})}\n\n"
            while True:
                try:
                    v = q.get(timeout=15)
                except Empty:
                    # Heartbeat: o'lik ulanishlarni aniqlash va tunnel/proksi
                    # tomonidan bo'sh ulanish uzilib qolmasligi uchun
                    yield ": ping\n\n"
                    continue
                yield f"data: {json.dumps(v)}\n\n"
        finally:
            if q in listeners:
                listeners.remove(q)
    return Response(stream(), mimetype="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
        "Access-Control-Allow-Origin": "*",
    })


@app.route("/")
def index():
    index_file = DIST_DIR / "index.html"
    if not index_file.exists():
        return (
            "Frontend hali build qilinmagan. VoltageFronend ichida "
            "'npm install && npm run build' ishga tushiring.",
            503,
        )
    return send_file(index_file)


@app.route("/assets/<path:filename>")
def assets(filename):
    # Vite build qilgan JS/CSS fayllar
    return send_from_directory(DIST_DIR / "assets", filename)


@app.route("/<path:filename>")
def static_files(filename):
    # dist ichidagi boshqa statik fayllar (favicon, vite.svg, ...)
    target = DIST_DIR / filename
    if target.is_file():
        return send_file(target)
    # Topilmasa SPA index.html ga qaytaramiz
    index_file = DIST_DIR / "index.html"
    if index_file.exists():
        return send_file(index_file)
    return ("Not found", 404)


if __name__ == "__main__":
    threading.Thread(target=tcp_listener, daemon=True).start()
    app.run(host="0.0.0.0", port=5000, threaded=True)
