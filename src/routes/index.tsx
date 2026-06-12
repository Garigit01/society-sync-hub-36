import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, ShieldCheck, Sparkles, Loader2 } from "lucide-react";
import { useAuth, ADMIN_EMAIL } from "@/lib/society/auth";
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
    // Resident: check profile
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
            <Feature icon={<Sparkles className="size-4" />} text="Email + OTP login, real database" />
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
              Admin: <code className="text-foreground">{ADMIN_EMAIL}</code>
            </p>
          </div>

          <Tabs defaultValue="password">
            <TabsList className="grid grid-cols-2 w-full mb-4">
              <TabsTrigger value="password">Email + Password</TabsTrigger>
              <TabsTrigger value="otp">Magic Code (OTP)</TabsTrigger>
            </TabsList>
            <TabsContent value="password"><PasswordForm /></TabsContent>
            <TabsContent value="otp"><OtpForm /></TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}

function PasswordForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@") || password.length < 6) {
      toast.error("Valid email & password (6+ chars) required");
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
      <Button type="submit" className="w-full" size="lg" disabled={busy} style={{ background: "var(--gradient-primary)" }}>
        {busy && <Loader2 className="size-4 mr-2 animate-spin" />}
        {mode === "signin" ? "Sign in" : "Create account"}
      </Button>
      <button
        type="button"
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        className="text-sm text-muted-foreground hover:text-foreground w-full text-center"
      >
        {mode === "signin" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
      </button>
    </form>
  );
}

function OtpForm() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [stage, setStage] = useState<"send" | "verify">("send");
  const [busy, setBusy] = useState(false);

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) return toast.error("Valid email required");
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/` },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setStage("verify");
    toast.success("Code sent to your email");
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (token.length < 6) return toast.error("Enter the 6-digit code");
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Logged in");
  };

  return stage === "send" ? (
    <form className="space-y-4" onSubmit={sendCode}>
      <div className="space-y-2">
        <Label htmlFor="otp-email">Email</Label>
        <Input id="otp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      </div>
      <Button type="submit" className="w-full" size="lg" disabled={busy} style={{ background: "var(--gradient-primary)" }}>
        {busy && <Loader2 className="size-4 mr-2 animate-spin" />}
        Send code
      </Button>
    </form>
  ) : (
    <form className="space-y-4" onSubmit={verify}>
      <p className="text-sm text-muted-foreground">Code sent to <strong>{email}</strong></p>
      <div className="space-y-2">
        <Label htmlFor="otp-token">6-digit code</Label>
        <Input id="otp-token" inputMode="numeric" maxLength={6} value={token} onChange={(e) => setToken(e.target.value.replace(/\D/g, ""))} placeholder="123456" />
      </div>
      <Button type="submit" className="w-full" size="lg" disabled={busy} style={{ background: "var(--gradient-primary)" }}>
        {busy && <Loader2 className="size-4 mr-2 animate-spin" />}
        Verify & login
      </Button>
      <button type="button" onClick={() => setStage("send")} className="text-sm text-muted-foreground hover:text-foreground w-full text-center">
        Resend code
      </button>
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