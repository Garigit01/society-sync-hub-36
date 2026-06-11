import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/society/auth";
import { db } from "@/lib/society/db";
import { toast } from "sonner";

export const Route = createFileRoute("/profile-setup")({
  head: () => ({ meta: [{ title: "Complete your profile — Harmony Heights" }] }),
  component: ProfileSetup,
});

function ProfileSetup() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: "",
    occupancy: "Owner" as "Owner" | "Tenant",
    whatsapp: "",
    flat: "",
    altContact: "",
    vehicle: "",
  });

  useEffect(() => {
    if (!user) navigate({ to: "/" });
    else if (user.role === "admin") navigate({ to: "/admin" });
    else if (db.get().profiles[user.email]) navigate({ to: "/resident" });
  }, [user, navigate]);

  const phoneOk = (p: string) => /^\+\d{1,3}\d{6,14}$/.test(p.replace(/\s/g, ""));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.fullName.trim()) return toast.error("Full name is required");
    if (!phoneOk(form.whatsapp)) return toast.error("WhatsApp must include country code, e.g. +919876543210");
    if (!/^[A-Za-z]-?\d{2,4}$/.test(form.flat.trim())) return toast.error("Flat format e.g. A-402");
    if (!phoneOk(form.altContact)) return toast.error("Alternative contact must include country code");

    db.set((s) => ({
      ...s,
      profiles: {
        ...s.profiles,
        [user.email]: {
          email: user.email,
          fullName: form.fullName.trim(),
          occupancy: form.occupancy,
          whatsapp: form.whatsapp.replace(/\s/g, ""),
          flat: form.flat.toUpperCase(),
          altContact: form.altContact.replace(/\s/g, ""),
          vehicle: form.vehicle.trim() || undefined,
          createdAt: Date.now(),
        },
      },
    }));
    toast.success("Profile created");
    navigate({ to: "/resident" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary/40 p-6">
      <Card className="w-full max-w-2xl p-8 shadow-[var(--shadow-elevated)] border-0">
        <h1 className="text-2xl font-semibold">Complete your profile</h1>
        <p className="text-sm text-muted-foreground mb-6">
          We need a few details before you can access your resident dashboard.
        </p>
        <form className="grid sm:grid-cols-2 gap-4" onSubmit={submit}>
          <Field label="Full Name *">
            <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          </Field>
          <Field label="Occupancy Type *">
            <Select value={form.occupancy} onValueChange={(v) => setForm({ ...form, occupancy: v as "Owner" | "Tenant" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Owner">Owner</SelectItem>
                <SelectItem value="Tenant">Tenant</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="WhatsApp Number * (with country code)">
            <Input placeholder="+919876543210" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
          </Field>
          <Field label="Flat Number + Wing *">
            <Input placeholder="A-402" value={form.flat} onChange={(e) => setForm({ ...form, flat: e.target.value })} />
          </Field>
          <Field label="Alternative Contact *">
            <Input placeholder="+91..." value={form.altContact} onChange={(e) => setForm({ ...form, altContact: e.target.value })} />
          </Field>
          <Field label="Vehicle Number (optional)">
            <Input value={form.vehicle} onChange={(e) => setForm({ ...form, vehicle: e.target.value })} />
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" size="lg" className="w-full" style={{ background: "var(--gradient-primary)" }}>
              Save & continue
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}