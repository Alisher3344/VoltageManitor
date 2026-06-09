"""DB'siz ishlaydigan birlik testlar: RBAC, parol, CORS, ingest change-only logikasi."""
from app.config import Settings
from app.models import Device, DeviceEvent
from app.rbac import Permission, RoleName, role_has_permission
from app.security import hash_password, verify_password
from app.services.ingest import set_state


# ---------- RBAC ----------
def test_admin_has_all_permissions():
    for p in Permission:
        assert role_has_permission(RoleName.ADMIN, p)


def test_operator_cannot_manage_users():
    assert role_has_permission(RoleName.OPERATOR, Permission.DEVICE_WRITE)
    assert not role_has_permission(RoleName.OPERATOR, Permission.USER_MANAGE)


def test_viewer_read_only():
    assert role_has_permission(RoleName.VIEWER, Permission.DEVICE_READ)
    assert not role_has_permission(RoleName.VIEWER, Permission.DEVICE_WRITE)


def test_unknown_role_has_nothing():
    assert not role_has_permission("ghost", Permission.DEVICE_READ)


# ---------- Parol ----------
def test_password_roundtrip():
    h = hash_password("correct horse battery")
    assert verify_password("correct horse battery", h)
    assert not verify_password("wrong", h)


# ---------- CORS ----------
def test_cors_wildcard():
    assert Settings(cors_origins="*").cors_list == ["*"]


def test_cors_list_parsing():
    s = Settings(cors_origins="https://a.com, https://b.com ,")
    assert s.cors_list == ["https://a.com", "https://b.com"]


# ---------- Ingest: faqat o'zgarganda tarix yoziladi ----------
class FakeSession:
    def __init__(self, device=None):
        self._device = device
        self.added = []

    async def get(self, _model, _pk):
        return self._device

    def add(self, obj):
        self.added.append(obj)
        if isinstance(obj, Device):
            self._device = obj

    async def commit(self):
        pass


class FakeRedis:
    def __init__(self):
        self.published = []

    async def publish(self, channel, message):
        self.published.append((channel, message))


def _events(session):
    return [o for o in session.added if isinstance(o, DeviceEvent)]


async def test_no_event_when_value_unchanged():
    dev = Device(id="11", last_value=1)
    s, r = FakeSession(dev), FakeRedis()
    await set_state(s, r, "11", 1)  # keepalive, bir xil qiymat
    assert _events(s) == []
    assert dev.last_seen is not None  # last_seen baribir yangilanadi
    assert len(r.published) == 1  # SSE baribir e'lon qilinadi


async def test_event_when_value_changes():
    dev = Device(id="11", last_value=1)
    s, r = FakeSession(dev), FakeRedis()
    await set_state(s, r, "11", 0)
    assert len(_events(s)) == 1
    assert _events(s)[0].value == 0


async def test_new_device_creates_and_logs():
    s, r = FakeSession(None), FakeRedis()
    await set_state(s, r, "99", 1)
    assert any(isinstance(o, Device) for o in s.added)
    assert len(_events(s)) == 1
