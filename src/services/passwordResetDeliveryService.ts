import nodemailer from "nodemailer";
import { config } from "../config/unifiedConfig";

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function smtpTransport() {
  if (transporter) return transporter;
  const smtp = config.auth.passwordResetDelivery.smtp;
  transporter = nodemailer.createTransport({
    host: smtp.host!,
    port: smtp.port,
    secure: smtp.secure,
    requireTLS: !smtp.secure,
    tls: {
      minVersion: "TLSv1.2",
      rejectUnauthorized: true,
    },
    auth: { user: smtp.user!, pass: smtp.password! },
  });
  return transporter;
}

export async function deliverPasswordResetPin(email: string, pin: string): Promise<void> {
  if (config.auth.passwordResetDelivery.mode === "disabled") return;

  await smtpTransport().sendMail({
    from: config.auth.passwordResetDelivery.smtp.from!,
    to: email,
    subject: "Recuperação de senha do Lauda",
    text: `Seu código de recuperação é ${pin}. Ele expira em 15 minutos e só pode ser usado uma vez.`,
  });
}
