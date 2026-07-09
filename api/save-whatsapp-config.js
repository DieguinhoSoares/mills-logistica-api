// api/save-whatsapp-config.js
// Salva telefone/apikey do CallMeBot — só Supervisor/Gerente/Master, checado
// pelo token de login do Firebase (nunca confia em nada vindo do client sem
// verificar contra o Firestore de verdade).
const admin = require('./_firebaseAdmin')
const { setCors, verificarToken } = require('./_firebaseAdmin')

module.exports = async (req, res) => {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const decoded = await verificarToken(req)
  if (!decoded) return res.status(401).json({ error: 'É preciso estar logado.' })

  try {
    const { phone, apikey } = req.body || {}
    if (!phone || !apikey) return res.status(400).json({ error: 'Telefone e API key são obrigatórios.' })

    const userSnap = await admin.firestore().doc(`users/${decoded.uid}`).get()
    const role = userSnap.exists ? userSnap.data().role : null
    if (!['supervisor', 'gerente', 'master'].includes(role)) {
      return res.status(403).json({ error: 'Apenas Supervisor, Gerente ou Master podem configurar o WhatsApp.' })
    }

    await admin.firestore().doc('secrets/whatsapp').set({
      phone, apikey,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: decoded.uid,
    })
    return res.status(200).json({ ok: true })
  } catch (e) {
    console.error('Erro ao salvar config do WhatsApp:', e)
    return res.status(500).json({ error: e.message })
  }
}
