import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Shell } from "@/components/society/Shell";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/society/auth";
import { supabase } from "@/integrations/supabase/client";
import { currentMonth, todayISO, type Profile, type MaintenanceRecord, type Complaint, type Expense } from "@/lib/society/db";
import { Download, Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin Dashboard — Harmony Heights" }] }),
  component: AdminPage,
});

function AdminPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/" });
    else if (role !== "admin") navigate({ to: "/resident" });
  }, [user, role, loading, navigate]);

  if (role !== "admin") return null;
  return (
    <Shell title="Admin Dashboard" subtitle="Manage residents, finances and complaints.">
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
  const month = currentMonth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);

  const load = useCallback(async () => {
    const [{ data: ps }, { data: ms }] = await Promise.all([
      supabase.from("profiles").select("*").order("flat"),
      supabase.from("maintenance").select("*").eq("month", month),
    ]);
    setProfiles((ps ?? []) as Profile[]);
    setRecords((ms ?? []) as MaintenanceRecord[]);
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const updateRec = async (userId: string, patch: Partial<MaintenanceRecord>) => {
    const existing = records.find((m) => m.user_id === userId);
    if (existing) {
      const { error } = await supabase.from("maintenance").update(patch).eq("id", existing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("maintenance").insert({ user_id: userId, month, amount: 2500, ...patch });
      if (error) return toast.error(error.message);
    }
    load();
  };

  return (
    <Card className="p-6 border-0 shadow-[var(--shadow-card)]">
      <h3 className="font-semibold text-lg mb-4">Resident directory ({profiles.length})</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Flat</TableHead><TableHead>Name</TableHead><TableHead>WhatsApp</TableHead>
            <TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Mode</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {profiles.map((p) => {
            const r = records.find((m) => m.user_id === p.id);
            return (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.flat ?? "—"}</TableCell>
                <TableCell>{p.full_name ?? p.email}</TableCell>
                <TableCell className="text-xs">{p.whatsapp ?? "—"}</TableCell>
                <TableCell>₹{Number(r?.amount ?? 2500)}</TableCell>
                <TableCell>
                  <Select value={r?.status ?? "Pending"} onValueChange={(v) => updateRec(p.id, { status: v as "Paid" | "Pending", paid: v === "Paid" ? Number(r?.amount ?? 2500) : 0 })}>
                    <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Paid">Paid</SelectItem>
                      <SelectItem value="Pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select value={r?.mode ?? "—"} onValueChange={(v) => updateRec(p.id, { mode: v })}>
                    <SelectTrigger className="w-24 h-8"><SelectValue /></SelectTrigger>
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
  );
}

function FundsTab() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [form, setForm] = useState({ amount: "", purpose: "", date: todayISO(), category: "Repairs" });

  const load = useCallback(() => {
    supabase.from("expenses").select("*").order("date", { ascending: false }).then(({ data }) => setExpenses((data ?? []) as Expense[]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(form.amount);
    if (!amt || !form.purpose.trim()) return toast.error("Amount & purpose required");
    const { error } = await supabase.from("expenses").insert({ amount: amt, purpose: form.purpose.trim(), date: form.date, category: form.category });
    if (error) return toast.error(error.message);
    setForm({ ...form, amount: "", purpose: "" });
    toast.success("Expense logged");
    load();
  };

  const download = () => {
    const rows = ["Date,Category,Purpose,Amount", ...expenses.map((e) => `${e.date},${e.category},"${e.purpose}",${e.amount}`)];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `expenses-${currentMonth()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 border-0 shadow-[var(--shadow-card)]">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-lg">Log society withdrawal</h3>
          <Button onClick={download} style={{ background: "var(--gradient-primary)" }}><Download className="size-4 mr-1" /> Download CSV</Button>
        </div>
        <form className="grid sm:grid-cols-5 gap-3" onSubmit={add}>
          <Input type="number" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <Input placeholder="Purpose" className="sm:col-span-2" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
          <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["Security", "Lift", "Repairs", "Electricity", "Cleaning", "Misc"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button type="submit" className="sm:col-span-5"><Send className="size-4 mr-1" /> Add expense</Button>
        </form>
      </Card>
      <Card className="p-6 border-0 shadow-[var(--shadow-card)]">
        <h3 className="font-semibold text-lg mb-4">Expense ledger</h3>
        <Table>
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Category</TableHead><TableHead>Purpose</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
          <TableBody>
            {expenses.map((e) => (
              <TableRow key={e.id}><TableCell>{e.date}</TableCell><TableCell><Badge variant="secondary">{e.category}</Badge></TableCell><TableCell>{e.purpose}</TableCell><TableCell className="text-right font-medium">₹{Number(e.amount).toLocaleString()}</TableCell></TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function ComplaintsTab() {
  const [complaints, setComplaints] = useState<(Complaint & { profile?: Profile })[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase.from("complaints").select("*").order("created_at", { ascending: false });
    const list = (data ?? []) as Complaint[];
    const ids = [...new Set(list.map((c) => c.user_id))];
    const { data: ps } = await supabase.from("profiles").select("*").in("id", ids);
    const map = new Map((ps ?? []).map((p) => [p.id, p as unknown as Profile] as const));
    setComplaints(list.map((c) => ({ ...c, profile: map.get(c.user_id) })));
  }, []);
  useEffect(() => { load(); }, [load]);

  const setStatus = async (id: string, status: Complaint["status"]) => {
    const { error } = await supabase.from("complaints").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="grid md:grid-cols-3 gap-4">
      {(["Open", "In-Progress", "Solved"] as const).map((col) => (
        <Card key={col} className="p-4 border-0 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">{col}</h3>
            <Badge variant="outline">{complaints.filter((c) => c.status === col).length}</Badge>
          </div>
          <div className="space-y-3">
            {complaints.filter((c) => c.status === col).map((c) => (
              <Card key={c.id} className="p-3 bg-secondary/50 border-0">
                <div className="text-xs text-muted-foreground flex justify-between">
                  <span>{c.profile?.flat ?? "—"} · {c.profile?.full_name ?? c.profile?.email ?? "User"}</span>
                  <span>{new Date(c.created_at).toLocaleDateString()}</span>
                </div>
                <p className="text-sm mt-2">{c.description}</p>
                <Select value={c.status} onValueChange={(v) => setStatus(c.id, v as Complaint["status"])}>
                  <SelectTrigger className="h-8 mt-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Open">Open</SelectItem>
                    <SelectItem value="In-Progress">In-Progress</SelectItem>
                    <SelectItem value="Solved">Solved</SelectItem>
                  </SelectContent>
                </Select>
              </Card>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}