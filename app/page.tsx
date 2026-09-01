"use client";

import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  const { theme, themeId } = useTheme();
  const tokens = Object.entries(theme.tokens) as [string, string][];

  return (
    <div className="mx-auto max-w-3xl px-6 py-16 space-y-12">
      <section className="space-y-4">
        <Badge variant="secondary">Prototype · 0.1.0</Badge>
        <h1 className="text-4xl sm:text-5xl font-heading font-semibold tracking-tight">
          今晚喝咩？
        </h1>
        <p className="text-lg text-muted-foreground max-w-prose">
          把選擇交給天氣、心情或命運。換個主題，找到今晚的調性。
        </p>
        <div className="flex gap-3 pt-2">
          <Button size="lg">讓天意決定</Button>
          <Button size="lg" variant="outline">
            自己選
          </Button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Active theme
        </h2>
        <Card>
          <CardHeader>
            <CardTitle>{theme.name}</CardTitle>
            {theme.description && (
              <CardDescription>{theme.description}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="text-xs text-muted-foreground">
              id: <code className="font-mono">{themeId}</code>
            </div>
            {tokens.length === 0 ? (
              <div className="text-muted-foreground">
                No overrides — using globals.css :root defaults.
              </div>
            ) : (
              <ul className="space-y-1 font-mono text-xs">
                {tokens.map(([k, v]) => (
                  <li key={k} className="flex gap-2">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="text-foreground/80">=</span>
                    <span className="truncate">{v}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3 text-sm text-muted-foreground">
        <p>
          Theme system skeleton: change themes from the top-right picker to see
          design tokens swap live. New themes go in{" "}
          <code className="font-mono text-foreground">lib/themes/presets/</code>{" "}
          and register in{" "}
          <code className="font-mono text-foreground">lib/themes/registry.ts</code>
          .
        </p>
        <p>
          Reference images for visual exploration live in{" "}
          <code className="font-mono text-foreground">UI style/</code>.
        </p>
      </section>
    </div>
  );
}
