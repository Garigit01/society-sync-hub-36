import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Shell } from "@/components/society/Shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/society/auth";
import { supabase } from "@/integrations/supabase/client";
import { currentMonth, todayISO, BASELINE_AMOUNT, DEFAULT_DUTIES, type Profile, type MaintenanceRecord, type Complaint, type Duty, type Expense } from "@/lib/society/db";
import { CheckCircle2, AlertTriangle, Send } from "lucide-react";
import { toast } from "sonner";

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

  // Ensure maintenance row + today's duty
  useEffect(() => {
    if (!ready || !user) return;
    const month = currentMonth();
    supabase.from("maintenance").select("id").eq("user_id", user.id).eq("month", month).maybeSingle().then(({ data }) => {
      if (!data) supabase.from("maintenance").insert({ user_id: user.id, month, amount: BASELINE_AMOUNT });
    });
    const today = todayISO();
    supabase.from("duties").select("id").eq("user_id", user.id).eq("date", today).maybeSingle().then(({ data }) => {
      if (!data) {
        const idx = Math.floor((Date.now() / 86400000) % DEFAULT_DUTIES.length);
        supabase.from("duties").insert({ user_id: user.id, task: DEFAULT_DUTIES[idx], date: today });
      }
    });
  }, [ready, user]);

  if (!ready || !profile) return null;

  return (
    <Shell title={`Welcome, ${(profile.full_name ?? "Resident").split(" ")[0]}`} subtitle={`Flat ${profile.flat} · ${profile.occupancy}`}>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <MaintenanceCard userId={profile.id} />
          <DutyCard userId={profile.id} />
          <ComplaintBox userId={profile.id} />
        </div>
        <div className="space-y-6">
          <TransparencyCard />
        </div>
      </div>
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
  return (
    <Card className="p-6 border-0 shadow-[var(--shadow-elevated)] text-primary-foreground relative overflow-hidden"
      style={{ background: paid ? "linear-gradient(135deg, oklch(0.55 0.18 150), oklch(0.7 0.14 160))" : "var(--gradient-hero)" }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm opacity-80">Maintenance · {month}</p>
          <p className="text-4xl font-bold mt-1">₹{Number(rec?.amount ?? BASELINE_AMOUNT).toLocaleString()}</p>
          <p className="text-sm opacity-90 mt-1">{paid ? `Paid via ${rec?.mode}` : "Awaiting payment"}</p>
        </div>
        <Badge className={paid ? "bg-white text-success" : "bg-white text-destructive"}>{paid ? "PAID" : "PENDING"}</Badge>
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