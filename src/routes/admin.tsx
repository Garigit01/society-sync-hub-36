import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Shell } from "@/components/society/Shell";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/society/auth";
import { db, ensureMaintenanceForMonth, useDB, currentMonth, uid, type Profile } from "@/lib/society/db";
import { Download, MessageCircle, Wallet, Wrench, Bell, Send, IndianRupee } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin Dashboard — Harmony Heights" }] }),
  component: AdminPage,
});

function AdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!user) navigate({ to: "/" });
    else if (user.role !== "admin") navigate({ to: "/resident" });
    else ensureMaintenanceForMonth(currentMonth());
  }, [user, navigate]);

  if (user?.role !== "admin") return null;

  return (
    <Shell title="Admin Dashboard" subtitle="Manage residents, finances and complaints across the society.">
      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="grid grid-cols-3 w-full sm:w-auto">
          <TabsTrigger value="users">Payments & Users</TabsTrigger>
          <TabsTrigger value="funds">Fund Ledger</TabsTrigger>
          <TabsTrigger value="complaints">Complaints</TabsTrigger>
        </TabsList>
        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="funds"><FundsTab /></TabsContent>
        <TabsContent value="complaints"><ComplaintsTab /></TabsContent>
      </Tabs>
    </Shell>
  );
}

function UsersTab() {
  const profiles = useDB((s) => s.profiles);
  const maintenance = useDB((s) => s.maintenance);
  const baseline = useDB((s) => s.baselineAmount);
  const month = currentMonth();
  const [selected, setSelected] = useState<Profile | null>(null);

  const list = Object.values(profiles).sort((a, b) => a.flat.localeCompare(b.flat));
  const monthRecords = maintenance.filter((m) => m.month === month);
  const totalCollected = monthRecords.reduce((s, r) => s + r.paid, 0);
  const totalExpected = monthRecords.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-3 gap-4">
        <StatCard label="Registered residents" value={list.length} icon={<Wallet className="size-4" />} />
        <StatCard label={`Collected (${month})`} value={`₹${totalCollected.toLocaleString()}`} tint="success" />
        <StatCard label="Expected" value={`₹${totalExpected.toLocaleString()}`} />
      </div>

      <Card className="p-6 border-0 shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-end gap-4 justify-between mb-4">
          <div>
            <h3 className="font-semibold text-lg">Resident directory</h3>
            <p className="text-sm text-muted-foreground">Click any row to see full profile and trigger alerts.</p>
          </div>
          <div className="flex items-end gap-2">
            <div>
              <Label className="text-xs">Baseline maintenance ₹</Label>
              <Input
                type="number"
                value={baseline}
                className="w-36"
                onChange={(e) => {
                  const v = Number(e.target.value) || 0;
                  db.set((s) => ({
                    ...s,
                    baselineAmount: v,
                    maintenance: s.maintenance.map((m) =>
                      m.month === month && m.status === "Pending" ? { ...m, amount: v } : m,
                    ),
                  }));
                }}
              />
            </div>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Flat</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Mode</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((p) => {
              const rec = monthRecords.find((m) => m.email === p.email);
              return (
                <TableRow key={p.email} className="cursor-pointer hover:bg-secondary/60" onClick={() => setSelected(p)}>
                  <TableCell className="font-medium">{p.flat}</TableCell>
                  <TableCell>{p.fullName}</TableCell>
                  <TableCell><Badge variant="outline">{p.occupancy}</Badge></TableCell>
                  <TableCell>₹{rec?.amount ?? baseline}</TableCell>
                  <TableCell>
                    <Select
                      value={rec?.status ?? "Pending"}
                      onValueChange={(v) => {
                        db.set((s) => ({
                          ...s,
                          maintenance: s.maintenance.map((m) =>
                            m.email === p.email && m.month === month
                              ? {
                                  ...m,
                                  status: v as "Paid" | "Pending",
                                  paid: v === "Paid" ? m.amount : 0,
                                  mode: v === "Paid" && m.mode === "—" ? "Online" : m.mode,
                                }
                              : m,
                          ),
                        }));
                      }}
                    >
                      <SelectTrigger onClick={(e) => e.stopPropagation()} className="w-28 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Paid">Paid</SelectItem>
                        <SelectItem value="Pending">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={rec?.mode ?? "—"}
                      onValueChange={(v) => {
                        db.set((s) => ({
                          ...s,
                          maintenance: s.maintenance.map((m) =>
                            m.email === p.email && m.month === month ? { ...m, mode: v as "Online" | "Cash" | "—" } : m,
                          ),
                        }));
                      }}
                    >
                      <SelectTrigger onClick={(e) => e.stopPropagation()} className="w-24 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Online">Online</SelectItem>
                        <SelectItem value="Cash">Cash</SelectItem>
                        <SelectItem value="—">—</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <UserDetailDialog profile={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function UserDetailDialog({ profile, onClose }: { profile: Profile | null; onClose: () => void }) {
  if (!profile) return null;

  const waLink = (text: string) =>
    `https://wa.me/${profile.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;

  const dutyMsg = `Hello ${profile.fullName}, this is a reminder from Harmony Heights Society regarding your monthly duty assignment for flat ${profile.flat}. Kindly complete it before the cut-off and mark it done in the app. Thank you!`;
  const maintMsg = `Hello ${profile.fullName}, your maintenance payment for flat ${profile.flat} is pending. Please clear it at the earliest to keep society operations running smoothly. Thank you!`;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{profile.fullName} — {profile.flat}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <Row k="Email" v={profile.email} />
          <Row k="Occupancy" v={profile.occupancy} />
          <Row k="WhatsApp" v={profile.whatsapp} />
          <Row k="Alternate" v={profile.altContact} />
          <Row k="Vehicle" v={profile.vehicle || "—"} />
          <Row k="Joined" v={new Date(profile.createdAt).toLocaleDateString()} />
        </div>
        <div className="grid sm:grid-cols-2 gap-2 pt-4 border-t">
          <Button asChild>
            <a href={waLink(dutyMsg)} target="_blank" rel="noreferrer">
              <Bell className="size-4 mr-1" /> Monthly Duty Alert
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href={waLink(maintMsg)} target="_blank" rel="noreferrer">
              <MessageCircle className="size-4 mr-1" /> Pending Maintenance
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}

function FundsTab() {
  const expenses = useDB((s) => s.expenses);
  const contingency = useDB((s) => s.contingency);
  const maintenance = useDB((s) => s.maintenance);
  const profiles = useDB((s) => s.profiles);
  const month = currentMonth();

  const [form, setForm] = useState({ amount: "", purpose: "", date: new Date().toISOString().slice(0, 10), category: "Repairs" });

  const monthExpenses = expenses.filter((e) => e.date.startsWith(month));
  const totalWithdrawn = monthExpenses.reduce((s, e) => s + e.amount, 0);
  const monthRecords = maintenance.filter((m) => m.month === month);
  const collected = monthRecords.reduce((s, r) => s + r.paid, 0);

  const addExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(form.amount);
    if (!amt || !form.purpose.trim()) return toast.error("Amount & purpose required");
    db.set((s) => ({
      ...s,
      expenses: [{ id: uid(), amount: amt, purpose: form.purpose.trim(), date: form.date, category: form.category }, ...s.expenses],
    }));
    setForm({ ...form, amount: "", purpose: "" });
    toast.success("Expense logged");
  };

  const downloadReport = () => {
    const lines: string[] = [];
    lines.push(`Harmony Heights — Monthly Financial Report (${month})`);
    lines.push("");
    lines.push("Flat,Resident,Amount,Paid,Status,Mode");
    Object.values(profiles).forEach((p) => {
      const r = monthRecords.find((m) => m.email === p.email);
      lines.push(`${p.flat},${p.fullName},${r?.amount ?? 0},${r?.paid ?? 0},${r?.status ?? "Pending"},${r?.mode ?? "—"}`);
    });
    lines.push("");
    lines.push("Expenses");
    lines.push("Date,Category,Purpose,Amount");
    monthExpenses.forEach((e) => lines.push(`${e.date},${e.category},"${e.purpose}",${e.amount}`));
    lines.push("");
    lines.push(`Total Collected,${collected}`);
    lines.push(`Total Withdrawn,${totalWithdrawn}`);
    lines.push(`Contingency Fund,${contingency}`);
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `harmony-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Report downloaded");
  };

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-3 gap-4">
        <StatCard label="Collected this month" value={`₹${collected.toLocaleString()}`} tint="success" />
        <StatCard label="Withdrawn this month" value={`₹${totalWithdrawn.toLocaleString()}`} tint="warning" />
        <StatCard
          label="Contingency fund"
          value={`₹${contingency.toLocaleString()}`}
          icon={<IndianRupee className="size-4" />}
          action={
            <Input
              type="number"
              defaultValue={contingency}
              onBlur={(e) => db.set((s) => ({ ...s, contingency: Number(e.target.value) || 0 }))}
              className="h-8 mt-2"
            />
          }
        />
      </div>

      <Card className="p-6 border-0 shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">Log society withdrawal</h3>
          <Button onClick={downloadReport} style={{ background: "var(--gradient-primary)" }}>
            <Download className="size-4 mr-1" /> Download Report
          </Button>
        </div>
        <form className="grid sm:grid-cols-5 gap-3" onSubmit={addExpense}>
          <Input type="number" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <Input placeholder="Purpose / task" className="sm:col-span-2" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
          <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["Security", "Lift", "Repairs", "Electricity", "Cleaning", "Misc"].map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" className="sm:col-span-5"><Send className="size-4 mr-1" /> Add expense</Button>
        </form>
      </Card>

      <Card className="p-6 border-0 shadow-[var(--shadow-card)]">
        <h3 className="font-semibold text-lg mb-4">Expense ledger</h3>
        {expenses.length === 0 ? (
          <p className="text-muted-foreground text-sm">No expenses logged yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{e.date}</TableCell>
                  <TableCell><Badge variant="secondary">{e.category}</Badge></TableCell>
                  <TableCell>{e.purpose}</TableCell>
                  <TableCell className="text-right font-medium">₹{e.amount.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function ComplaintsTab() {
  const complaints = useDB((s) => s.complaints);
  const profiles = useDB((s) => s.profiles);
  const sorted = [...complaints].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="grid md:grid-cols-3 gap-4">
      {(["Open", "In-Progress", "Solved"] as const).map((col) => (
        <Card key={col} className="p-4 border-0 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">{col}</h3>
            <Badge variant={col === "Solved" ? "default" : "outline"}>
              {sorted.filter((c) => c.status === col).length}
            </Badge>
          </div>
          <div className="space-y-3">
            {sorted.filter((c) => c.status === col).map((c) => {
              const p = profiles[c.email];
              return (
                <Card key={c.id} className="p-3 bg-secondary/50 border-0">
                  <div className="text-xs text-muted-foreground flex justify-between">
                    <span>{p?.flat ?? "—"} · {p?.fullName ?? c.email}</span>
                    <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm mt-2">{c.description}</p>
                  <Select
                    value={c.status}
                    onValueChange={(v) => {
                      db.set((s) => ({
                        ...s,
                        complaints: s.complaints.map((x) => x.id === c.id ? { ...x, status: v as typeof c.status } : x),
                      }));
                    }}
                  >
                    <SelectTrigger className="h-8 mt-2"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Open">Open</SelectItem>
                      <SelectItem value="In-Progress">In-Progress</SelectItem>
                      <SelectItem value="Solved">Solved</SelectItem>
                    </SelectContent>
                  </Select>
                </Card>
              );
            })}
            {sorted.filter((c) => c.status === col).length === 0 && (
              <p className="text-xs text-muted-foreground">Nothing here.</p>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  tint,
  action,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  tint?: "success" | "warning";
  action?: React.ReactNode;
}) {
  const tintClass =
    tint === "success" ? "text-success" : tint === "warning" ? "text-warning" : "text-foreground";
  return (
    <Card className="p-5 border-0 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{label}</span>
        {icon}
      </div>
      <div className={`text-2xl font-bold mt-2 ${tintClass}`}>{value}</div>
      {action}
    </Card>
  );
}