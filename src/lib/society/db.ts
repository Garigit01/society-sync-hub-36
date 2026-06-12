export const ADMIN_EMAIL = "garimaakrai@gmail.com";
export const BASELINE_AMOUNT = 2500;
export const DEFAULT_DUTIES = [
  "Check common-area lights are off by 11 PM",
  "Inspect terrace door is locked",
  "Verify waste segregation bins",
  "Walk-through of parking area",
];

export function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export type Role = "admin" | "resident";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  occupancy: "Owner" | "Tenant" | null;
  whatsapp: string | null;
  flat: string | null;
  alt_contact: string | null;
  vehicle: string | null;
  created_at: string;
}

export interface MaintenanceRecord {
  id: string;
  user_id: string;
  month: string;
  amount: number;
  paid: number;
  status: "Paid" | "Pending";
  mode: string;
}

export interface Expense {
  id: string;
  amount: number;
  purpose: string;
  category: string;
  date: string;
  created_at: string;
}

export interface Complaint {
  id: string;
  user_id: string;
  description: string;
  status: "Open" | "In-Progress" | "Solved";
  created_at: string;
}

export interface Duty {
  id: string;
  user_id: string;
  task: string;
  date: string;
  done: boolean;
  done_at: string | null;
}
