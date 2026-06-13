import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Reset password — Harmony Heights" }] }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [stage, setStage] = useState<"send" | "verify" | "reset">("send");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) return toast.error("Valid email required");
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setStage("verify");
    toast.success("Recovery code sent to your email");
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (token.length < 6) return toast.error("Enter the 6-digit code");
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    setBusy(false);
    if (error) return toast.error(error.message);
    setStage("reset");
  };

  const reset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return toast.error("Password must be 6+ characters");
    if (password !== confirm) return toast.error("Passwords do not match");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary/40 p-6">
      <Card className="w-full max-w-md p-8 shadow-[var(--shadow-elevated)] border-0">
        <a href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="size-4 mr-1" /> Back to sign in
        </a>
        <h1 className="text-2xl font-semibold mb-1">Reset your password</h1>
        <p className="text-sm text-muted-foreground mb-6">
          {stage === "send" && "We'll email you a 6-digit recovery code."}
          {stage === "verify" && `Enter the code we sent to ${email}.`}
          {stage === "reset" && "Choose a new password for your account."}
        </p>

        {stage === "send" && (
          <form onSubmit={sendCode} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fp-email">Email</Label>
              <Input id="fp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={busy}>
              {busy && <Loader2 className="size-4 mr-2 animate-spin" />} Send recovery code
            </Button>
          </form>
        )}

        {stage === "verify" && (
          <form onSubmit={verify} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fp-token">6-digit code</Label>
              <Input id="fp-token" inputMode="numeric" maxLength={6} value={token} onChange={(e) => setToken(e.target.value.replace(/\D/g, ""))} placeholder="123456" />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={busy}>
              {busy && <Loader2 className="size-4 mr-2 animate-spin" />} Verify code
            </Button>
            <button type="button" onClick={() => setStage("send")} className="text-sm text-muted-foreground hover:text-foreground w-full text-center">
              Resend code
            </button>
          </form>
        )}

        {stage === "reset" && (
          <form onSubmit={reset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fp-new">New password</Label>
              <Input id="fp-new" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fp-confirm">Re-enter new password</Label>
              <Input id="fp-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••" />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={busy}>
              {busy && <Loader2 className="size-4 mr-2 animate-spin" />} Update password
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}