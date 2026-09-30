// Vercel serverless function: signed-in users only. Needs ANTHROPIC_API_KEY set in Vercel.
const SUPABASE_URL = 'https://wfbkamfrurtchmzsuvot.supabase.co';
const SUPABASE_KEY = 'sb_publishable_H3B6_88ddh6BmqIwhCnauQ_YwnQg1vK';

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'AI is not configured yet (missing ANTHROPIC_API_KEY).' });

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const who = await fetch(SUPABASE_URL + '/auth/v1/user', { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + token } });
  if (!who.ok) return res.status(401).json({ error: 'Please sign in to use AI writing.' });

  const { hint = '', current = '', job = '', context = {} } = req.body || {};
  const prompt =
    `Write ${String(hint).slice(0, 300)}.\n\n` +
    (job ? `Target job description:\n${String(job).slice(0, 4000)}\n\n` : '') +
    `Candidate details (JSON):\n${JSON.stringify(context).slice(0, 8000)}\n\n` +
    (current ? `Existing draft to improve:\n${String(current).slice(0, 2000)}\n\n` : '') +
    'Return only the finished text.';

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
        max_tokens: 700,
        system: 'You are an expert CV and cover letter writer. Output only the requested text: no preamble, no quotation marks, no markdown, no bullet symbols (one item per line for lists). Use only facts the candidate supplied; never invent employers, degrees, dates, certifications or numbers. Tailor wording to the target job when one is given.',
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const j = await r.json();
    if (!r.ok) return res.status(502).json({ error: (j.error && j.error.message) || 'AI request failed' });
    const text = j.content.map(c => c.text || '').join('').split('\n').map(l => l.replace(/^\s*[-•*]\s*/, '')).join('\n').trim();
    res.status(200).json({ text });
  } catch (e) {
    res.status(500).json({ error: 'AI request failed' });
  }
};
