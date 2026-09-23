// GET/POST /api/notify-customers
// يرسل Web Push لكل الاشتراكات عند أي عميل جديد (من أي حساب).
const webpush = (() => { try { return require('web-push'); } catch (e) { return null; } })();

// رابط ومفتاح قاعدة البيانات مثبتان داخل الكود (مش من env).
const REST_BASE = 'https://mya-alpha.vercel.app';
const REST_APIKEY = 'sb_publishable_xQcMrCMwwggfAKggkxfYxQ_Ty0DbgRK';

// مفاتيح VAPID مثبتة داخل الكود (أي قيم غلط في env لن تؤثر).
const VAPID_PUBLIC  = 'BBMarC-ffcX6k7X0k9JVvbh8qs847GGGU-lg5yHCkcOqzRIHEjP_9_MVFYcGeKkuMSn3kn5Lpw1r_oj046mka_8';
const VAPID_PRIVATE = 'fFCP3dRn4Q9989ysQVeVAYrs9yMWY0-6L56HkNAHgGQ';
const VAPID_SUBJECT = 'mailto:you@example.com';

function json(res, code, obj) {
  res.status(code).setHeader('Content-Type', 'application/json');
  return res.end(JSON.stringify(obj));
}

async function apiGet(query) {
  const r = await fetch(REST_BASE + '/rest/v1/eta_records?' + query, {
    headers: { 'apikey': REST_APIKEY, 'Content-Type': 'application/json' }
  });
  if (!r.ok) throw new Error('rest ' + r.status);
  return await r.json();
}

async function apiPost(row) {
  await fetch(REST_BASE + '/rest/v1/eta_records?on_conflict=id', {
    method: 'POST',
    headers: {
      'apikey': REST_APIKEY,
      'Content-Type': 'application/json',
      'x-vat-id': row.vat_id || '',
      'Prefer': 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify(row)
  });
}

function unwrapRow(r) {
  if (!r || !r.data) return null;
  const d = (typeof r.data === 'object') ? r.data : null;
  if (!d) return null;
  let inner = null;
  if (d['0'] && typeof d['0'] === 'object') inner = d['0'];
  else if (d.data && typeof d.data === 'object') inner = d;
  else return null;
  const store = inner.store || '';
  const vatId = String(inner.vat_id || r.vat_id || '').trim();
  const payload = (inner.data && typeof inner.data === 'object') ? inner.data : null;
  return { store, vatId, payload };
}

module.exports = async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'GET' && req.method !== 'POST') return json(res, 405, { error: 'method not allowed' });

    if (!webpush) {
      return json(res, 500, { error: 'WEBPUSH_NOT_INSTALLED' });
    }
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

    const rows = await apiGet('select=id,data,updated_at&order=updated_at.desc&limit=500');

    const events = [];
    const allSubs = [];
    const lastMap = {};
    const subKeys = {};
    (rows || []).forEach((r) => {
      const u = unwrapRow(r);
      if (!u || !u.payload) return;
      if (u.store === 'notifications' && u.payload.kind === 'customer_added') {
        const vk = (u.vatId || 'anon') + '_' + String(u.payload.customerId || 'x');
        const fp = u.payload.customerUpdatedAt || r.updated_at || '';
        const existing = events.find((ev) => ev.vk === vk);
        if (!existing) events.push({ vk, fp, vatId: u.vatId, customerId: String(u.payload.customerId || 'x') });
        else if (fp > existing.fp) existing.fp = fp;
      } else if (u.store === 'push_subscriptions' && u.payload.endpoint) {
        if (!subKeys[u.payload.endpoint]) {
          subKeys[u.payload.endpoint] = true;
          allSubs.push({ endpoint: u.payload.endpoint, keys: u.payload.keys });
        }
      } else if (u.store === 'push_last') {
        lastMap[u.payload.vatId + '_' + (u.payload.customerId || 'x')] = u.payload.updatedAt || '';
      }
    });

    let sent = 0, skipped = 0, noSubs = 0, errors = 0, details = [];
    for (const ev of events) {
      const fp = ev.fp;
      if (lastMap[ev.vk] === fp) { skipped++; continue; }
      const subs = allSubs;
      const eventRow = (rows || []).find((r) => {
        const u = unwrapRow(r);
        return u && u.store === 'notifications' && u.payload.kind === 'customer_added'
          && (u.vatId || 'anon') === ev.vatId && String(u.payload.customerId) === ev.customerId;
      });
      const u = eventRow ? unwrapRow(eventRow) : null;
      const p = u ? u.payload : null;
      const name = (p && p.name) || 'عميل جديد';
      const email = (p && p.email) || '';
      const total = (p && p.total) || 0;

      if (!subs.length) { noSubs++; continue; }

      let okCount = 0;
      for (const sub of subs) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: sub.keys || {} },
            JSON.stringify({
              title: '🛎️ عميل جديد دخل!',
              body: name + (email ? ' — ' + email : '') + ' | إجمالي العملاء: ' + total,
              icon: REST_BASE + '/icons/logo128.png',
              tag: 'mya-cust-' + ev.vk,
              vatId: ev.vatId, customerId: ev.customerId, total
            })
          );
          okCount++;
        } catch (e) { errors++; }
      }
      sent += okCount;
      details.push({ vatId: ev.vatId, customerId: ev.customerId, name, sent: okCount, subs: subs.length });
      await apiPost({
        id: 'last_' + String(ev.vk).replace(/[^A-Za-z0-9_-]/g, '_'),
        vat_id: ev.vatId,
        store: 'push_last',
        data: { vatId: ev.vatId, customerId: ev.customerId, updatedAt: fp, sentAt: new Date().toISOString() },
        updated_at: new Date().toISOString()
      });
    }

    return json(res, 200, { ok: true, sent, skipped, noSubs, errors, details, at: new Date().toISOString() });
  } catch (e) {
    return json(res, 500, { error: String((e && e.message) || e) });
  }
};
