import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { PostDetail } from "@/components/wall/PostDetail";

/** UR4.1 貼文詳情（畫面4）。id 經 loadWall 找，找不到就地提示＋回牆。 */
export default async function WallDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tb = await getTranslations("stubs");
  return (
    <Container className="py-10 md:py-16">
      <div className="mx-auto w-full max-w-xl">
        <PostDetail id={id} />
        <div className="mt-8">
          <Button
            size="sm"
            variant="outline"
            nativeButton={false}
            render={<Link href="/wall" />}
          >
            {tb("back")}
          </Button>
        </div>
      </div>
    </Container>
  );
}
