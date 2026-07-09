// api/send-whatsapp.js
// Chamado explicitamente pelo client (useFirestore.js) logo depois de criar
// ou aprovar uma solicitação — substitui o gatilho automático do Firestore
// que teríamos no Cloud Functions (que exige plano pago). O resultado final
// pro usuário é o mesmo: a key do CallMeBot nunca é exposta ao navegador,
// só este endpoint no servidor a conhece.
const admin = require('./_firebaseAdmin')
const { setCors } = require('./_firebaseAdmin')

module.exports = async (req, res) => {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { mensagem } = req.body || {}
    if (!mensagem) return res.status(400).json({ error: 'Mensagem é obrigatória.' })

    const snap = await admin.firestore().doc('secrets/whatsapp').get()
    if (!snap.exists) return res.status(200).json({ ok: true, skipped: 'não configurado' })
    const { phone, apikey } = snap.data()
    if (!phone || !apikey) return res.status(200).json({ ok: true, skipped: 'não configurado' })

    const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(mensagem)}&apikey=${encodeURIComponent(apikey)}`
    const r = await fetch(url)
    const text = await r.text()
    if (!r.ok || /error/i.test(text)) {
      console.warn('CallMeBot possível erro:', text.slice(0, 300))
    }
    return res.status(200).json({ ok: true })
  } catch (e) {
    console.error('Erro ao enviar WhatsApp:', e)
    return res.status(500).json({ error: e.message })
  }
}
