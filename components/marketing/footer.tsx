import Link from "next/link";
import { Container } from "@/components/layout/container";
import { Stack } from "@/components/layout/stack";

const FOOTER_LINKS: { label: string; href: string }[] = [
  { label: "關於", href: "/about" },
  { label: "隱私", href: "/privacy" },
  { label: "條款", href: "/terms" },
  { label: "聯絡", href: "mailto:hello@whattodrink.app" },
];

export function Footer() {
  return (
    <footer className="border-t mt-auto">
      <Container className="py-8 md:py-12">
        <Stack
          direction={{ base: "col", md: "row" }}
          gap="6"
          justify="between"
          align={{ base: "start", md: "center" }}
        >
          <Stack gap="2">
            <p className="font-heading font-semibold">whattodrink</p>
            <p className="text-sm text-muted-foreground">
              香港年輕人的選酒與心情記錄夥伴
            </p>
          </Stack>

          <nav aria-label="Footer">
            <Stack direction="row" gap="6" className="text-sm flex-wrap">
              {FOOTER_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </Stack>
          </nav>
        </Stack>

        <p className="text-xs text-muted-foreground mt-6">
          © {new Date().getFullYear()} whattodrink. 理性飲酒，未成年請勿飲酒。
        </p>
      </Container>
    </footer>
  );
}
