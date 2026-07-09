// api/send-push.js
// Chamado explicitamente logo depois que uma notificação é criada no
// Firestore (dentro de notifyUser/notifyRoles, em useFirestore.js) —
// substitui o gatilho automático que o Cloud Functions faria sozinho.
const admin = require('./_firebaseAdmin')
const { setCors } = require('./_firebaseAdmin')

module.exports = async (req, res) => {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { userId, title, message, notificationId, requestId } = req.body || {}
    if (!userId) return res.status(400).json({ error: 'userId é obrigatório.' })

    const userSnap = await admin.firestore().doc(`users/${userId}`).get()
    const tokens = userSnap.exists ? (userSnap.data().fcmTokens || []) : []
    if (!tokens.length) return res.status(200).json({ ok: true, skipped: 'sem dispositivo com push ativado' })

    const result = await admin.messaging().sendEachForMulticast({
      notification: { title: title || 'Mills Logística', body: message || '' },
      data: { notificationId: notificationId || '', requestId: requestId || '' },
      tokens,
    })

    // Limpa tokens inválidos/expirados
    const tokensInvalidos = []
    result.responses.forEach((r, i) => {
      if (!r.success && ['messaging/invalid-registration-token', 'messaging/registration-token-not-registered'].includes(r.error?.code)) {
        tokensInvalidos.push(tokens[i])
      }
    })
    if (tokensInvalidos.length) {
      await admin.firestore().doc(`users/${userId}`).update({
        fcmTokens: admin.firestore.FieldValue.arrayRemove(...tokensInvalidos),
      })
    }

    return res.status(200).json({ ok: true })
  } catch (e) {
    console.error('Erro ao enviar push:', e)
    return res.status(500).json({ error: e.message })
  }
}
