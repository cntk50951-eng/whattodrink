"use client";

import { Check, Palette } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";

export function ThemePicker() {
  const { theme, themeId, setThemeId, available } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" className="gap-2">
            <Palette className="size-4" />
            <span className="hidden sm:inline">{theme.name}</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {available.map((t) => (
          <DropdownMenuItem
            key={t.id}
            onSelect={() => setThemeId(t.id)}
            className="flex flex-col items-start gap-0.5 py-2"
          >
            <div className="flex w-full items-center justify-between">
              <span className="font-medium">{t.name}</span>
              {themeId === t.id && <Check className="size-4" />}
            </div>
            {t.description && (
              <span className="text-xs text-muted-foreground">
                {t.description}
              </span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
