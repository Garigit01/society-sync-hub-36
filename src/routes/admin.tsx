import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { Shell } from "@/components/society/Shell";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/society/auth";
import { supabase } from "@/integrations/supabase/client";
import { currentMonth, todayISO, penaltyForToday, type Profile, type MaintenanceRecord, type Complaint, type Expense, type Duty } from "@/lib/society/db";
import { useT, monthLabel } from "@/lib/society/i18n";
import { useUnreadComplaints, markSeen } from "@/lib/society/unread";
import { Download, Send, X, Upload, Trash2, MessageSquare, Save, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RTooltip, BarChart, Bar, XAxis, YAxis, Legend } from "recharts";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin Dashboard — Harmony Heights" }] }),
  component: AdminPage,
});

function AdminPage() {
  const { user, role, loading } = useAuth();
  const { t } = useT();
  const navigate = useNavigate();
  const [tab, setTab] = useState("users");
  const unread = useUnreadComplaints("admin");
  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/" });
    else if (role !== "admin") navigate({ to: "/resident" });
  }, [user, role, loading, navigate]);

  if (role !== "admin") return null;
  return (
    <Shell title={t("adminDashboard")} subtitle={t("adminSubtitle")}>
      <Tabs value={tab} onValueChange={(v) => { setTab(v); if (v === "complaints") markSeen("admin"); }} className="space-y-6">
        <TabsList className="grid grid-cols-3 sm:grid-cols-5 w-full">
          <TabsTrigger value="users">{t("tabPayments")}</TabsTrigger>
          <TabsTrigger value="funds">{t("tabFunds")}</TabsTrigger>
          <TabsTrigger value="complaints" className="relative">
            {t("tabComplaints")}
            {unread > 0 && tab !== "complaints" && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold ring-2 ring-background">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="docs">{t("tabDocs")}</TabsTrigger>
          <TabsTrigger value="broadcast">{t("tabBroadcast")}</TabsTrigger>
        </TabsList>
        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="funds"><FundsTab /></TabsContent>
        <TabsContent value="complaints"><ComplaintsTab /></TabsContent>
        <TabsContent value="docs"><DocumentsTab isAdmin /></TabsContent>
        <TabsContent value="broadcast"><BroadcastTab /></TabsContent>
      </Tabs>
    </Shell>
  );
}

function useSettings() {
  const [base, setBase] = useState(2500);
  const load = useCallback(() => {
    supabase.from("society_settings").select("base_amount").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data) setBase(Number(data.base_amount));
    });
  }, []);
  useEffect(() => { load(); }, [load]);
  return { base, setBase, reload: load };
}

function UsersTab() {
  const { t, lang } = useT();
  const month = currentMonth();
  const prevMonth = (() => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, (m ?? 1) - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();
  const { base, setBase, reload: reloadBase } = useSettings();
  const [draftBase, setDraftBase] = useState<string>("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [allRecords, setAllRecords] = useState<MaintenanceRecord[]>([]);
  const [selected, setSelected] = useState<Profile | null>(null);
  const penalty = penaltyForToday();
  const [qrPath, setQrPath] = useState<string | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [qrUploading, setQrUploading] = useState(false);

  const loadQr = useCallback(async () => {
    const { data } = await supabase.from("society_settings").select("payment_qr_url").eq("id", 1).maybeSingle();
    const path = (data?.payment_qr_url as string | null) ?? null;
    setQrPath(path);
    if (path) {
      const { data: signed } = await supabase.storage.from("society-docs").createSignedUrl(path, 3600);
      setQrPreview(signed?.signedUrl ?? null);
    } else {
      setQrPreview(null);
    }
  }, []);
  useEffect(() => { loadQr(); }, [loadQr]);

  const uploadQr = async (file: File) => {
    setQrUploading(true);
    const ext = file.name.split(".").pop() || "png";
    const path = `qr/payment-qr.${ext}`;
    const { error: upErr } = await supabase.storage.from("society-docs").upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) { setQrUploading(false); return toast.error(upErr.message); }
    const { error } = await supabase.from("society_settings").update({ payment_qr_url: path }).eq("id", 1);
    setQrUploading(false);
    if (error) return toast.error(error.message);
    toast.success("Payment QR uploaded");
    loadQr();
  };

  const load = useCallback(async () => {
    const [{ data: ps }, { data: ms }] = await Promise.all([
      supabase.from("profiles").select("*").order("flat"),
      supabase.from("maintenance").select("*"),
    ]);
    setProfiles((ps ?? []) as Profile[]);
    setAllRecords((ms ?? []) as MaintenanceRecord[]);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setDraftBase(String(base)); }, [base]);

  const saveBase = async () => {
    const v = Number(draftBase);
    if (!v || v < 0) return toast.error("Enter a valid base amount");
    const { error } = await supabase.rpc("apply_base_amount", { _amount: v });
    if (error) return toast.error(error.message);
    toast.success("Base maintenance applied to all residents for this month");
    reloadBase();
    load();
  };

  const updateRec = async (userId: string, patch: Partial<MaintenanceRecord>) => {
    const existing = allRecords.find((m) => m.user_id === userId && m.month === month);
    if (existing) {
      const { error } = await supabase.from("maintenance").update(patch).eq("id", existing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("maintenance").insert({ user_id: userId, month, amount: base, ...patch });
      if (error) return toast.error(error.message);
    }
    load();
  };

  const deleteResident = async (p: Profile) => {
    if (!confirm(`Permanently remove ${p.full_name ?? p.email} and all their data?`)) return;
    // Delete dependent records first; auth.users removal requires service role (not done from client).
    await supabase.from("maintenance").delete().eq("user_id", p.id);
    await supabase.from("complaints").delete().eq("user_id", p.id);
    await supabase.from("duties").delete().eq("user_id", p.id);
    const { error } = await supabase.from("profiles").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Resident data cleared");
    load();
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 border-0 shadow-[var(--shadow-card)]">
        <h3 className="font-semibold text-lg mb-2">{t("societySettings")}</h3>
        <div className="grid sm:grid-cols-2 gap-2 text-xs text-muted-foreground mb-3">
          <div>📅 {t("active")}: <span className="font-semibold text-foreground">{monthLabel(month, lang)}</span></div>
          <div>⏳ {t("pendingMonth")}: <span className="font-semibold text-foreground">{monthLabel(prevMonth, lang)}</span></div>
          <div>{t("billingDate")}</div>
          <div>{t("dueDate")}</div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label>{t("baseMaintenance")}</Label>
            <Input type="number" className="w-40" value={draftBase} onChange={(e) => setDraftBase(e.target.value)} />
          </div>
          <Button onClick={saveBase}><Save className="size-4 mr-1" /> {t("save")}</Button>
          <p className="text-xs text-muted-foreground ml-auto">
            {t("lateFeeToday")}: <span className="font-semibold text-foreground">₹{penalty}</span> (11–20 ₹100 · 21+ ₹250)
          </p>
        </div>
        <div className="mt-4 pt-4 border-t flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label>Upload Payment QR Code</Label>
            <Input type="file" accept="image/*" className="w-64" disabled={qrUploading}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadQr(f); e.target.value = ""; }} />
          </div>
          {qrPreview && (
            <div className="flex items-center gap-2">
              <img src={qrPreview} alt="Payment QR" className="size-20 rounded border object-contain bg-white" />
              <span className="text-xs text-muted-foreground">Current QR</span>
            </div>
          )}
        </div>
      </Card>

      <Card className="p-6 border-0 shadow-[var(--shadow-card)]">
        <h3 className="font-semibold text-lg mb-4">{t("residentDirectory")} ({profiles.length})</h3>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("flat")}</TableHead><TableHead>{t("name")}</TableHead>
                <TableHead>{t("current")}</TableHead><TableHead>{t("pastDues")}</TableHead><TableHead>{t("penalty")}</TableHead>
                <TableHead>{t("totalOutstanding")}</TableHead>
                <TableHead>{t("status")}</TableHead><TableHead>{t("mode")}</TableHead><TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((p) => {
                const r = allRecords.find((m) => m.user_id === p.id && m.month === month);
                const past = allRecords
                  .filter((m) => m.user_id === p.id && m.month < month && m.status === "Pending")
                  .reduce((s, m) => s + Number(m.amount), 0);
                const amt = Number(r?.amount ?? base);
                const pen = r?.status === "Paid" ? 0 : Number(r?.penalty ?? penalty);
                const curDue = r?.status === "Paid" ? 0 : amt;
                const outstanding = curDue + past + pen;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.flat ?? "—"}</TableCell>
                    <TableCell>
                      <button className="text-primary hover:underline text-left" onClick={() => setSelected(p)}>
                        {p.full_name ?? p.email}
                      </button>
                    </TableCell>
                    <TableCell>₹{amt}</TableCell>
                    <TableCell className="text-muted-foreground">₹{past.toLocaleString()}</TableCell>
                    <TableCell>₹{pen}</TableCell>
                    <TableCell className="font-semibold">₹{outstanding.toLocaleString()}</TableCell>
                    <TableCell>
                      <Select value={r?.status ?? "Pending"} onValueChange={(v) => updateRec(p.id, { status: v as "Paid" | "Pending", paid: v === "Paid" ? amt : 0, penalty: v === "Paid" ? 0 : penalty })}>
                        <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Paid">{t("paid")}</SelectItem>
                          <SelectItem value="Pending">{t("pending")}</SelectItem>
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
                    <TableCell>
                      <Button size="icon" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => deleteResident(p)} aria-label="Delete resident">
                        <X className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      <ResidentDetailDialog profile={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function ResidentDetailDialog({ profile, onClose }: { profile: Profile | null; onClose: () => void }) {
  if (!profile) return null;
  const waNumber = (profile.whatsapp ?? "").replace(/\D/g, "");
  const waUrl = waNumber ? `https://wa.me/${waNumber}?text=${encodeURIComponent(`Hello ${profile.full_name ?? ""}, this is the Harmony Heights admin.`)}` : null;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{profile.full_name ?? profile.email}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <Field label="Flat" value={profile.flat} />
          <Field label="Occupancy" value={profile.occupancy} />
          <Field label="Vehicle" value={profile.vehicle} />
          <Field label="Email" value={profile.email} className="col-span-3" />
          <Field label="WhatsApp" value={profile.whatsapp} className="col-span-3" />
          <Field label="Alternate" value={profile.alt_contact} className="col-span-3" />
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>Close</Button>
          {waUrl && (
            <Button asChild>
              <a href={waUrl} target="_blank" rel="noreferrer">
                <MessageSquare className="size-4 mr-1" /> WhatsApp
              </a>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, className }: { label: string; value: string | null | undefined; className?: string }) {
  return (
    <div className={className}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value ?? "—"}</div>
    </div>
  );
}

function FundsTab() {
  const month = currentMonth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [maint, setMaint] = useState<MaintenanceRecord[]>([]);
  const [form, setForm] = useState({ amount: "", purpose: "", date: todayISO(), category: "Repairs" });

  const load = useCallback(() => {
    supabase.from("expenses").select("*").order("date", { ascending: false }).then(({ data }) => setExpenses((data ?? []) as Expense[]));
    supabase.from("maintenance").select("*").eq("month", month).then(({ data }) => setMaint((data ?? []) as MaintenanceRecord[]));
  }, [month]);
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
    const a = document.createElement("a"); a.href = url; a.download = `expenses-${month}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const byCat = useMemo(() => {
    const m = new Map<string, number>();
    expenses.filter((e) => e.date.startsWith(month)).forEach((e) => m.set(e.category, (m.get(e.category) ?? 0) + Number(e.amount)));
    return [...m.entries()].map(([name, value]) => ({ name, value }));
  }, [expenses, month]);

  const collected = maint.filter((m) => m.status === "Paid").reduce((s, m) => s + Number(m.paid), 0);
  const outstanding = maint.reduce((s, m) => s + (m.status === "Paid" ? 0 : Number(m.amount) + Number(m.past_dues) + Number(m.penalty)), 0);
  const collectionData = [{ name: "This Month", Collected: collected, Outstanding: outstanding }];

  const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7"];

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6 border-0 shadow-[var(--shadow-card)]">
          <h3 className="font-semibold text-lg mb-2">Collected vs Outstanding · {month}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={collectionData}>
              <XAxis dataKey="name" stroke="currentColor" opacity={0.6} />
              <YAxis stroke="currentColor" opacity={0.6} />
              <RTooltip />
              <Legend />
              <Bar dataKey="Collected" fill="#10b981" radius={[6, 6, 0, 0]} />
              <Bar dataKey="Outstanding" fill="#ef4444" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-6 border-0 shadow-[var(--shadow-card)]">
          <h3 className="font-semibold text-lg mb-2">Expense distribution · {month}</h3>
          {byCat.length === 0 ? (
            <p className="text-sm text-muted-foreground">No expenses logged this month.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={byCat} dataKey="value" nameKey="name" outerRadius={80} label>
                  {byCat.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <RTooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

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
    const { data: ps } = ids.length ? await supabase.from("profiles").select("*").in("id", ids) : { data: [] };
    const map = new Map((ps ?? []).map((p) => [p.id, p as unknown as Profile] as const));
    setComplaints(list.map((c) => ({ ...c, profile: map.get(c.user_id) })));
  }, []);
  useEffect(() => { load(); }, [load]);

  const setStatus = async (id: string, status: Complaint["status"]) => {
    const { error } = await supabase.from("complaints").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this archived complaint?")) return;
    const { error } = await supabase.from("complaints").delete().eq("id", id);
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
                <div className="flex items-center gap-2 mt-2">
                  <Select value={c.status} onValueChange={(v) => setStatus(c.id, v as Complaint["status"])}>
                    <SelectTrigger className="h-8 flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Open">Open</SelectItem>
                      <SelectItem value="In-Progress">In-Progress</SelectItem>
                      <SelectItem value="Solved">Solved</SelectItem>
                    </SelectContent>
                  </Select>
                  {col === "Solved" && (
                    <Button size="icon" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => remove(c.id)} aria-label="Remove">
                      <X className="size-4" />
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

const DOC_CATEGORIES = ["AGM Reports", "Maintenance Receipts", "Society Rules"] as const;
type DocCategory = (typeof DOC_CATEGORIES)[number];
interface DocRow { id: string; category: DocCategory; title: string; file_path: string; created_at: string; }

export function DocumentsTab({ isAdmin }: { isAdmin: boolean }) {
  const { user } = useAuth();
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    supabase.from("documents").select("*").order("created_at", { ascending: false }).then(({ data }) => setDocs((data ?? []) as DocRow[]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const upload = async (category: DocCategory, file: File, title: string) => {
    if (!user) return;
    setBusy(true);
    const path = `${category}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
    const up = await supabase.storage.from("society-docs").upload(path, file);
    if (up.error) { setBusy(false); return toast.error(up.error.message); }
    const { error } = await supabase.from("documents").insert({ category, title, file_path: path, uploaded_by: user.id });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Document uploaded");
    load();
  };

  const download = async (doc: DocRow) => {
    const { data, error } = await supabase.storage.from("society-docs").createSignedUrl(doc.file_path, 60);
    if (error || !data) return toast.error(error?.message ?? "Cannot get link");
    window.open(data.signedUrl, "_blank");
  };

  const remove = async (doc: DocRow) => {
    if (!confirm(`Delete "${doc.title}"?`)) return;
    await supabase.storage.from("society-docs").remove([doc.file_path]);
    const { error } = await supabase.from("documents").delete().eq("id", doc.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  return (
    <div className="grid md:grid-cols-3 gap-4">
      {DOC_CATEGORIES.map((cat) => {
        const items = docs.filter((d) => d.category === cat);
        return (
          <Card key={cat} className="p-4 border-0 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">{cat}</h3>
              <Badge variant="outline">{items.length}</Badge>
            </div>
            {isAdmin && <UploadForm onUpload={(file, title) => upload(cat, file, title)} disabled={busy} />}
            <div className="space-y-2 mt-3">
              {items.length === 0 && <p className="text-sm text-muted-foreground">No documents yet.</p>}
              {items.map((d) => (
                <div key={d.id} className="flex items-center gap-2 p-2 rounded-md bg-secondary/40">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{d.title}</div>
                    <div className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleDateString()}</div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => download(d)} aria-label="Download"><Download className="size-4" /></Button>
                  {isAdmin && (
                    <Button size="icon" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => remove(d)} aria-label="Delete">
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function UploadForm({ onUpload, disabled }: { onUpload: (file: File, title: string) => void; disabled: boolean }) {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  return (
    <div className="space-y-2">
      <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <Button
        size="sm"
        className="w-full"
        disabled={disabled || !file || !title.trim()}
        onClick={() => { if (file) { onUpload(file, title.trim()); setTitle(""); setFile(null); } }}
      >
        <Upload className="size-4 mr-1" /> Upload
      </Button>
    </div>
  );
}

function BroadcastTab() {
  const { t } = useT();
  const month = currentMonth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [maint, setMaint] = useState<MaintenanceRecord[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "owners" | "tenants">("all");
  const [message, setMessage] = useState("Hello from Harmony Heights Society admin — ");

  useEffect(() => {
    supabase.from("profiles").select("*").then(({ data }) => setProfiles((data ?? []) as Profile[]));
    supabase.from("maintenance").select("*").eq("month", month).then(({ data }) => setMaint((data ?? []) as MaintenanceRecord[]));
  }, [month]);

  const targets = useMemo(() => {
    return profiles.filter((p) => {
      if (!p.whatsapp) return false;
      if (filter === "owners") return p.occupancy === "Owner";
      if (filter === "tenants") return p.occupancy === "Tenant";
      if (filter === "pending") {
        const r = maint.find((m) => m.user_id === p.id);
        return !r || r.status !== "Paid";
      }
      return true;
    });
  }, [profiles, maint, filter]);

  return (
    <div className="space-y-6">
      <DutyAssignment profiles={profiles} />
      <Card className="p-6 border-0 shadow-[var(--shadow-card)]">
        <h3 className="font-semibold text-lg mb-1">{t("broadcastCenter")}</h3>
      <p className="text-sm text-muted-foreground mb-4">Compose a message, choose an audience, then open per-resident WhatsApp chats.</p>
      <div className="grid sm:grid-cols-3 gap-3 mb-4">
        <div className="sm:col-span-2 space-y-2">
          <Label>{t("message")}</Label>
          <Textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>{t("audience")}</Label>
          <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allResidents")}</SelectItem>
              <SelectItem value="pending">{t("pendingPayers")}</SelectItem>
              <SelectItem value="owners">{t("ownersOnly")}</SelectItem>
              <SelectItem value="tenants">{t("tenantsOnly")}</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{targets.length} recipient(s)</p>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {targets.map((p) => {
          const num = (p.whatsapp ?? "").replace(/\D/g, "");
          const url = `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
          return (
            <a key={p.id} href={url} target="_blank" rel="noreferrer"
              className="flex items-center justify-between p-3 rounded-md bg-secondary/40 hover:bg-secondary transition">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{p.full_name ?? p.email}</div>
                <div className="text-xs text-muted-foreground">{p.flat} · {p.occupancy}</div>
              </div>
              <MessageSquare className="size-4 text-success" />
            </a>
          );
        })}
        {targets.length === 0 && <p className="text-sm text-muted-foreground col-span-full">No matching residents.</p>}
      </div>
      </Card>
    </div>
  );
}

function DutyAssignment({ profiles }: { profiles: Profile[] }) {
  const { t } = useT();
  const [task, setTask] = useState("");
  const [userId, setUserId] = useState<string>("");
  const [duties, setDuties] = useState<(Duty & { profile?: Profile })[]>([]);

  const load = useCallback(async () => {
    const today = todayISO();
    const { data } = await supabase.from("duties").select("*").gte("date", today).order("date", { ascending: true });
    const list = (data ?? []) as Duty[];
    setDuties(list.map((d) => ({ ...d, profile: profiles.find((p) => p.id === d.user_id) })));
  }, [profiles]);
  useEffect(() => { load(); }, [load]);

  const assign = async () => {
    if (!userId) return toast.error("Select a resident");
    if (!task.trim()) return toast.error("Task required");
    const { error } = await supabase.from("duties").insert({ user_id: userId, task: task.trim(), date: todayISO() });
    if (error) return toast.error(error.message);
    toast.success("Duty assigned");
    setTask("");
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("duties").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <Card className="p-6 border-0 shadow-[var(--shadow-card)]">
      <h3 className="font-semibold text-lg mb-1 flex items-center gap-2"><ClipboardList className="size-4" /> {t("assignDuty")}</h3>
      <p className="text-sm text-muted-foreground mb-4">Assign a task to a specific flat. It appears on the resident's dashboard instantly.</p>
      <div className="grid sm:grid-cols-3 gap-3 mb-4">
        <div className="space-y-1">
          <Label>{t("resident")}</Label>
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger><SelectValue placeholder="Select flat" /></SelectTrigger>
            <SelectContent>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.flat ?? "—"} · {p.full_name ?? p.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label>{t("task")}</Label>
          <div className="flex gap-2">
            <Input value={task} onChange={(e) => setTask(e.target.value)} placeholder="e.g. Inspect terrace door" />
            <Button onClick={assign}><Send className="size-4 mr-1" /> {t("assign")}</Button>
          </div>
        </div>
      </div>
      <h4 className="text-sm font-semibold mb-2">{t("assignedDuties")} ({duties.length})</h4>
      {duties.length === 0 ? (
        <p className="text-sm text-muted-foreground">No duties assigned.</p>
      ) : (
        <ul className="divide-y">
          {duties.map((d) => (
            <li key={d.id} className="flex items-center justify-between py-2">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{d.task}</div>
                <div className="text-xs text-muted-foreground">
                  {d.profile?.flat ?? "—"} · {d.profile?.full_name ?? d.profile?.email ?? "—"} · {d.date} {d.done ? "· ✓ done" : ""}
                </div>
              </div>
              <Button size="icon" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => remove(d.id)} aria-label={t("remove")}>
                <X className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}