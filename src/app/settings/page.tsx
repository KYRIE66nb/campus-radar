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
      <h1 className="text-xl font-bold">订阅设置</h1>
      <p className="mb-6 mt-1 text-sm text-slate-500">学校、关键词、收件邮箱、发送时间与邮件开关。</p>
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
