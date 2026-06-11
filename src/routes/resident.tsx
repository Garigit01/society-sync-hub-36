import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Shell } from "@/components/society/Shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/society/auth";
import { db, ensureMaintenanceForMonth, useDB, currentMonth, uid } from "@/lib/society/db";
import { CheckCircle2, AlertTriangle, Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/resident")({
  head: () => ({ meta: [{ title: "My Dashboard — Harmony Heights" }] }),
  component: ResidentPage,
});

const DEFAULT_DUTIES = [
  "Check common-area lights are off by 11 PM",
  "Inspect terrace door is locked",
  "Verify waste segregation bins",
  "Walk-through of parking area",
];

function ResidentPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const profile = useDB((s) => (user ? s.profiles[user.email] : undefined));

  useEffect(() => {
    if (!user) navigate({ to: "/" });
    else if (user.role === "admin") navigate({ to: "/admin" });
    else if (!profile) navigate({ to: "/profile-setup" });
    else ensureMaintenanceForMonth(currentMonth());
  }, [user, profile, navigate]);

  // Ensure today's duty exists
  useEffect(() => {
    if (!user || !profile) return;
    const today = new Date().toISOString().slice(0, 10);
    const has = db.get().duties.find((d) => d.email === user.email && d.date === today);
    if (!has) {
      const idx = Math.floor((Date.now() / 86400000) % DEFAULT_DUTIES.length);
      db.set((s) => ({
        ...s,
        duties: [
          ...s.duties,
          { id: uid(), email: user.email, task: DEFAULT_DUTIES[idx], date: today, done: false },
        ],
      }));
    }
  }, [user, profile]);

  if (!user || !profile) return null;

  return (
    <Shell title={`Welcome, ${profile.fullName.split(" ")[0]}`} subtitle={`Flat ${profile.flat} · ${profile.occupancy}`}>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <MaintenanceCard email={user.email} />
          <DutyCard email={user.email} />
          <ComplaintBox email={user.email} />
        </div>
        <div className="space-y-6">
          <TransparencyCard />
        </div>
      </div>
    </Shell>
  );
}

function MaintenanceCard({ email }: { email: string }) {
  const month = currentMonth();
  const rec = useDB((s) => s.maintenance.find((m) => m.email === email && m.month === month));
  const paid = rec?.status === "Paid";

  return (
    <Card
      className="p-6 border-0 shadow-[var(--shadow-elevated)] text-primary-foreground relative overflow-hidden"
      style={{ background: paid ? "linear-gradient(135deg, oklch(0.55 0.18 150), oklch(0.7 0.14 160))" : "var(--gradient-hero)" }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm opacity-80">Maintenance · {month}</p>
          <p className="text-4xl font-bold mt-1">₹{(rec?.amount ?? 0).toLocaleString()}</p>
          <p className="text-sm opacity-90 mt-1">
            {paid ? `Paid via ${rec?.mode}` : "Awaiting payment"}
          </p>
        </div>
        <Badge className={paid ? "bg-white text-success" : "bg-white text-destructive"}>
          {paid ? "PAID" : "PENDING"}
        </Badge>
      </div>
    </Card>
  );
}

function DutyCard({ email }: { email: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const duty = useDB((s) => s.duties.find((d) => d.email === email && d.date === today));
  const hour = new Date().getHours();
  const overdue = duty && !duty.done && hour >= 20;

  const markDone = () => {
    if (!duty) return;
    db.set((s) => ({
      ...s,
      duties: s.duties.map((d) => (d.id === duty.id ? { ...d, done: true, doneAt: Date.now() } : d)),
    }));
    toast.success("Duty marked complete");
  };

  return (
    <Card className="p-6 border-0 shadow-[var(--shadow-card)]">
      <h3 className="font-semibold text-lg">Today's duty</h3>
      <p className="text-sm text-muted-foreground">Cut-off 8:00 PM. Mark done before to stay on track.</p>
      {duty && (
        <div className="mt-4 rounded-lg border bg-secondary/40 p-4">
          <p className="font-medium">{duty.task}</p>
          {duty.done ? (
            <div className="mt-3 flex items-center text-success text-sm">
              <CheckCircle2 className="size-4 mr-1" /> Completed{" "}
              {duty.doneAt ? `at ${new Date(duty.doneAt).toLocaleTimeString()}` : ""}
            </div>
          ) : (
            <div className="mt-3 flex items-center justify-between">
              {overdue && (
                <div className="flex items-center text-sm font-medium rounded-md px-3 py-2 bg-warning/20 text-warning-foreground">
                  <AlertTriangle className="size-4 mr-1" /> Overdue Alert — please complete now
                </div>
              )}
              <Button onClick={markDone} className="ml-auto" style={{ background: "var(--gradient-primary)" }}>
                Mark as Done
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function ComplaintBox({ email }: { email: string }) {
  const allComplaints = useDB((s) => s.complaints);
  const complaints = useMemo(
    () => allComplaints.filter((c) => c.email === email),
    [allComplaints, email],
  );
  const [text, setText] = useState("");

  const submit = () => {
    if (!text.trim()) return toast.error("Please describe your complaint");
    db.set((s) => ({
      ...s,
      complaints: [{ id: uid(), email, description: text.trim(), createdAt: Date.now(), status: "Open" }, ...s.complaints],
    }));
    setText("");
    toast.success("Complaint submitted");
  };

  return (
    <Card className="p-6 border-0 shadow-[var(--shadow-card)]">
      <h3 className="font-semibold text-lg">Digital complaint box</h3>
      <p className="text-sm text-muted-foreground">Your feedback reaches the admin instantly.</p>
      <Textarea
        className="mt-4"
        rows={3}
        placeholder="Describe the issue..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex justify-end mt-2">
        <Button onClick={submit}><Send className="size-4 mr-1" /> Submit complaint</Button>
      </div>

      <div className="mt-6">
        <h4 className="text-sm font-semibold mb-2">My past complaints</h4>
        {complaints.length === 0 ? (
          <p className="text-sm text-muted-foreground">You haven't filed any complaints yet.</p>
        ) : (
          <ol className="space-y-3 border-l-2 border-border pl-4">
            {complaints.sort((a, b) => b.createdAt - a.createdAt).map((c) => (
              <li key={c.id} className="relative">
                <span className="absolute -left-[21px] top-1.5 size-3 rounded-full bg-primary" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{new Date(c.createdAt).toLocaleString()}</span>
                  <Badge
                    variant="outline"
                    className={
                      c.status === "Solved"
                        ? "border-success text-success"
                        : c.status === "In-Progress"
                          ? "border-warning text-warning-foreground"
                          : ""
                    }
                  >
                    {c.status}
                  </Badge>
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
  const allExpenses = useDB((s) => s.expenses);
  const expenses = useMemo(
    () => allExpenses.filter((e) => e.date.startsWith(month)),
    [allExpenses, month],
  );
  const total = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses]);
  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    expenses.forEach((e) => map.set(e.category, (map.get(e.category) ?? 0) + e.amount));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  return (
    <Card className="p-6 border-0 shadow-[var(--shadow-card)]">
      <h3 className="font-semibold text-lg">Society fund transparency</h3>
      <p className="text-sm text-muted-foreground">Where this month's money is going.</p>
      <p className="text-3xl font-bold mt-4">₹{total.toLocaleString()}</p>
      <p className="text-xs text-muted-foreground">Total withdrawn · {month}</p>
      <div className="mt-4 space-y-3">
        {byCategory.length === 0 && <p className="text-sm text-muted-foreground">No withdrawals logged yet.</p>}
        {byCategory.map(([cat, amt]) => (
          <div key={cat}>
            <div className="flex justify-between text-sm">
              <span>{cat}</span>
              <span className="font-medium">₹{amt.toLocaleString()}</span>
            </div>
            <div className="h-2 bg-secondary rounded-full mt-1 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${total ? (amt / total) * 100 : 0}%`, background: "var(--gradient-primary)" }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 pt-4 border-t">
        <p className="text-xs font-semibold text-muted-foreground mb-2">RECENT TASKS FUNDED</p>
        <ul className="space-y-2 text-sm">
          {expenses.slice(0, 4).map((e) => (
            <li key={e.id} className="flex justify-between">
              <span className="truncate pr-2">{e.purpose}</span>
              <span className="text-muted-foreground whitespace-nowrap">₹{e.amount.toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}