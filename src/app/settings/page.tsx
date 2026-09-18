import { redirect } from "next/navigation";
import { ensureSettings, getSessionUser } from "@/lib/auth";
import { mailMode } from "@/lib/mailer";
import SettingsForm from "@/components/SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const s = await ensureSettings(user.id);

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-widest text-slate-400">个人偏好</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">订阅设置</h1>
      <p className="mb-7 mt-1.5 text-sm text-slate-500">学校、关键词、收件邮箱、发送时间与邮件开关。</p>
      <SettingsForm
        initial={{
          school: s.school,
          includeKeywords: s.includeKeywords ?? [],
          excludeKeywords: s.excludeKeywords ?? [],
          recipientEmail: s.recipientEmail,
          sendTime: s.sendTime,
          emailEnabled: s.emailEnabled,
          shareToken: s.shareToken,
        }}
        mailMode={mailMode()}
      />
    </div>
  );
}
