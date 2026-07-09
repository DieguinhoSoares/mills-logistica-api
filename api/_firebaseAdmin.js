// api/_firebaseAdmin.js
// Inicializa o Firebase Admin SDK uma única vez, reaproveitado por todas as
// funções da pasta /api. As credenciais vêm de variáveis de ambiente da
// Vercel (Settings → Environment Variables, pela interface web — sem CLI),
// nunca de um arquivo commitado no repositório.
const admin = require('firebase-admin')

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Vercel guarda quebras de linha como "\n" literal no valor da env var —
      // precisa converter de volta pra quebra de linha real, senão a chave
      // privada não é lida corretamente.
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
  })
}

module.exports = admin

// Cabeçalhos de CORS — necessário porque o app roda em
// dieguinhosoares.github.io (GitHub Pages) e as funções rodam em outro
// domínio (*.vercel.app). Sem isso, o navegador bloqueia a chamada.
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}
module.exports.setCors = setCors

// Verifica o token de login do Firebase enviado no header Authorization —
// usado pelas funções que exigem estar logado (ex: salvar config do WhatsApp).
async function verificarToken(req) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) return null
  try {
    return await admin.auth().verifyIdToken(token)
  } catch {
    return null
  }
}
module.exports.verificarToken = verificarToken
