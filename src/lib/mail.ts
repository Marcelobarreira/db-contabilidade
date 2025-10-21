import nodemailer from "nodemailer";

let cachedTransporter: nodemailer.Transporter | null = null;

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente ${name} não configurada.`);
  }
  return value;
}

function resolveBaseUrl() {
  return process.env.APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
}

async function getTransporter() {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const host = getRequiredEnv("SMTP_HOST");
  const port = Number(getRequiredEnv("SMTP_PORT"));
  const user = getRequiredEnv("SMTP_USER");
  const password = getRequiredEnv("SMTP_PASSWORD");

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass: password,
    },
  });

  return cachedTransporter;
}

type WelcomeEmailPayload = {
  to: string;
  temporaryPassword: string;
  companyName?: string | null;
  isAdmin: boolean;
};

function buildWelcomeEmailHtml(payload: WelcomeEmailPayload) {
  const appUrl = resolveBaseUrl();
  const portalLabel = payload.isAdmin ? "Painel administrativo" : "Portal da empresa";
  const greetingTarget = payload.companyName ? `, ${payload.companyName}` : "";

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="background: #0f172a; padding: 32px; font-family: Arial, Helvetica, sans-serif;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background: #111827; border-radius: 16px; padding: 32px; color: #e2e8f0;">
            <tr>
              <td align="center" style="padding-bottom: 24px;">
                <img src="${appUrl}/dbcontabilidade.jpg" alt="DB Contabilidade" width="64" height="64" style="border-radius: 16px; display: block;" />
              </td>
            </tr>
            <tr>
              <td style="font-size: 20px; font-weight: 600; text-align: center; padding-bottom: 16px;">
                Bem-vindo${greetingTarget}!
              </td>
            </tr>
            <tr>
              <td style="font-size: 15px; line-height: 24px; text-align: left; padding-bottom: 24px; color: #cbd5f5;">
                Seu acesso ao ${portalLabel} foi configurado. Utilize as credenciais abaixo para entrar no sistema e, assim que possível, defina uma nova senha segura.
              </td>
            </tr>
            <tr>
              <td>
                <table width="100%" cellpadding="0" cellspacing="0" style="background: rgba(59,130,246,0.08); border: 1px solid rgba(59,130,246,0.3); border-radius: 12px; padding: 20px; color: #e2e8f0;">
                  <tr>
                    <td style="font-size: 14px; font-weight: 600; padding-bottom: 6px;">E-mail</td>
                  </tr>
                  <tr>
                    <td style="font-size: 16px; padding-bottom: 16px;">${payload.to}</td>
                  </tr>
                  <tr>
                    <td style="font-size: 14px; font-weight: 600; padding-bottom: 6px;">Senha temporária</td>
                  </tr>
                  <tr>
                    <td style="font-size: 16px;">${payload.temporaryPassword}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding-top: 24px; padding-bottom: 24px;">
                <a href="${appUrl}" style="display: inline-block; background: #38bdf8; color: #0f172a; padding: 12px 20px; border-radius: 9999px; font-weight: 600; text-decoration: none;">
                  Acessar portal
                </a>
              </td>
            </tr>
            <tr>
              <td style="font-size: 13px; line-height: 20px; color: #94a3b8;">
                Caso não tenha solicitado este acesso, envie uma mensagem para suporte@dbcontabilidade.com.br.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

export async function sendWelcomeEmail(payload: WelcomeEmailPayload) {
  let transporter: nodemailer.Transporter;
  try {
    transporter = await getTransporter();
  } catch (error) {
    console.warn("[mail] Transporte de e-mail não configurado:", error);
    return;
  }

  const from = process.env.MAIL_FROM ?? "DB Contabilidade <no-reply@dbcontabilidade.com.br>";

  await transporter.sendMail({
    from,
    to: payload.to,
    subject: "Bem-vindo ao portal DB Contabilidade",
    html: buildWelcomeEmailHtml(payload),
  });
}
