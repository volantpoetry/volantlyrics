// ============================================================
// FILE: api/lyrics-notify-commission.js (volantpoetry.vercel.app)
// ============================================================
// Best-effort email to notify a songwriter about a custom-lyrics
// commission request. Degrades gracefully if RESEND_API_KEY is
// unset — the request is still saved to Firestore (by the client)
// and shown in the songwriter's Manage -> Requests inbox.
// ============================================================

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }
    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const { to, toName, fromName, fromEmail, budget, details, requestId } = body;

        if (!toName) {
            return res.status(400).json({ ok: false, error: 'Missing songwriter name' });
        }
        if (!/:/.test(String(to || ''))) {
            return res.status(400).json({ ok: false, error: 'Missing songwriter email' });
        }

        const key = process.env.RESEND_API_KEY;
        const from = process.env.MAIL_FROM || 'Volant Lyrics <no-reply@resend.dev>';
        if (!key) {
            return res.status(200).json({ ok: true, sent: 0, skipped: 1, note: 'RESEND_API_KEY not set; in-app notification only' });
        }

        const subject = `✏️ You have a new custom-lyrics request from ${fromName}`;
        const html = `
            <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#faf9fe;border-radius:12px;">
                <h2 style="color:#4b2aad;margin-top:0;">New custom-lyrics request</h2>
                <p style="color:#555;font-size:16px;">Hi <strong>${toName}</strong>, someone wants you to write a song.</p>
                <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:15px;">
                    <tr><td style="padding:8px 10px;font-weight:700;color:#1a1a2e;">Name</td><td style="padding:8px 10px;color:#555;">${fromName || 'Anonymous buyer'}</td></tr>
                    <tr><td style="padding:8px 10px;font-weight:700;color:#1a1a2e;">Email</td><td style="padding:8px 10px;color:#555;">${fromEmail || 'Not provided'}</td></tr>
                    <tr><td style="padding:8px 10px;font-weight:700;color:#1a1a2e;">Budget</td><td style="padding:8px 10px;color:#555;">GHS ${Number(budget) || 0}</td></tr>
                </table>
                <div style="background:#f0edff;border:1px solid #e2daf5;border-radius:10px;padding:14px;color:#4a4458;white-space:pre-wrap;">${String(details || '').slice(0, 3000)}</div>
                <p style="margin-top:24px;color:#8a8a8a;font-size:13px;">Reply on the thread or in your Volant Lyrics Manager to agree a price and deliver the song.</p>
            </div>
        `;

        const r = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ from, to, subject, html })
        });

        if (!r.ok) {
            const err = await r.text().catch(() => r.statusText);
            return res.status(502).json({ ok: false, error: 'Email provider rejected request', detail: err });
        }
        return res.status(200).json({ ok: true, sent: 1 });
    } catch (e) {
        return res.status(500).json({ ok: false, error: String(e.message || e) });
    }
}