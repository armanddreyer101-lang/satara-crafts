export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, phone, subject, message, deadline, style } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Satara Crafts Website <onboarding@resend.dev>',
        to: ['bets@sataracrafts.co.za', 'sexi.betsi@yahoo.com'],
        reply_to: email,
        subject: `New Enquiry: ${subject || 'General enquiry'} — from ${name}`,
        html: `
          <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f5f0;">
            <div style="background: #3a2e26; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="color: #c5a267; margin: 0; font-size: 28px;">Satara <em>Crafts</em></h1>
              <p style="color: #f9f5f0; margin: 8px 0 0; font-family: Arial; font-size: 13px; letter-spacing: 2px; text-transform: uppercase;">New Website Enquiry</p>
            </div>
            <div style="background: #fff; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f0e9e0; font-family: Arial; font-size: 13px; color: #5a4a3a; width: 35%;"><strong>Name</strong></td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f0e9e0; font-family: Arial; font-size: 13px; color: #3a2e26;">${name}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f0e9e0; font-family: Arial; font-size: 13px; color: #5a4a3a;"><strong>Email</strong></td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f0e9e0; font-family: Arial; font-size: 13px; color: #3a2e26;"><a href="mailto:${email}" style="color: #c5a267;">${email}</a></td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f0e9e0; font-family: Arial; font-size: 13px; color: #5a4a3a;"><strong>Phone</strong></td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f0e9e0; font-family: Arial; font-size: 13px; color: #3a2e26;">${phone || '—'}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f0e9e0; font-family: Arial; font-size: 13px; color: #5a4a3a;"><strong>Subject</strong></td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f0e9e0; font-family: Arial; font-size: 13px; color: #3a2e26;">${subject || 'General enquiry'}</td>
                </tr>
                ${deadline ? `<tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f0e9e0; font-family: Arial; font-size: 13px; color: #5a4a3a;"><strong>Deadline</strong></td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f0e9e0; font-family: Arial; font-size: 13px; color: #3a2e26;">${deadline}</td>
                </tr>` : ''}
                ${style ? `<tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f0e9e0; font-family: Arial; font-size: 13px; color: #5a4a3a;"><strong>Style Notes</strong></td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f0e9e0; font-family: Arial; font-size: 13px; color: #3a2e26;">${style}</td>
                </tr>` : ''}
              </table>

              <div style="margin-top: 24px;">
                <p style="font-family: Arial; font-size: 13px; color: #5a4a3a; margin: 0 0 8px;"><strong>Message:</strong></p>
                <div style="background: #f9f5f0; padding: 16px; border-radius: 8px; font-family: Arial; font-size: 14px; color: #3a2e26; line-height: 1.6; border-left: 3px solid #c5a267;">
                  ${message.replace(/\n/g, '<br>')}
                </div>
              </div>

              <div style="margin-top: 24px; text-align: center;">
                <a href="mailto:${email}?subject=Re: ${subject || 'Your Satara Crafts enquiry'}" 
                   style="background: #c5a267; color: #fff; padding: 12px 24px; border-radius: 30px; text-decoration: none; font-family: Arial; font-size: 13px; font-weight: bold;">
                  Reply to ${name}
                </a>
              </div>
            </div>
            <p style="text-align: center; font-family: Arial; font-size: 11px; color: #aaa; margin-top: 16px;">
              Sent from sataracrafts.co.za
            </p>
          </div>
        `
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Resend error:', data);
      return res.status(500).json({ error: 'Failed to send email' });
    }

    return res.status(200).json({ success: true, id: data.id });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}