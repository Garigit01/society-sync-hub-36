import { useSyncExternalStore } from "react";

export const ADMIN_EMAIL = "admin@society.com";

export type Role = "admin" | "resident";

export interface AuthUser {
  email: string;
  name: string;
  picture?: string;
  role: Role;
}

export interface Profile {
  email: string;
  fullName: string;
  occupancy: "Owner" | "Tenant";
  whatsapp: string;
  flat: string;
  altContact: string;
  vehicle?: string;
  createdAt: number;
}

export interface MaintenanceRecord {
  id: string;
  email: string;
  month: string; // YYYY-MM
  amount: number;
  paid: number;
  status: "Paid" | "Pending";
  mode: "Online" | "Cash" | "—";
}

export interface Expense {
  id: string;
  amount: number;
  purpose: string;
  date: string;
  category: string;
}

export interface Complaint {
  id: string;
  email: string;
  description: string;
  createdAt: number;
  status: "Open" | "In-Progress" | "Solved";
}

export interface Duty {
  id: string;
  email: string;
  task: string;
  date: string; // YYYY-MM-DD
  done: boolean;
  doneAt?: number;
}

export interface DBState {
  auth: AuthUser | null;
  profiles: Record<string, Profile>;
  baselineAmount: number;
  maintenance: MaintenanceRecord[];
  expenses: Expense[];
  contingency: number;
  complaints: Complaint[];
  duties: Duty[];
}

const KEY = "society_db_v1";

const initial: DBState = {
  auth: null,
  profiles: {
    "priya@example.com": {
      email: "priya@example.com",
      fullName: "Priya Sharma",
      occupancy: "Owner",
      whatsapp: "+919876543210",
      flat: "A-402",
      altContact: "+919812345678",
      vehicle: "MH12AB1234",
      createdAt: Date.now() - 86400000 * 30,
    },
    "rahul@example.com": {
      email: "rahul@example.com",
      fullName: "Rahul Verma",
      occupancy: "Tenant",
      whatsapp: "+919812345001",
      flat: "B-201",
      altContact: "+919812345002",
      createdAt: Date.now() - 86400000 * 20,
    },
  },
  baselineAmount: 2500,
  maintenance: [],
  expenses: [
    { id: "e1", amount: 8000, purpose: "Lift annual maintenance", date: todayISO(), category: "Lift" },
    { id: "e2", amount: 12000, purpose: "Security guard salary", date: todayISO(), category: "Security" },
  ],
  contingency: 15000,
  complaints: [
    {
      id: "c1",
      email: "priya@example.com",
      description: "Water leakage from common terrace.",
      createdAt: Date.now() - 86400000 * 2,
      status: "In-Progress",
    },
  ],
  duties: [],
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

let state: DBState = load();
const listeners = new Set<() => void>();

function load(): DBState {
  if (typeof window === "undefined") return initial;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seed(initial);
    return { ...initial, ...JSON.parse(raw) };
  } catch {
    return seed(initial);
  }
}

function seed(s: DBState) {
  if (typeof window !== "undefined") {
    localStorage.setItem(KEY, JSON.stringify(s));
  }
  return s;
}

function persist() {
  if (typeof window !== "undefined") {
    localStorage.setItem(KEY, JSON.stringify(state));
  }
  listeners.forEach((l) => l());
}

export const db = {
  get: () => state,
  set: (updater: (s: DBState) => DBState) => {
    state = updater(state);
    persist();
  },
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};

export function useDB<T>(selector: (s: DBState) => T): T {
  return useSyncExternalStore(
    (l) => db.subscribe(l),
    () => selector(db.get()),
    () => selector(initial),
  );
}

// ----- helpers -----

export function ensureMaintenanceForMonth(month: string) {
  const profiles = Object.values(state.profiles);
  const existingKeys = new Set(state.maintenance.filter((m) => m.month === month).map((m) => m.email));
  const additions: MaintenanceRecord[] = [];
  for (const p of profiles) {
    if (!existingKeys.has(p.email)) {
      additions.push({
        id: `${month}-${p.email}`,
        email: p.email,
        month,
        amount: state.baselineAmount,
        paid: 0,
        status: "Pending",
        mode: "—",
      });
    }
  }
  if (additions.length) {
    db.set((s) => ({ ...s, maintenance: [...s.maintenance, ...additions] }));
  }
}

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}
