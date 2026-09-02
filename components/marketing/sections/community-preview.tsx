import { Section } from "@/components/layout/section";
import { Grid } from "@/components/layout/grid";
import { Stack } from "@/components/layout/stack";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export type MoodEntry = {
  emoji: string;
  drink: string;
  mood: string;
  note?: string;
};

export type CommunityPreviewProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  entries: MoodEntry[];
};

/**
 * Recent community moods preview. Placeholder cards showing the social layer.
 * Real data wires in later via Supabase — for now, empty array renders a fallback.
 */
export function CommunityPreview({
  eyebrow,
  title,
  description,
  entries,
}: CommunityPreviewProps) {
  const display = entries.length > 0 ? entries.slice(0, 6) : FALLBACK_ENTRIES;

  return (
    <Section tone="muted">
      <Stack gap="10">
        <Stack gap="3" align="center" className="text-center max-w-2xl mx-auto">
          {eyebrow && (
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              {eyebrow}
            </span>
          )}
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-heading font-semibold tracking-tight break-words">
            {title}
          </h2>
          {description && (
            <p className="text-base text-muted-foreground text-pretty">
              {description}
            </p>
          )}
        </Stack>

        <Grid cols={{ base: 1, md: 2, lg: 3 }} gap="4">
          {display.map((entry, idx) => (
            <Card key={idx} className="h-full">
              <CardContent className="pt-6">
                <Stack gap="3">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-3xl" aria-hidden>
                      {entry.emoji}
                    </span>
                    <Badge variant="outline" className="shrink-0">
                      {entry.mood}
                    </Badge>
                  </div>
                  <p className="font-heading font-semibold text-foreground">
                    {entry.drink}
                  </p>
                  {entry.note && (
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {entry.note}
                    </p>
                  )}
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Grid>
      </Stack>
    </Section>
  );
}

const FALLBACK_ENTRIES: MoodEntry[] = [
  {
    emoji: "🍺",
    drink: "Heineken",
    mood: "chill",
    note: "加班後的救贖，冰到冒汗剛剛好",
  },
  {
    emoji: "🍷",
    drink: "Malbec 2021",
    mood: "cozy",
    note: "一個人在家煮公仔麵也很有儀式感",
  },
  {
    emoji: "🥃",
    drink: "山崎 12 年",
    mood: "celebrate",
    note: "客戶終於簽約了",
  },
  {
    emoji: "🍹",
    drink: "Mojito",
    mood: "social",
    note: "朋友突然約 Happy Friday",
  },
  {
    emoji: "🍶",
    drink: "獺祭 純米大吟釀",
    mood: "indulge",
    note: "今天值得對自己好一點",
  },
  {
    emoji: "🍻",
    drink: "Asahi 生啤",
    mood: "party",
    note: "蘭桂坊 11 點的快樂",
  },
];
