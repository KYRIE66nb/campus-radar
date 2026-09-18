import nodemailer from "nodemailer";

export interface MailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type MailResult =
  | { status: "sent"; messageId?: string }
  | { status: "dry_run"; info: string }
  | { status: "failed"; error: string };

export type MailMode = "smtp" | "resend" | "dry_run";

export function mailMode(): MailMode {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) return "smtp";
  if (process.env.RESEND_API_KEY) return "resend";
  return "dry_run";
}

async function sendViaSmtp(m: MailInput): Promise<MailResult> {
  const host = process.env.SMTP_HOST!;
  const port = Number(process.env.SMTP_PORT ?? 465);
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! },
    connectionTimeout: 10000,
  });
  const info = await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: m.to,
    subject: m.subject,
    html: m.html,
    text: m.text,
  });
  return { status: "sent", messageId: info.messageId };
}

async function sendViaResend(m: MailInput): Promise<MailResult> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    signal: AbortSignal.timeout(12000),
    body: JSON.stringify({
      from: process.env.SMTP_FROM || "CampusRadar <onboarding@resend.dev>",
      to: [m.to],
      subject: m.subject,
      html: m.html,
      text: m.text,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend HTTP ${res.status} ${body.slice(0, 200)}`);
  }
  return { status: "sent" };
}

/**
 * 发送邮件：失败自动重试 1 次；无任何凭据时进入 dry_run（明确标注，不冒充已发送）。
 */
export async function sendMail(m: MailInput): Promise<MailResult> {
  const mode = mailMode();
  if (mode === "dry_run") {
    console.log(`[mailer:dry_run] would send to ${m.to}: ${m.subject}`);
    return { status: "dry_run", info: "未配置 SMTP/RESEND 凭据，邮件未实际发送（dry-run）" };
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return mode === "smtp" ? await sendViaSmtp(m) : await sendViaResend(m);
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      if (attempt === 1) return { status: "failed", error: err };
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  return { status: "failed", error: "unreachable" };
}
