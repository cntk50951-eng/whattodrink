import { Section } from "@/components/layout/section";
import { Stack } from "@/components/layout/stack";
import { Button } from "@/components/ui/button";
import type { CtaLink } from "./hero";

export type CtaBannerProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  primaryCta?: CtaLink;
  secondaryCta?: CtaLink;
};

/**
 * Closing call-to-action banner. Higher visual weight than the hero CTA — usually
 * tinted with primary background to draw the eye before the footer.
 */
export function CtaBanner({
  eyebrow,
  title,
  description,
  primaryCta,
  secondaryCta,
}: CtaBannerProps) {
  return (
    <Section>
      <div className="rounded-2xl bg-primary text-primary-foreground px-6 py-12 md:py-16">
        <Stack gap="6" align="center" className="text-center max-w-2xl mx-auto">
          {eyebrow && (
            <span className="text-xs uppercase tracking-wider font-medium opacity-80">
              {eyebrow}
            </span>
          )}
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-heading font-semibold tracking-tight break-words">
            {title}
          </h2>
          {description && (
            <p className="text-base opacity-90 text-pretty">{description}</p>
          )}
          {(primaryCta || secondaryCta) && (
            <Stack direction="row" gap="3" justify="center" className="pt-2">
              {primaryCta && (
                <Button
                  size="lg"
                  variant="secondary"
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
                  className="bg-transparent border-primary-foreground/30 hover:bg-primary-foreground/10"
                  render={<a href={secondaryCta.href} />}
                >
                  {secondaryCta.label}
                </Button>
              )}
            </Stack>
          )}
        </Stack>
      </div>
    </Section>
  );
}
