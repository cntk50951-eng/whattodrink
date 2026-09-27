import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/server";
import styles from "@/components/v2/v2.module.css";

export default async function GatheringDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("gatherings")
    .select("id,title,theme,description,location_text,starts_at,capacity,status,bring_text,visibility")
    .eq("id", id)
    .maybeSingle();
  if (!data) {
    return (
      <div className={`${styles.v2scope} fixed inset-0 flex items-center justify-center bg-background p-4`}>
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>未找到</CardTitle>
            <CardDescription>该组局不存在或已被删除</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }
  const g = data as {
    title: string;
    theme: string;
    description: string;
    location_text: string;
    starts_at: string;
    capacity: number;
    status: string;
    bring_text: string | null;
    visibility: string;
  };
  return (
    <div className={`${styles.v2scope} fixed inset-0 isolate z-[1000] flex h-dvh flex-col overflow-hidden bg-background`}>
      <header className="flex shrink-0 items-center gap-2 border-b bg-card px-4 py-3">
        <Button variant="ghost" size="icon" render={<Link href="/v2" />} nativeButton={false}>
          <ChevronLeft className="size-5" />
        </Button>
        <h1 className="truncate text-base font-semibold">组局详情</h1>
        <Badge variant="secondary" className="ml-auto capitalize">
          {g.status}
        </Badge>
      </header>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-4 p-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">{g.title}</CardTitle>
              <CardDescription className="flex flex-wrap items-center gap-2">
                <Badge>{g.theme}</Badge>
                <Badge variant="outline">{g.visibility}</Badge>
                <span className="text-xs">{new Date(g.starts_at).toLocaleString()}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-relaxed">{g.description}</p>
              <Separator />
              <div className="grid gap-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">地点</span>
                  <span className="font-medium">{g.location_text}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">人数</span>
                  <span className="font-medium">{g.capacity} 人</span>
                </div>
                {g.bring_text && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">带的酒/食物</span>
                    <span className="font-medium">{g.bring_text}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          <div className="flex gap-2">
            <Button className="flex-1" disabled>
              申请加入（F.3）
            </Button>
            <Button variant="outline" render={<Link href="/v2/gatherings/new" />} nativeButton={false}>
              再发一局
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
