import crypto from 'crypto';

const PAYFAST_URL = 'https://www.payfast.co.za/eng/process'; // LIVE endpoint

function buildSignature(data, passphrase) {
  let pairs = [];
  for (const key in data) {
    if (data[key] !== '' && data[key] !== undefined && data[key] !== null) {
      pairs.push(`${key}=${encodeURIComponent(data[key].toString().trim()).replace(/%20/g, '+')}`);
    }
  }
  let str = pairs.join('&');
  if (passphrase) {
    str += `&passphrase=${encodeURIComponent(passphrase.trim()).replace(/%20/g, '+')}`;
  }
  return crypto.createHash('md5').update(str).digest('hex');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { order_id, amount, item_name, name, email } = req.body;

  if (!order_id || !amount || !item_name || !email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const siteUrl = process.env.SITE_URL || 'https://satara-crafts.vercel.app';

  const data = {
    merchant_id:  process.env.PAYFAST_MERCHANT_ID,
    merchant_key: process.env.PAYFAST_MERCHANT_KEY,
    return_url:   `${siteUrl}/index.html?payment=success`,
    cancel_url:   `${siteUrl}/index.html?payment=cancelled`,
    notify_url:   `${siteUrl}/api/payfast-notify`,
    name_first:   (name || '').split(' ')[0] || 'Customer',
    email_address: email,
    m_payment_id: order_id,
    amount:       Number(amount).toFixed(2),
    item_name:    item_name.substring(0, 100)
  };

  data.signature = buildSignature(data, process.env.PAYFAST_PASSPHRASE);

  return res.status(200).json({ action: PAYFAST_URL, fields: data });
}