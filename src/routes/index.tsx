import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, ShieldCheck, Sparkles, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/society/auth";
import { useT } from "@/lib/society/i18n";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Harmony Heights — Society Management" },
      { name: "description", content: "Modern society management with transparent finances, duty tracking and complaint resolution." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { user, role, loading } = useAuth();
  const { lang, setLang, t } = useT();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !user) return;
    if (role === "admin") {
      navigate({ to: "/admin" });
      return;
    }
    supabase.from("profiles").select("id").eq("id", user.id).maybeSingle().then(({ data }) => {
      navigate({ to: data ? "/resident" : "/profile-setup" });
    });
  }, [user, role, loading, navigate]);

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div
        className="hidden lg:flex flex-col justify-between p-12 text-primary-foreground relative overflow-hidden"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Building2 className="size-6" /> Harmony Heights
        </div>
        <div className="space-y-6 relative z-10">
          <h1 className="text-5xl font-bold leading-tight tracking-tight">
            Run your society like a modern product.
          </h1>
          <p className="text-lg opacity-90 max-w-md">
            Transparent finances. Accountable duties. Faster complaint resolution — all in one calm dashboard.
          </p>
          <div className="grid gap-3 text-sm">
            <Feature icon={<ShieldCheck className="size-4" />} text="Role-based admin & resident access" />
            <Feature icon={<Sparkles className="size-4" />} text="Secure email login + magic-link recovery" />
            <Feature icon={<Building2 className="size-4" />} text="Full fund utilization transparency" />
          </div>
        </div>
        <p className="text-xs opacity-70">© {new Date().getFullYear()} Harmony Heights Society</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md p-8 shadow-[var(--shadow-elevated)] border-0">
          <div className="flex justify-end mb-2">
            <Button variant="outline" size="sm" onClick={() => setLang(lang === "en" ? "hi" : "en")}>
              {lang === "en" ? "हिंदी" : "English"}
            </Button>
          </div>
          <div className="space-y-2 mb-6">
            <h2 className="text-2xl font-semibold">{t("welcomeBack")}</h2>
            <p className="text-sm text-muted-foreground">
              Sign in to your Harmony Heights account.
            </p>
          </div>

          <PasswordForm />
        </Card>
      </div>
    </div>
  );
}

function PasswordForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@") || password.length < 6) {
      toast.error("Valid email & password (6+ chars) required");
      return;
    }
    if (mode === "signup" && password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setBusy(true);
    const fn = mode === "signin"
      ? supabase.auth.signInWithPassword({ email, password })
      : supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/` } });
    const { error } = await fn;
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(mode === "signin" ? "Signed in" : "Account created");
  };

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="space-y-2">
        <Label htmlFor="pw-email">Email</Label>
        <Input id="pw-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="pw-pass">Password</Label>
        <Input id="pw-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" />
      </div>
      {mode === "signup" && (
        <div className="space-y-2">
          <Label htmlFor="pw-confirm">Re-enter password</Label>
          <Input id="pw-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••" />
        </div>
      )}
      <Button type="submit" className="w-full" size="lg" disabled={busy} style={{ background: "var(--gradient-primary)" }}>
        {busy && <Loader2 className="size-4 mr-2 animate-spin" />}
        {mode === "signin" ? "Sign in" : "Create account"}
      </Button>
      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="text-muted-foreground hover:text-foreground"
        >
          {mode === "signin" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
        </button>
        {mode === "signin" && (
          <a href="/forgot-password" className="text-muted-foreground hover:text-foreground">
            Forgot password?
          </a>
        )}
      </div>
    </form>
  );
}

function Feature({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 opacity-95">
      <span className="size-7 rounded-full bg-white/15 grid place-items-center">{icon}</span>
      {text}
    </div>
  );
}