// api/notify-roles.js
// Corrige o bug em que notifyRoles() no client falhava silenciosamente
// sempre que quem disparava a notificação NÃO era da equipe (ex: Solicitante
// criando um pedido que vai direto pra fila da Frotas, sem aprovação): a
// consulta a `users` filtrando por role é bloqueada pelas Firestore Rules
// pra qualquer um que não seja staff — de propósito, pra não expor nome/
// e-mail/role de toda a equipe pra qualquer usuário logado.
//
// Rodando aqui com o Admin SDK, a consulta ignora as Rules (é servidor,
// não navegador) e cria a notificação pra cada usuário do(s) role(s) pedido,
// disparando também o push de cada um.
const admin = require('./_firebaseAdmin')
const { setCors } = require('./_firebaseAdmin')

module.exports = async (req, res) => {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { roles, type, title, message, requestId } = req.body || {}
    if (!Array.isArray(roles) || !roles.length) return res.status(400).json({ error: 'roles é obrigatório (array).' })
    if (!type || !title || !message) return res.status(400).json({ error: 'type, title e message são obrigatórios.' })

    const snap = await admin.firestore()
      .collection('users')
      .where('role', 'in', roles)
      .where('status', '==', 'ativo')
      .get()

    const criadas = []
    await Promise.all(snap.docs.map(async (userDoc) => {
      const notifRef = await admin.firestore().collection('notifications').add({
        userId: userDoc.id, type, title, message,
        ...(requestId ? { requestId } : {}),
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })
      criadas.push(userDoc.id)

      // Dispara o push de cada um (mesma lógica do send-push.js)
      const tokens = userDoc.data().fcmTokens || []
      if (tokens.length) {
        const result = await admin.messaging().sendEachForMulticast({
          notification: { title, body: message },
          data: { notificationId: notifRef.id, requestId: requestId || '' },
          tokens,
        })
        const tokensInvalidos = []
        result.responses.forEach((r, i) => {
          if (!r.success && ['messaging/invalid-registration-token', 'messaging/registration-token-not-registered'].includes(r.error?.code)) {
            tokensInvalidos.push(tokens[i])
          }
        })
        if (tokensInvalidos.length) {
          await admin.firestore().doc(`users/${userDoc.id}`).update({
            fcmTokens: admin.firestore.FieldValue.arrayRemove(...tokensInvalidos),
          })
        }
      }
    }))

    return res.status(200).json({ ok: true, notificados: criadas.length })
  } catch (e) {
    console.error('Erro em notify-roles:', e)
    return res.status(500).json({ error: e.message })
  }
}
