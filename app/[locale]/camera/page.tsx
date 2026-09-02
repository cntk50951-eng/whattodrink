import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Container } from "@/components/layout/container";
import { Stack } from "@/components/layout/stack";
import { Button } from "@/components/ui/button";

/**
 * Stub for the Photo Pick flow. Per UR 1.1 this page is intentionally
 * minimal — full functionality belongs to a separate UR (camera permission
 * flow, AI integration, fallback UI). We just need the route to exist so
 * the secondary Bento card's Link has a real destination (AC4 verification).
 */
export default async function CameraPage() {
  const t = await getTranslations("stubs");

  return (
    <Container className="py-16">
      <Stack gap="6" align="center" className="text-center">
        <span className="text-6xl" aria-hidden>
          📷
        </span>
        <h1 className="text-2xl md:text-3xl font-heading font-semibold tracking-tight">
          Camera
        </h1>
        <p className="text-muted-foreground">{t("placeholder")}</p>
        <Button
          size="sm"
          variant="outline"
          nativeButton={false}
          render={<Link href="/" />}
        >
          {t("back")}
        </Button>
      </Stack>
    </Container>
  );
}