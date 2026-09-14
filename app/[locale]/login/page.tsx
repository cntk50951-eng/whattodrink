import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Container } from "@/components/layout/container";
import { LoginPanel } from "@/components/auth/LoginPanel";
import { getUserId } from "@/lib/supabase/server";

/** UR A.7 登入頁：已登入直送首頁；`\?error=oauth` 帶錯由面板顯示。 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const userId = await getUserId().catch(() => null);
  if (userId !== null) redirect("/");
  const t = await getTranslations("auth");
  const { error } = await searchParams;
  return (
    <Container className="py-10 md:py-16">
      <h1 className="font-hand text-center text-4xl font-bold tracking-tight md:text-5xl">
        {t("title")}
      </h1>
      <p className="text-muted-foreground mt-3 text-center text-sm">
        {t("subtitle")}
      </p>
      <LoginPanel failed={error === "oauth"} />
    </Container>
  );
}
