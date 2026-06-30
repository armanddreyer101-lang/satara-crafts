import crypto from 'crypto';

const PB_URL = 'https://satara-crafts.pockethost.io';
const VALIDATE_URL = 'https://www.payfast.co.za/eng/query/validate'; // LIVE validation endpoint

function buildSignature(data, passphrase) {
  let pairs = [];
  for (const key in data) {
    if (key === 'signature') continue;
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

async function getAdminToken() {
  const res = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identity: process.env.POCKETBASE_ADMIN_EMAIL,
      password: process.env.POCKETBASE_ADMIN_PASSWORD
    })
  });
  if (!res.ok) throw new Error('PocketBase admin auth failed');
  const data = await res.json();
  return data.token;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  try {
    const data = req.body;

    const expectedSig = buildSignature(data, process.env.PAYFAST_PASSPHRASE);
    if (expectedSig !== data.signature) {
      console.error('PayFast ITN: signature mismatch');
      return res.status(400).send('Invalid signature');
    }

    if (data.merchant_id !== process.env.PAYFAST_MERCHANT_ID) {
      console.error('PayFast ITN: merchant_id mismatch');
      return res.status(400).send('Invalid merchant');
    }

    const params = new URLSearchParams(data).toString();
    const validateRes = await fetch(VALIDATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });
    const validateText = (await validateRes.text()).trim();
    if (validateText !== 'VALID') {
      console.error('PayFast ITN: validation failed', validateText);
      return res.status(400).send('Validation failed');
    }

    if (data.payment_status !== 'COMPLETE') {
      return res.status(200).send('OK');
    }

    const orderId = data.m_payment_id;
    const token = await getAdminToken();

    const updateRes = await fetch(`${PB_URL}/api/collections/orders/records/${orderId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        status: 'paid',
        pf_payment_id: data.pf_payment_id || '',
        amount_paid: data.amount_gross || ''
      })
    });

    if (!updateRes.ok) {
      console.error('Failed to update order', await updateRes.text());
      return res.status(500).send('Order update failed');
    }

    return res.status(200).send('OK');

  } catch (err) {
    console.error('PayFast ITN error:', err);
    return res.status(500).send('Server error');
  }
}