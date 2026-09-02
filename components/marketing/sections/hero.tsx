import { Container } from "@/components/layout/container";
import { Stack } from "@/components/layout/stack";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type CtaLink = { label: string; href: string };

export type HeroProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  primaryCta?: CtaLink;
  secondaryCta?: CtaLink;
};

/**
 * Marketing landing hero. Centered stack that scales from mobile (single column,
 * tighter spacing) to desktop (looser, larger type). Uses semantic tokens only.
 */
export function Hero({
  eyebrow,
  title,
  description,
  primaryCta,
  secondaryCta,
}: HeroProps) {
  return (
    <section className="py-16 md:py-24 lg:py-32">
      <Container size="narrow">
        <Stack gap="6" align="center" className="text-center">
          {eyebrow && (
            <Badge variant="secondary" className="uppercase tracking-wider">
              {eyebrow}
            </Badge>
          )}
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-heading font-semibold tracking-tight break-words">
            {title}
          </h1>
          {description && (
            <p className="text-lg text-muted-foreground max-w-2xl text-pretty">
              {description}
            </p>
          )}
          {(primaryCta || secondaryCta) && (
            <Stack
              direction="row"
              gap="3"
              justify="center"
              className="pt-2"
            >
              {primaryCta && (
                <Button
                  size="lg"
                  nativeButton={false}
                  render={<a href={primaryCta.href} />}
                >
                  {primaryCta.label}
                </Button>
              )}
              {secondaryCta && (
                <Button
                  size="lg"
                  variant="outline"
                  nativeButton={false}
                  render={<a href={secondaryCta.href} />}
                >
                  {secondaryCta.label}
                </Button>
              )}
            </Stack>
          )}
        </Stack>
      </Container>
    </section>
  );
}
