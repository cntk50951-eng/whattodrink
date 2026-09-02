import Link from "next/link";
import { Camera } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";

/**
 * Secondary Bento card — click navigates to /camera (full-screen flow that
 * needs camera permissions; per UR 1.1, secondary cards don't expand in place).
 */
export async function PhotoPickCard({ className }: { className?: string }) {
  const t = await getTranslations("bento.photoPick");

  return (
    <Link
      href="/camera"
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-card text-card-foreground",
        "p-6 md:p-8 flex flex-col justify-between",
        "transition-colors hover:border-primary motion-safe:hover:-translate-y-0.5 motion-safe:transition-transform",
        className,
      )}
      data-card="photo-pick"
    >
      <div className="space-y-3">
        <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
          {t("eyebrow")}
        </span>
        <h3 className="text-xl md:text-2xl lg:text-3xl font-heading font-semibold tracking-tight text-balance">
          {t("title")}
        </h3>
        <p className="text-sm md:text-base text-muted-foreground text-pretty">
          {t("description")}
        </p>
      </div>
      <div className="flex items-center justify-between pt-6">
        <span className="inline-flex items-center justify-center size-10 rounded-xl bg-secondary text-secondary-foreground">
          <Camera className="size-5" aria-hidden />
        </span>
        <span className="text-xs text-muted-foreground">
          {t("eyebrow")} →
        </span>
      </div>
    </Link>
  );
}