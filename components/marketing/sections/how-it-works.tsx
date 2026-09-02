import { Section } from "@/components/layout/section";
import { Grid } from "@/components/layout/grid";
import { Stack } from "@/components/layout/stack";

export type Step = {
  number: string;
  title: string;
  description: string;
};

export type HowItWorksProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  steps: Step[];
};

/**
 * "How it works" — numbered steps in a responsive grid (1 col mobile → 3 col desktop).
 */
export function HowItWorks({ eyebrow, title, description, steps }: HowItWorksProps) {
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

        <Grid cols={{ base: 1, md: 3 }} gap="8">
          {steps.map((step) => (
            <Stack key={step.number} gap="3" className="relative">
              <span className="text-4xl font-heading font-bold text-primary/30 leading-none">
                {step.number}
              </span>
              <h3 className="text-lg font-heading font-semibold">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed text-pretty">
                {step.description}
              </p>
            </Stack>
          ))}
        </Grid>
      </Stack>
    </Section>
  );
}
