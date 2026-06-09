"""Google Maps havolasidan koordinata olish.

Qisqa havola (maps.app.goo.gl) redirect qiladi — server uni ochib, yakuniy
URL/sahifadan lat/lon ajratadi. SSRF'ga qarshi faqat Google domenlari ruxsat etiladi.
"""
import asyncio
import re
import urllib.request
from urllib.parse import unquote, urlparse

from fastapi import APIRouter, Depends, HTTPException, Query

from ..deps import require_permission
from ..rbac import Permission

router = APIRouter(prefix="/geo", tags=["geo"])

ALLOWED_HOSTS = {
    "maps.app.goo.gl",
    "goo.gl",
    "maps.google.com",
    "www.google.com",
    "google.com",
}

# Eng ishonchlisidan boshlab: !3d<lat>!4d<lon> -> @<lat>,<lon> -> q/ll= -> umumiy
_PATTERNS = [
    re.compile(r"!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)"),
    re.compile(r"@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)"),
    re.compile(r"[?&](?:q|ll|center|daddr|destination)=(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)"),
    re.compile(r"(-?\d{1,2}\.\d{4,}),\s*(-?\d{1,3}\.\d{4,})"),
]

_UA = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)


def _fetch(url: str) -> tuple[str, str]:
    req = urllib.request.Request(url, headers={"User-Agent": _UA})
    with urllib.request.urlopen(req, timeout=10) as resp:
        final = resp.geturl()
        body = resp.read(300_000).decode("utf-8", "ignore")
    return final, body


@router.get(
    "/resolve",
    dependencies=[Depends(require_permission(Permission.DEVICE_MANAGE))],
)
async def resolve_maps_link(url: str = Query(..., max_length=2048)):
    host = (urlparse(url).hostname or "").lower()
    if host not in ALLOWED_HOSTS:
        raise HTTPException(status_code=400, detail="Faqat Google Maps havolasi qabul qilinadi")

    try:
        final, body = await asyncio.to_thread(_fetch, url)
    except Exception:  # noqa: BLE001
        raise HTTPException(status_code=502, detail="Havolani ochib bo'lmadi")

    # Yakuniy URL, uning dekodlangani va sahifa matnidan qidiramiz
    for text in (unquote(final), final, body):
        for pat in _PATTERNS:
            m = pat.search(text)
            if m:
                lat, lon = float(m.group(1)), float(m.group(2))
                if -90 <= lat <= 90 and -180 <= lon <= 180:
                    return {"lat": round(lat, 6), "lon": round(lon, 6)}

    raise HTTPException(status_code=404, detail="Havoladan koordinata topilmadi")
