// POST /api/push-subscribe
// Body: { subscription } أو { vatId, subscription } — الـ vatId اختياري الآن.
// الاشتراك هنا "عالمي" تقصدي: أي عميل جديد من أي حساب هيوصله إشعار.
const crypto = require('crypto');
const REST_BASE = (process.env.REST_BASE || 'https://mya-alpha.vercel.app').replace(/\/+$/, '');

function json(res, code, obj) {
  res.status(code).setHeader('Content-Type', 'application/json');
  return res.end(JSON.stringify(obj));
}

module.exports = async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' });

    const body = (typeof req.body === 'object') ? req.body : {};
    const vatId = String(body.vatId || '').trim();
    const sub = body.subscription || body;
    if (!sub) return json(res, 400, { error: 'subscription مطلوب' });

    let endpoint = sub.endpoint || '';
    let keys = sub.keys || null;
    let token = sub.token || '';
    let type = sub.type || (endpoint ? 'webpush' : (token ? 'fcm' : 'unknown'));

    const seed = endpoint || token || String(Date.now());
    const hash = crypto.createHash('sha1').update(seed).digest('hex').slice(0, 16);
    const id = 'sub_global_' + hash;

    const row = {
      id,
      vat_id: vatId || 'global',
      store: 'push_subscriptions',
      data: {
        id,
        type,
        endpoint,
        keys,
        token,
        device: String(sub.device || body.device || ''),
        workspace: String(sub.workspace || ''),
        vatId: vatId || 'global',
        global: !vatId,
        registeredAt: new Date().toISOString()
      },
      updated_at: new Date().toISOString()
    };

    const fetchRes = await fetch(REST_BASE + '/rest/v1/eta_records?on_conflict=id', {
      method: 'POST',
      headers: {
        'apikey': process.env.REST_APIKEY,
        'Content-Type': 'application/json',
        'x-vat-id': vatId || 'global',
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify(row)
    });
    if (!fetchRes.ok) return json(res, 502, { error: 'rest error ' + fetchRes.status });

    return json(res, 200, { ok: true, id, global: !vatId });
  } catch (e) {
    return json(res, 500, { error: String((e && e.message) || e) });
  }
};