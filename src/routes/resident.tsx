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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/society/auth";
import { supabase } from "@/integrations/supabase/client";
import { currentMonth, todayISO, BASELINE_AMOUNT, penaltyForToday, type Profile, type MaintenanceRecord, type Complaint, type Duty, type Expense } from "@/lib/society/db";
import { useT, monthLabel } from "@/lib/society/i18n";
import { useUnreadComplaints, markSeen } from "@/lib/society/unread";
import { CheckCircle2, AlertTriangle, Send, Home, ArrowRightLeft, Wallet, QrCode } from "lucide-react";
import { toast } from "sonner";
import { DocumentsTab } from "./admin";

export const Route = createFileRoute("/resident")({
  head: () => ({ meta: [{ title: "My Dashboard — Harmony Heights" }] }),
  component: ResidentPage,
});

function ResidentPage() {
  const { user, role, loading } = useAuth();
  const { t } = useT();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState("home");
  const unread = useUnreadComplaints(`resident-${user?.id ?? ""}`, user?.id);

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

  return (
    <Shell title={`${t("welcomeBack")}, ${(profile.full_name ?? "Resident").split(" ")[0]}`} subtitle={`${t("flat")} ${profile.flat} · ${profile.occupancy}`}>
      <Tabs value={tab} onValueChange={(v) => { setTab(v); if (v === "home") markSeen(`resident-${profile.id}`); }} className="space-y-6">
        <TabsList>
          <TabsTrigger value="home" className="relative">
            {t("home")}
            {unread > 0 && tab !== "home" && (
              <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-destructive ring-2 ring-background" aria-label={`${unread} unread`} />
            )}
          </TabsTrigger>
          <TabsTrigger value="docs">{t("tabDocs")}</TabsTrigger>
          {profile.occupancy === "Owner" && <TabsTrigger value="flat">{t("flatAndTenants")}</TabsTrigger>}
        </TabsList>
        <TabsContent value="home">
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <MaintenanceCard userId={profile.id} />
              <DutyCard userId={profile.id} />
              <ComplaintBox userId={profile.id} unread={unread} />
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
  const prevMonth = (() => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, (m ?? 1) - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();
  const { t, lang } = useT();
  const [all, setAll] = useState<MaintenanceRecord[]>([]);
  const [payOpen, setPayOpen] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  useEffect(() => {
    const load = () => supabase.from("maintenance").select("*").eq("user_id", userId).then(({ data }) => setAll((data ?? []) as MaintenanceRecord[]));
    load();
    const ch = supabase.channel(`maint-${userId}`).on("postgres_changes", { event: "*", schema: "public", table: "maintenance", filter: `user_id=eq.${userId}` }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);

  const rec = all.find((m) => m.month === month) ?? null;
  const past = all.filter((m) => m.month < month && m.status === "Pending").reduce((s, m) => s + Number(m.amount), 0);
  const paid = rec?.status === "Paid";
  const amount = Number(rec?.amount ?? BASELINE_AMOUNT);
  const penalty = paid ? 0 : penaltyForToday();
  const total = (paid ? 0 : amount) + past + penalty;

  const openPay = async () => {
    setPayOpen(true);
    const { data } = await supabase.from("society_settings").select("payment_qr_url").eq("id", 1).maybeSingle();
    const path = (data?.payment_qr_url as string | null) ?? null;
    if (!path) { setQrUrl(null); return; }
    const { data: signed } = await supabase.storage.from("society-docs").createSignedUrl(path, 3600);
    setQrUrl(signed?.signedUrl ?? null);
  };

  return (
    <>
    <Card className="p-6 border-0 shadow-[var(--shadow-elevated)] text-primary-foreground relative overflow-hidden"
      style={{ background: total === 0 ? "linear-gradient(135deg, oklch(0.55 0.18 150), oklch(0.7 0.14 160))" : "var(--gradient-hero)" }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm opacity-80">{t("totalOutstanding")}</p>
          <p className="text-4xl font-bold mt-1">₹{total.toLocaleString()}</p>
          <div className="text-xs opacity-90 mt-2 grid gap-0.5">
            <span>{t("active")}: {monthLabel(month, lang)} · ₹{amount.toLocaleString()} ({paid ? t("paid") : t("pending")})</span>
            {past > 0 && <span>{t("pastDues")} (≤ {monthLabel(prevMonth, lang)}): ₹{past.toLocaleString()}</span>}
            {penalty > 0 && <span>{t("penalty")}: ₹{penalty.toLocaleString()}</span>}
            <span className="opacity-80">{t("billingDate")} · {t("dueDate")}</span>
          </div>
          {total > 0 && (
            <Button onClick={openPay} className="mt-4 bg-white text-primary hover:bg-white/90">
              <QrCode className="size-4 mr-1" /> Pay Now
            </Button>
          )}
        </div>
        <Badge className={total === 0 ? "bg-white text-success" : "bg-white text-destructive"}>{total === 0 ? t("cleared") : t("due")}</Badge>
      </div>
    </Card>
    <Dialog open={payOpen} onOpenChange={setPayOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle className="text-center">Scan to Pay Maintenance</DialogTitle></DialogHeader>
        <div className="flex flex-col items-center gap-3 py-2">
          {qrUrl ? (
            <img src={qrUrl} alt="Payment QR code" className="w-64 h-64 object-contain rounded-lg border bg-white p-2" />
          ) : (
            <p className="text-sm text-muted-foreground text-center py-12">No payment QR uploaded by admin yet.</p>
          )}
          <p className="text-sm font-semibold">Amount Due: ₹{total.toLocaleString()}</p>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

function BuildingFundCard() {
  const month = currentMonth();
  const { t, lang } = useT();
  const [base, setBase] = useState(BASELINE_AMOUNT);
  const [count, setCount] = useState(0);
  const [collected, setCollected] = useState(0);

  useEffect(() => {
    supabase.from("society_settings").select("base_amount").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data) setBase(Number(data.base_amount));
    });
    supabase.from("profiles").select("id", { count: "exact", head: true }).then(({ count: c }) => setCount(c ?? 0));
    supabase.from("maintenance").select("paid,status").eq("month", month).then(({ data }) => {
      const sum = (data ?? []).filter((r) => r.status === "Paid").reduce((s, r) => s + Number(r.paid), 0);
      setCollected(sum);
    });
  }, [month]);

  const expected = base * count;
  const pct = expected ? Math.min(100, (collected / expected) * 100) : 0;

  return (
    <Card className="p-6 border-0 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2 mb-1">
        <span className="size-8 rounded-lg grid place-items-center text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>
          <Wallet className="size-4" />
        </span>
        <h3 className="font-semibold text-lg">{t("totalBuildingFund")}</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-3">{t("expectedThisMonth")} · {monthLabel(month, lang)}</p>
      <p className="text-3xl font-bold">₹{expected.toLocaleString()}</p>
      <p className="text-xs text-muted-foreground mt-1">{count} {t("resident")} × ₹{base.toLocaleString()}</p>
      <div className="mt-3">
        <div className="flex justify-between text-xs mb-1"><span>{t("paid")}</span><span className="font-medium">₹{collected.toLocaleString()}</span></div>
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--gradient-primary)" }} />
        </div>
      </div>
    </Card>
  );
}

function DutyCard({ userId }: { userId: string }) {
  const today = todayISO();
  const { t } = useT();
  const [duties, setDuties] = useState<Duty[]>([]);

  const load = useCallback(() => {
    supabase.from("duties").select("*").eq("user_id", userId).gte("date", today).order("date").then(({ data }) => setDuties((data ?? []) as Duty[]));
  }, [userId, today]);

  useEffect(() => {
    load();
    const ch = supabase.channel(`duty-${userId}`).on("postgres_changes", { event: "*", schema: "public", table: "duties", filter: `user_id=eq.${userId}` }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, load]);

  const markDone = async (id: string) => {
    const { error } = await supabase.from("duties").update({ done: true, done_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Duty marked complete");
    load();
  };

  return (
    <Card className="p-6 border-0 shadow-[var(--shadow-card)]">
      <h3 className="font-semibold text-lg">{t("todaysDuty")}</h3>
      <p className="text-sm text-muted-foreground">{t("assignedByAdmin")}</p>
      {duties.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{t("noDuty")}</p>
      ) : (
        <div className="mt-4 space-y-3">
          {duties.map((duty) => {
            const overdue = !duty.done && new Date().getHours() >= 20 && duty.date === today;
            return (
              <div key={duty.id} className="rounded-lg border bg-secondary/40 p-4">
                <p className="font-medium">{duty.task}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{duty.date}</p>
                {duty.done ? (
                  <div className="mt-3 flex items-center text-success text-sm">
                    <CheckCircle2 className="size-4 mr-1" /> {t("completed")} {duty.done_at ? `· ${new Date(duty.done_at).toLocaleTimeString()}` : ""}
                  </div>
                ) : (
                  <div className="mt-3 flex items-center justify-between">
                    {overdue && (
                      <div className="flex items-center text-sm font-medium rounded-md px-3 py-2 bg-warning/20 text-warning-foreground">
                        <AlertTriangle className="size-4 mr-1" /> {t("overdue")}
                      </div>
                    )}
                    <Button onClick={() => markDone(duty.id)} className="ml-auto" style={{ background: "var(--gradient-primary)" }}>{t("markDone")}</Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function ComplaintBox({ userId, unread }: { userId: string; unread: number }) {
  const { t } = useT();
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
    if (!text.trim()) return toast.error(t("describeIssue"));
    const { error } = await supabase.from("complaints").insert({ user_id: userId, description: text.trim() });
    if (error) return toast.error(error.message);
    setText("");
    toast.success(t("submitComplaint"));
  };

  return (
    <Card className="p-6 border-0 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2">
        <h3 className="font-semibold text-lg">{t("complaintBox")}</h3>
        {unread > 0 && <span className="size-2.5 rounded-full bg-destructive" aria-label={`${unread} new`} />}
      </div>
      <p className="text-sm text-muted-foreground">{t("complaintHint")}</p>
      <Textarea className="mt-4" rows={3} placeholder={t("describeIssue")} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="flex justify-end mt-2">
        <Button onClick={submit}><Send className="size-4 mr-1" /> {t("submitComplaint")}</Button>
      </div>
      <div className="mt-6">
        <h4 className="text-sm font-semibold mb-2">{t("pastComplaints")}</h4>
        {complaints.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noComplaints")}</p>
        ) : (
          <ol className="space-y-3 border-l-2 border-border pl-4">
            {complaints.map((c) => {
              const fresh = new Date(c.created_at).getTime() > Date.now() - 1000 * 60 * 60 * 24 * 2;
              return (
              <li key={c.id} className="relative">
                <span className="absolute -left-[21px] top-1.5 size-3 rounded-full bg-primary" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{new Date(c.created_at).toLocaleString()}</span>
                  <div className="flex items-center gap-1.5">
                    {fresh && c.status !== "Solved" && <span className="size-2 rounded-full bg-destructive" />}
                    <Badge variant="outline" className={c.status === "Solved" ? "border-success text-success" : c.status === "In-Progress" ? "border-warning text-warning-foreground" : ""}>{c.status}</Badge>
                  </div>
                </div>
                <p className="text-sm mt-1">{c.description}</p>
              </li>
              );
            })}
          </ol>
        )}
      </div>
    </Card>
  );
}

function TransparencyCard() {
  const month = currentMonth();
  const { t } = useT();
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
      <h3 className="font-semibold text-lg">{t("transparency")}</h3>
      <p className="text-sm text-muted-foreground">{t("transparencySub")}</p>
      <p className="text-3xl font-bold mt-4">₹{total.toLocaleString()}</p>
      <p className="text-xs text-muted-foreground">{t("totalWithdrawn")} · {month}</p>
      <div className="mt-4 space-y-3">
        {cats.length === 0 && <p className="text-sm text-muted-foreground">{t("noWithdrawals")}</p>}
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