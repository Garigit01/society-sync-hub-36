import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Shell } from "@/components/society/Shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/society/auth";
import { supabase } from "@/integrations/supabase/client";
import { currentMonth, todayISO, BASELINE_AMOUNT, penaltyForToday, type Profile, type MaintenanceRecord, type Complaint, type Duty, type Expense } from "@/lib/society/db";
import { useT, monthLabel } from "@/lib/society/i18n";
import { CheckCircle2, AlertTriangle, Send, Home, ArrowRightLeft, Wallet } from "lucide-react";
import { toast } from "sonner";
import { DocumentsTab } from "./admin";

export const Route = createFileRoute("/resident")({
  head: () => ({ meta: [{ title: "My Dashboard — Harmony Heights" }] }),
  component: ResidentPage,
});

function ResidentPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/" }); return; }
    if (role === "admin") { navigate({ to: "/admin" }); return; }
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (!data) { navigate({ to: "/profile-setup" }); return; }
      setProfile(data as Profile);
      setReady(true);
    });
  }, [user, role, loading, navigate]);

  useEffect(() => {
    if (!ready || !user) return;
    const month = currentMonth();
    supabase.from("society_settings").select("base_amount").eq("id", 1).maybeSingle().then(({ data }) => {
      const base = Number(data?.base_amount ?? BASELINE_AMOUNT);
      supabase.from("maintenance").select("id").eq("user_id", user.id).eq("month", month).maybeSingle().then(({ data: m }) => {
        if (!m) supabase.from("maintenance").insert({ user_id: user.id, month, amount: base });
      });
    });
  }, [ready, user]);

  if (!ready || !profile) return null;

  const { t } = useT();
  return (
    <Shell title={`${t("welcomeBack")}, ${(profile.full_name ?? "Resident").split(" ")[0]}`} subtitle={`${t("flat")} ${profile.flat} · ${profile.occupancy}`}>
      <Tabs defaultValue="home" className="space-y-6">
        <TabsList>
          <TabsTrigger value="home">{t("home")}</TabsTrigger>
          <TabsTrigger value="docs">{t("tabDocs")}</TabsTrigger>
          {profile.occupancy === "Owner" && <TabsTrigger value="flat">Flat & Tenants</TabsTrigger>}
        </TabsList>
        <TabsContent value="home">
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <MaintenanceCard userId={profile.id} />
              <DutyCard userId={profile.id} />
              <ComplaintBox userId={profile.id} />
            </div>
            <div className="space-y-6">
              <BuildingFundCard />
              <TransparencyCard />
            </div>
          </div>
        </TabsContent>
        <TabsContent value="docs">
          <DocumentsTab isAdmin={false} />
        </TabsContent>
        {profile.occupancy === "Owner" && (
          <TabsContent value="flat">
            <FlatTab profile={profile} />
          </TabsContent>
        )}
      </Tabs>
    </Shell>
  );
}

function MaintenanceCard({ userId }: { userId: string }) {
  const month = currentMonth();
  const [rec, setRec] = useState<MaintenanceRecord | null>(null);

  useEffect(() => {
    const load = () => supabase.from("maintenance").select("*").eq("user_id", userId).eq("month", month).maybeSingle().then(({ data }) => setRec(data as MaintenanceRecord | null));
    load();
    const ch = supabase.channel(`maint-${userId}`).on("postgres_changes", { event: "*", schema: "public", table: "maintenance", filter: `user_id=eq.${userId}` }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, month]);

  const paid = rec?.status === "Paid";
  const amount = Number(rec?.amount ?? BASELINE_AMOUNT);
  const past = Number(rec?.past_dues ?? 0);
  const penalty = paid ? 0 : (Number(rec?.penalty ?? 0) || penaltyForToday());
  const total = paid ? past : amount + past + penalty;

  return (
    <Card className="p-6 border-0 shadow-[var(--shadow-elevated)] text-primary-foreground relative overflow-hidden"
      style={{ background: paid && past === 0 ? "linear-gradient(135deg, oklch(0.55 0.18 150), oklch(0.7 0.14 160))" : "var(--gradient-hero)" }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm opacity-80">Total Outstanding · {month}</p>
          <p className="text-4xl font-bold mt-1">₹{total.toLocaleString()}</p>
          <div className="text-xs opacity-90 mt-2 grid gap-0.5">
            <span>Current: ₹{amount.toLocaleString()}</span>
            {past > 0 && <span>Past dues: ₹{past.toLocaleString()}</span>}
            {penalty > 0 && <span>Late fee: ₹{penalty.toLocaleString()}</span>}
            {paid && <span className="font-semibold">Current month paid via {rec?.mode}</span>}
          </div>
        </div>
        <Badge className={total === 0 ? "bg-white text-success" : "bg-white text-destructive"}>{total === 0 ? "CLEARED" : "DUE"}</Badge>
      </div>
    </Card>
  );
}

function DutyCard({ userId }: { userId: string }) {
  const today = todayISO();
  const [duty, setDuty] = useState<Duty | null>(null);

  const load = useCallback(() => {
    supabase.from("duties").select("*").eq("user_id", userId).eq("date", today).maybeSingle().then(({ data }) => setDuty(data as Duty | null));
  }, [userId, today]);

  useEffect(() => { load(); }, [load]);

  const markDone = async () => {
    if (!duty) return;
    const { error } = await supabase.from("duties").update({ done: true, done_at: new Date().toISOString() }).eq("id", duty.id);
    if (error) return toast.error(error.message);
    toast.success("Duty marked complete");
    load();
  };

  const overdue = duty && !duty.done && new Date().getHours() >= 20;

  return (
    <Card className="p-6 border-0 shadow-[var(--shadow-card)]">
      <h3 className="font-semibold text-lg">Today's duty</h3>
      <p className="text-sm text-muted-foreground">Cut-off 8:00 PM. Mark done before to stay on track.</p>
      {duty && (
        <div className="mt-4 rounded-lg border bg-secondary/40 p-4">
          <p className="font-medium">{duty.task}</p>
          {duty.done ? (
            <div className="mt-3 flex items-center text-success text-sm">
              <CheckCircle2 className="size-4 mr-1" /> Completed {duty.done_at ? `at ${new Date(duty.done_at).toLocaleTimeString()}` : ""}
            </div>
          ) : (
            <div className="mt-3 flex items-center justify-between">
              {overdue && (
                <div className="flex items-center text-sm font-medium rounded-md px-3 py-2 bg-warning/20 text-warning-foreground">
                  <AlertTriangle className="size-4 mr-1" /> Overdue Alert
                </div>
              )}
              <Button onClick={markDone} className="ml-auto" style={{ background: "var(--gradient-primary)" }}>Mark as Done</Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function ComplaintBox({ userId }: { userId: string }) {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [text, setText] = useState("");

  const load = useCallback(() => {
    supabase.from("complaints").select("*").eq("user_id", userId).order("created_at", { ascending: false }).then(({ data }) => setComplaints((data ?? []) as Complaint[]));
  }, [userId]);

  useEffect(() => {
    load();
    const ch = supabase.channel(`comp-${userId}`).on("postgres_changes", { event: "*", schema: "public", table: "complaints", filter: `user_id=eq.${userId}` }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, load]);

  const submit = async () => {
    if (!text.trim()) return toast.error("Please describe your complaint");
    const { error } = await supabase.from("complaints").insert({ user_id: userId, description: text.trim() });
    if (error) return toast.error(error.message);
    setText("");
    toast.success("Complaint submitted");
  };

  return (
    <Card className="p-6 border-0 shadow-[var(--shadow-card)]">
      <h3 className="font-semibold text-lg">Digital complaint box</h3>
      <p className="text-sm text-muted-foreground">Your feedback reaches the admin instantly.</p>
      <Textarea className="mt-4" rows={3} placeholder="Describe the issue..." value={text} onChange={(e) => setText(e.target.value)} />
      <div className="flex justify-end mt-2">
        <Button onClick={submit}><Send className="size-4 mr-1" /> Submit complaint</Button>
      </div>
      <div className="mt-6">
        <h4 className="text-sm font-semibold mb-2">My past complaints</h4>
        {complaints.length === 0 ? (
          <p className="text-sm text-muted-foreground">You haven't filed any complaints yet.</p>
        ) : (
          <ol className="space-y-3 border-l-2 border-border pl-4">
            {complaints.map((c) => (
              <li key={c.id} className="relative">
                <span className="absolute -left-[21px] top-1.5 size-3 rounded-full bg-primary" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{new Date(c.created_at).toLocaleString()}</span>
                  <Badge variant="outline" className={c.status === "Solved" ? "border-success text-success" : c.status === "In-Progress" ? "border-warning text-warning-foreground" : ""}>{c.status}</Badge>
                </div>
                <p className="text-sm mt-1">{c.description}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Card>
  );
}

function TransparencyCard() {
  const month = currentMonth();
  const [expenses, setExpenses] = useState<Expense[]>([]);

  useEffect(() => {
    supabase.from("expenses").select("*").gte("date", `${month}-01`).order("date", { ascending: false }).then(({ data }) => setExpenses((data ?? []) as Expense[]));
  }, [month]);

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const byCat = new Map<string, number>();
  expenses.forEach((e) => byCat.set(e.category, (byCat.get(e.category) ?? 0) + Number(e.amount)));
  const cats = [...byCat.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <Card className="p-6 border-0 shadow-[var(--shadow-card)]">
      <h3 className="font-semibold text-lg">Society fund transparency</h3>
      <p className="text-sm text-muted-foreground">Where this month's money is going.</p>
      <p className="text-3xl font-bold mt-4">₹{total.toLocaleString()}</p>
      <p className="text-xs text-muted-foreground">Total withdrawn · {month}</p>
      <div className="mt-4 space-y-3">
        {cats.length === 0 && <p className="text-sm text-muted-foreground">No withdrawals logged yet.</p>}
        {cats.map(([cat, amt]) => (
          <div key={cat}>
            <div className="flex justify-between text-sm"><span>{cat}</span><span className="font-medium">₹{amt.toLocaleString()}</span></div>
            <div className="h-2 bg-secondary rounded-full mt-1 overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${total ? (amt / total) * 100 : 0}%`, background: "var(--gradient-primary)" }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

interface FlatHistoryRow {
  id: string;
  flat: string;
  tenant_name: string | null;
  tenant_contact: string | null;
  action: string;
  notes: string | null;
  created_at: string;
}

function FlatTab({ profile }: { profile: Profile }) {
  const [history, setHistory] = useState<FlatHistoryRow[]>([]);
  const [form, setForm] = useState({ action: "Tenant added", tenant_name: "", tenant_contact: "", notes: "" });

  const load = useCallback(() => {
    if (!profile.flat) return;
    supabase.from("flat_history").select("*").eq("flat", profile.flat).order("created_at", { ascending: false }).then(({ data }) => setHistory((data ?? []) as FlatHistoryRow[]));
  }, [profile.flat]);
  useEffect(() => { load(); }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile.flat) return toast.error("No flat assigned");
    if (!form.tenant_name.trim() && form.action !== "Tenant removed") return toast.error("Tenant name required");
    const { error } = await supabase.from("flat_history").insert({
      flat: profile.flat,
      owner_user_id: profile.id,
      action: form.action,
      tenant_name: form.tenant_name.trim() || null,
      tenant_contact: form.tenant_contact.trim() || null,
      notes: form.notes.trim() || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Recorded");
    setForm({ action: "Tenant added", tenant_name: "", tenant_contact: "", notes: "" });
    load();
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card className="p-6 border-0 shadow-[var(--shadow-card)]">
        <h3 className="font-semibold text-lg flex items-center gap-2"><Home className="size-4" /> Flat {profile.flat}</h3>
        <p className="text-sm text-muted-foreground mb-4">Record tenant arrivals, departures, and transfers. The full history is preserved below.</p>
        <form className="space-y-3" onSubmit={submit}>
          <div className="space-y-1">
            <Label>Action</Label>
            <select className="w-full border rounded-md h-10 px-3 bg-background" value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })}>
              <option>Tenant added</option>
              <option>Tenant removed</option>
              <option>Tenant changed</option>
              <option>Owner self-occupied</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label>Tenant name</Label>
            <Input value={form.tenant_name} onChange={(e) => setForm({ ...form, tenant_name: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Tenant contact</Label>
            <Input value={form.tenant_contact} onChange={(e) => setForm({ ...form, tenant_contact: e.target.value })} placeholder="+91..." />
          </div>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <Button type="submit" className="w-full"><ArrowRightLeft className="size-4 mr-1" /> Record change</Button>
        </form>
      </Card>
      <Card className="p-6 border-0 shadow-[var(--shadow-card)]">
        <h3 className="font-semibold text-lg mb-2">History</h3>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No changes recorded yet.</p>
        ) : (
          <ol className="space-y-3 border-l-2 border-border pl-4">
            {history.map((h) => (
              <li key={h.id} className="relative">
                <span className="absolute -left-[21px] top-1.5 size-3 rounded-full bg-primary" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{new Date(h.created_at).toLocaleString()}</span>
                  <Badge variant="outline">{h.action}</Badge>
                </div>
                <p className="text-sm mt-1 font-medium">{h.tenant_name ?? "—"}{h.tenant_contact ? ` · ${h.tenant_contact}` : ""}</p>
                {h.notes && <p className="text-xs text-muted-foreground mt-0.5">{h.notes}</p>}
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}