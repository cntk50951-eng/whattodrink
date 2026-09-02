"use client";

import { Check, Palette } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buttonVariants } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

export function ThemePicker() {
  const { theme, themeId, setThemeId, available } = useTheme();
  const t = useTranslations("theme");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "gap-2",
        )}
      >
        <Palette className="size-4" />
        <span className="hidden sm:inline">{t("options." + themeId)}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("label")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {available.map((th) => (
            <DropdownMenuItem
              key={th.id}
              onSelect={() => setThemeId(th.id)}
              className="flex flex-col items-start gap-0.5 py-2"
            >
              <div className="flex w-full items-center justify-between">
                <span className="font-medium">{t("options." + th.id)}</span>
                {themeId === th.id && <Check className="size-4" />}
              </div>
              {th.description && (
                <span className="text-xs text-muted-foreground">
                  {th.description}
                </span>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}