// Admin identity is enforced server-side (DB trigger + user_roles table + RLS).
// Do not hardcode the admin email in the client bundle.
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

/**
 * Late-fee schedule: ₹0 before the 11th, ₹100 on 11–20, ₹250 after the 20th.
 */
export function penaltyForToday(d: Date = new Date()) {
  const day = d.getDate();
  if (day <= 10) return 0;
  if (day <= 20) return 100;
  return 250;
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
  past_dues: number;
  penalty: number;
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
