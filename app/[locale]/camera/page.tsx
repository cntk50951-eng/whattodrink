import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { CameraFlow } from "@/components/camera/camera-flow";

/**
 * UR2.1 camera invoke + permission page.
 * The full state machine lives in <CameraFlow/> (client); this page only
 * provides chrome + a way back. Photo review / text / voice input is UR2.2.
 */
export default async function CameraPage() {
  const t = await getTranslations("stubs");

  return (
    <Container className="py-10 md:py-16">
      <CameraFlow />
      <div className="mx-auto mt-8 w-full max-w-xl">
        <Button
          size="sm"
          variant="outline"
          nativeButton={false}
          render={<Link href="/" />}
        >
          {t("back")}
        </Button>
      </div>
    </Container>
  );
}
