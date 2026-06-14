import { Link, useNavigate } from "@tanstack/react-router";
import { Building2, LogOut, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/society/auth";
import { useT, type Lang } from "@/lib/society/i18n";
import { useTheme } from "@/lib/society/theme";
import type { ReactNode } from "react";

export function Shell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const { user, signOut } = useAuth();
  const { lang, setLang, t } = useT();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="border-b bg-card/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <span
              className="size-8 rounded-lg grid place-items-center text-primary-foreground"
              style={{ background: "var(--gradient-primary)" }}
            >
              <Building2 className="size-4" />
            </span>
            {t("appName")}
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={toggle} aria-label="Toggle theme">
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
            <Select value={lang} onValueChange={(v) => setLang(v as Lang)}>
              <SelectTrigger className="h-9 w-[110px]" aria-label={t("language")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="hi">हिंदी</SelectItem>
                <SelectItem value="mr">मराठी</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-right text-sm hidden sm:block">
              <div className="font-medium">{user?.email}</div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                signOut();
                navigate({ to: "/" });
              }}
            >
              <LogOut className="size-4 mr-1" /> {t("signOut")}
            </Button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        {children}
      </main>
    </div>
  );
}