// توليد مفاتيح VAPID جديدة — شغّل: node generate-vapid.js
const crypto = require('crypto');
const e = crypto.createECDH('prime256v1');
e.generateKeys();
const priv = e.getPrivateKey();
const pubBytes = e.getPublicKey('', 'uncompressed');
const b64u = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
console.log('VAPID_PUBLIC_KEY  = ' + b64u(pubBytes));
console.log('VAPID_PRIVATE_KEY = ' + b64u(priv));