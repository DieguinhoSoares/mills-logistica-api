// api/reset-password.js
// Gera o link de redefinição via Admin SDK (mesmo link seguro que o Firebase
// geraria sozinho) e manda por e-mail com HTML da marca Mills via Brevo,
// em vez do template genérico do Firebase.
const admin = require('./_firebaseAdmin')
const { setCors } = require('./_firebaseAdmin')

const FROM_EMAIL = 'nao-responda@mills.com.br' // troque pelo e-mail verificado no Brevo (Senders)
const FROM_NAME  = 'Mills Logística'

function templateHtml(link, nome) {
  return `
  <!DOCTYPE html>
  <html><body style="margin:0;padding:0;background:#F9F6F1;font-family:'IBM Plex Sans',Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9F6F1;padding:32px 0;">
      <tr><td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.08);">
          <tr><td style="background:#004042;padding:28px 32px;">
            <span style="color:#F37021;font-size:22px;font-weight:900;">mills</span>
            <span style="color:#FFFFFF;font-size:11px;letter-spacing:.08em;text-transform:uppercase;margin-left:8px;">Gestão de Frotas</span>
          </td></tr>
          <tr><td style="padding:32px;">
            <h1 style="color:#1A1612;font-size:18px;margin:0 0 12px;">Redefinição de senha</h1>
            <p style="color:#4A3F35;font-size:14px;line-height:1.6;margin:0 0 24px;">
              Olá${nome ? ' ' + nome : ''}, recebemos um pedido para redefinir a senha da sua conta no
              Mills Logística. Clique no botão abaixo para criar uma senha nova:
            </p>
            <table cellpadding="0" cellspacing="0"><tr><td style="background:#F37021;border-radius:10px;">
              <a href="${link}" style="display:inline-block;padding:14px 28px;color:#FFFFFF;font-weight:800;font-size:14px;text-decoration:none;">
                Redefinir minha senha →
              </a>
            </td></tr></table>
            <p style="color:#9E9590;font-size:12px;line-height:1.6;margin:24px 0 0;">
              Se você não pediu essa redefinição, pode ignorar este e-mail com
              segurança — sua senha continua a mesma. Este link expira em
              algumas horas por segurança.
            </p>
          </td></tr>
          <tr><td style="background:#F0EDE8;padding:16px 32px;">
            <p style="color:#9E9590;font-size:10px;margin:0;">Mills Pesados, Locação Serviços e Logística S.A. · Segurança para sonhar mais alto</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`
}

module.exports = async (req, res) => {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { email } = req.body || {}
    if (!email) return res.status(400).json({ error: 'E-mail é obrigatório.' })

    let link
    try {
      link = await admin.auth().generatePasswordResetLink(email)
    } catch (e) {
      // Não revela se o e-mail existe ou não (evita enumeration de contas).
      if (e.code === 'auth/user-not-found') return res.status(200).json({ ok: true })
      throw e
    }

    let nome = ''
    try {
      const userRecord = await admin.auth().getUserByEmail(email)
      const snap = await admin.firestore().doc(`users/${userRecord.uid}`).get()
      nome = snap.exists ? (snap.data().name || '').split(' ')[0] : ''
    } catch { /* segue sem nome */ }

    // Brevo usa o header "api-key" (não "Authorization: Bearer" como o
    // SendGrid) e o corpo da requisição tem um formato próprio.
    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        sender:  { email: FROM_EMAIL, name: FROM_NAME },
        to:      [{ email }],
        subject: 'Redefinição de senha — Mills Logística',
        htmlContent: templateHtml(link, nome),
      }),
    })

    if (!brevoRes.ok) {
      const body = await brevoRes.text()
      throw new Error(`Falha ao enviar e-mail via Brevo: ${body.slice(0, 200)}`)
    }

    return res.status(200).json({ ok: true })
  } catch (e) {
    console.error('Erro ao resetar senha:', e)
    return res.status(500).json({ error: e.message || 'Erro ao enviar e-mail.' })
  }
}
