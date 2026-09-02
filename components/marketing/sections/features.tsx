import { Section } from "@/components/layout/section";
import { Grid } from "@/components/layout/grid";
import { Stack } from "@/components/layout/stack";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type Feature = {
  title: string;
  description: string;
  icon?: React.ReactNode;
};

export type FeaturesProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  features: Feature[];
};

/**
 * Features grid — Card-based showcase of product capabilities. 1 col mobile, 2 col md, 4 col lg.
 * `icon` slot accepts any ReactNode (lucide icon, custom SVG, emoji placeholder).
 */
export function Features({
  eyebrow,
  title,
  description,
  features,
}: FeaturesProps) {
  return (
    <Section>
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

        <Grid cols={{ base: 1, md: 2, lg: 4 }} gap="6">
          {features.map((feature) => (
            <Card key={feature.title} className="h-full">
              <CardHeader>
                {feature.icon && (
                  <div className="text-primary mb-2 size-8 [&_svg]:size-8">
                    {feature.icon}
                  </div>
                )}
                <CardTitle>{feature.title}</CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </Grid>
      </Stack>
    </Section>
  );
}
