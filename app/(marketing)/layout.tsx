import Link from "next/link";
import type { ReactNode } from "react";
import { Container } from "@/components/layout/container";
import { ThemePicker } from "@/components/theme-picker";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/marketing/footer";

/**
 * Marketing layout — wraps the public landing for anonymous visitors.
 * Distinct header (logo + nav + theme picker + sign-in CTA) and a marketing footer.
 * Per Next.js convention: route group `(marketing)` does not appear in URL.
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b">
        <Container>
          <div className="flex h-14 items-center justify-between gap-4">
            <Link
              href="/"
              className="font-heading font-semibold tracking-tight"
            >
              whattodrink
            </Link>
            <nav
              aria-label="Primary"
              className="hidden md:flex items-center gap-6 text-sm text-muted-foreground"
            >
              <Link href="/bars" className="hover:text-foreground transition-colors">
                酒吧
              </Link>
              <Link href="/moods" className="hover:text-foreground transition-colors">
                心情流
              </Link>
              <Link href="/about" className="hover:text-foreground transition-colors">
                關於
              </Link>
            </nav>
            <div className="flex items-center gap-2">
              <ThemePicker />
              <Button size="sm" nativeButton={false} render={<Link href="/auth" />}>
                登入
              </Button>
            </div>
          </div>
        </Container>
      </header>

      <main className="flex-1">{children}</main>

      <Footer />
    </div>
  );
}
