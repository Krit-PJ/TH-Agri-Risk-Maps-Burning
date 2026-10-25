/* ติดต่อ Backend (Google Apps Script) + จัดการ Session */
const Api = (() => {
  const SESSION_KEY = 'agri-risk-session-v3';
  const configured = () => Boolean(CONFIG.API_URL);

  async function get(action, params = {}) {
    if (!configured()) throw new Error('ยังไม่ได้ตั้งค่า API_URL ใน js/config.js');
    const q = new URLSearchParams({ action, ...params, _: Date.now() });
    const res = await fetch(`${CONFIG.API_URL}?${q}`, { method: 'GET' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด');
    return data;
  }

  // ส่งแบบ text/plain เพื่อเลี่ยง CORS preflight ของ Apps Script
  async function post(action, body = {}, withToken = true) {
    if (!configured()) throw new Error('ยังไม่ได้ตั้งค่า API_URL ใน js/config.js');
    const payload = { action, ...body };
    if (withToken) payload.token = session()?.token || '';
    const res = await fetch(CONFIG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.ok) {
      if (String(data.error || '').startsWith('AUTH:')) { clearSession(); document.dispatchEvent(new CustomEvent('agri-risk:auth-changed')); }
      throw new Error(String(data.error || 'เกิดข้อผิดพลาด').replace(/^AUTH:\s*/, ''));
    }
    return data;
  }

  function session() {
    try {
      const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
      if (!s || !s.exp || Date.now() > s.exp) { sessionStorage.removeItem(SESSION_KEY); return null; }
      return s;
    } catch { return null; }
  }
  function saveSession(token, user) {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token, user, exp: Date.now() + 8 * 3600e3 })); } catch { }
    document.dispatchEvent(new CustomEvent('agri-risk:auth-changed'));
  }
  function clearSession() { try { sessionStorage.removeItem(SESSION_KEY); } catch { } }

  /** เบอร์โทร: ตัดอักขระอื่น และคืนเลข 0 นำหน้าที่อาจหายไป */
  function normalizePhone(v) {
    let s = String(v ?? '').replace(/\D/g, '');
    if (s.startsWith('66') && s.length === 11) s = '0' + s.slice(2);
    if (s.length === 9 && s[0] !== '0') s = '0' + s;
    return s;
  }

  return { configured, get, post, session, saveSession, clearSession, normalizePhone };
})();
