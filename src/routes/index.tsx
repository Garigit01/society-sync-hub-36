import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, ShieldCheck, Sparkles } from "lucide-react";
import { useAuth, ADMIN_EMAIL } from "@/lib/society/auth";
import { db } from "@/lib/society/db";

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
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    if (!user) return;
    if (user.role === "admin") {
      navigate({ to: "/admin" });
    } else {
      const hasProfile = !!db.get().profiles[user.email];
      navigate({ to: hasProfile ? "/resident" : "/profile-setup" });
    }
  }, [user, navigate]);

  const handleGoogle = (asAdmin: boolean) => {
    const e = asAdmin ? ADMIN_EMAIL : email.trim().toLowerCase();
    if (!e || !e.includes("@")) return;
    signIn(e, asAdmin ? "Society Admin" : name || undefined);
  };

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
            <Feature icon={<Sparkles className="size-4" />} text="WhatsApp reminders in one click" />
            <Feature icon={<Building2 className="size-4" />} text="Full fund utilization transparency" />
          </div>
        </div>
        <p className="text-xs opacity-70">© {new Date().getFullYear()} Harmony Heights Society</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md p-8 shadow-[var(--shadow-elevated)] border-0">
          <div className="space-y-2 mb-6">
            <h2 className="text-2xl font-semibold">Welcome back</h2>
            <p className="text-sm text-muted-foreground">
              Simulated Google sign-in. Admin email: <code className="text-foreground">{ADMIN_EMAIL}</code>
            </p>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                placeholder="you@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Display name</Label>
              <Input
                id="name"
                placeholder="(optional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              size="lg"
              onClick={() => handleGoogle(false)}
              style={{ background: "var(--gradient-primary)" }}
            >
              <GoogleIcon /> Continue with Google
            </Button>
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">demo shortcuts</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => handleGoogle(true)}>
                Sign in as Admin
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setEmail("priya@example.com");
                  setName("Priya Sharma");
                  setTimeout(() => signIn("priya@example.com", "Priya Sharma"), 0);
                }}
              >
                Sign in as Resident
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
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

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 mr-2" aria-hidden>
      <path fill="#fff" d="M21.6 12.227c0-.709-.064-1.39-.182-2.045H12v3.868h5.382a4.6 4.6 0 0 1-1.995 3.018v2.51h3.227c1.89-1.741 2.986-4.305 2.986-7.35Z"/>
      <path fill="#fff" opacity=".9" d="M12 22c2.7 0 4.964-.895 6.618-2.422l-3.227-2.51c-.895.6-2.04.955-3.39.955-2.605 0-4.81-1.76-5.6-4.122H3.067v2.59A10 10 0 0 0 12 22Z"/>
      <path fill="#fff" opacity=".7" d="M6.4 13.9a6 6 0 0 1 0-3.82V7.49H3.067a10 10 0 0 0 0 9.01L6.4 13.9Z"/>
      <path fill="#fff" opacity=".5" d="M12 5.96c1.468 0 2.786.504 3.823 1.495l2.868-2.868C16.96 2.99 14.695 2 12 2A10 10 0 0 0 3.067 7.49L6.4 10.08C7.19 7.72 9.395 5.96 12 5.96Z"/>
    </svg>
  );
}
