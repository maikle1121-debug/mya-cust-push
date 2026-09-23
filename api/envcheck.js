// GET /api/envcheck
module.exports = async (req, res) => {
  const names = ['REST_APIKEY', 'REST_BASE', 'VAPID_SUBJECT', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'];
  const out = { at: new Date().toISOString() };
  names.forEach((n) => { out[n] = (typeof process.env[n] === 'string') && process.env[n].length > 0; });
  res.status(200).setHeader('Content-Type', 'application/json');
  return res.end(JSON.stringify(out));
};
