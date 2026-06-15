import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "hi" | "mr";

const EN = {
  appName: "Harmony Heights",
  signOut: "Sign out",
  welcomeBack: "Welcome back",
  language: "Language",
  // Admin
  adminDashboard: "Admin Dashboard",
  adminSubtitle: "Manage residents, finances, documents and complaints.",
  tabPayments: "Payments & Users",
  tabFunds: "Fund Ledger",
  tabComplaints: "Complaints",
  tabDocs: "Documents",
  tabBroadcast: "Broadcast & Duties",
  societySettings: "Society settings",
  baseMaintenance: "Base maintenance (₹)",
  save: "Save",
  lateFeeToday: "Late fee today",
  residentDirectory: "Resident directory",
  flat: "Flat",
  name: "Name",
  current: "Current",
  pastDues: "Past Dues",
  penalty: "Penalty",
  totalOutstanding: "Total Outstanding",
  status: "Status",
  mode: "Mode",
  paid: "Paid",
  pending: "Pending",
  active: "Active",
  pendingMonth: "Pending",
  billingDate: "Billing Date: 1st of every month",
  dueDate: "Due Date: 10th of every month",
  assignDuty: "Assign duty",
  task: "Task",
  resident: "Resident",
  assign: "Assign",
  assignedDuties: "Assigned duties",
  remove: "Remove",
  broadcastCenter: "WhatsApp Broadcast Center",
  message: "Message",
  audience: "Audience",
  allResidents: "All residents",
  pendingPayers: "Pending payers",
  ownersOnly: "Owners only",
  tenantsOnly: "Tenants only",
  // Resident
  myDashboard: "My Dashboard",
  home: "Home",
  todaysDuty: "Today's duty",
  markDone: "Mark as Done",
  noDuty: "No duty assigned for today.",
  complaintBox: "Digital complaint box",
  complaintHint: "Your feedback reaches the admin instantly.",
  describeIssue: "Describe the issue...",
  submitComplaint: "Submit complaint",
  pastComplaints: "My past complaints",
  transparency: "Society fund transparency",
  totalBuildingFund: "Total Building Fund Collection",
  expectedThisMonth: "Expected this month",
  cleared: "CLEARED",
  due: "DUE",
};

const EXTRA_EN = {
  flatAndTenants: "Flat & Tenants",
  assignedByAdmin: "Assigned by your society admin.",
  completed: "Completed",
  overdue: "Overdue",
  noComplaints: "You haven't filed any complaints yet.",
  transparencySub: "Where this month's money is going.",
  totalWithdrawn: "Total withdrawn",
  noWithdrawals: "No withdrawals logged yet.",
  perResident: "per resident",
};
const EXTRA_HI: typeof EXTRA_EN = {
  flatAndTenants: "फ्लैट और किरायेदार",
  assignedByAdmin: "आपके सोसाइटी एडमिन द्वारा सौंपा गया।",
  completed: "पूरा हुआ",
  overdue: "देर हो गई",
  noComplaints: "आपने अभी तक कोई शिकायत दर्ज नहीं की है।",
  transparencySub: "इस माह का पैसा कहाँ जा रहा है।",
  totalWithdrawn: "कुल निकाला गया",
  noWithdrawals: "अभी कोई निकासी दर्ज नहीं है।",
  perResident: "प्रति निवासी",
};
const EXTRA_MR: typeof EXTRA_EN = {
  flatAndTenants: "फ्लॅट व भाडेकरू",
  assignedByAdmin: "तुमच्या सोसायटी ऍडमिनने सोपवले.",
  completed: "पूर्ण झाले",
  overdue: "उशीर झाला",
  noComplaints: "तुम्ही अद्याप कोणतीही तक्रार नोंदवली नाही.",
  transparencySub: "या महिन्याचे पैसे कुठे जात आहेत.",
  totalWithdrawn: "एकूण काढले",
  noWithdrawals: "अद्याप काही नोंद नाही.",
  perResident: "प्रती रहिवासी",
};

const HI: typeof EN = {
  appName: "हार्मनी हाइट्स",
  signOut: "साइन आउट",
  welcomeBack: "वापसी पर स्वागत है",
  language: "भाषा",
  adminDashboard: "एडमिन डैशबोर्ड",
  adminSubtitle: "निवासी, वित्त, दस्तावेज़ और शिकायतें प्रबंधित करें।",
  tabPayments: "भुगतान और सदस्य",
  tabFunds: "फंड बही",
  tabComplaints: "शिकायतें",
  tabDocs: "दस्तावेज़",
  tabBroadcast: "ब्रॉडकास्ट और ड्यूटी",
  societySettings: "सोसाइटी सेटिंग्स",
  baseMaintenance: "मूल मेंटेनेंस (₹)",
  save: "सेव करें",
  lateFeeToday: "आज का विलंब शुल्क",
  residentDirectory: "निवासी सूची",
  flat: "फ्लैट",
  name: "नाम",
  current: "वर्तमान",
  pastDues: "पुराना बकाया",
  penalty: "जुर्माना",
  totalOutstanding: "कुल बकाया",
  status: "स्थिति",
  mode: "माध्यम",
  paid: "भुगतान हुआ",
  pending: "बकाया",
  active: "सक्रिय",
  pendingMonth: "बकाया",
  billingDate: "बिलिंग तिथि: हर महीने की 1 तारीख",
  dueDate: "अंतिम तिथि: हर महीने की 10 तारीख",
  assignDuty: "ड्यूटी सौंपें",
  task: "कार्य",
  resident: "निवासी",
  assign: "सौंपें",
  assignedDuties: "सौंपी गई ड्यूटियाँ",
  remove: "हटाएँ",
  broadcastCenter: "व्हाट्सऐप ब्रॉडकास्ट केंद्र",
  message: "संदेश",
  audience: "श्रोता",
  allResidents: "सभी निवासी",
  pendingPayers: "बकाया भुगतान वाले",
  ownersOnly: "केवल मालिक",
  tenantsOnly: "केवल किरायेदार",
  myDashboard: "मेरा डैशबोर्ड",
  home: "होम",
  todaysDuty: "आज का कार्य",
  markDone: "पूरा हुआ",
  noDuty: "आज के लिए कोई कार्य नहीं।",
  complaintBox: "डिजिटल शिकायत बॉक्स",
  complaintHint: "आपकी शिकायत तुरंत एडमिन तक पहुँचती है।",
  describeIssue: "समस्या बताएं...",
  submitComplaint: "शिकायत भेजें",
  pastComplaints: "मेरी पिछली शिकायतें",
  transparency: "सोसाइटी फंड पारदर्शिता",
  totalBuildingFund: "कुल बिल्डिंग फंड संग्रह",
  expectedThisMonth: "इस माह अपेक्षित",
  cleared: "क्लियर",
  due: "बकाया",
};

const MR: typeof EN = {
  appName: "हार्मनी हाइट्स",
  signOut: "साइन आउट",
  welcomeBack: "पुन्हा स्वागत आहे",
  language: "भाषा",
  adminDashboard: "ऍडमिन डॅशबोर्ड",
  adminSubtitle: "रहिवासी, अर्थव्यवस्था, कागदपत्रे आणि तक्रारी व्यवस्थापित करा.",
  tabPayments: "पेमेंट व सदस्य",
  tabFunds: "निधी नोंदवही",
  tabComplaints: "तक्रारी",
  tabDocs: "कागदपत्रे",
  tabBroadcast: "ब्रॉडकास्ट व कर्तव्ये",
  societySettings: "सोसायटी सेटिंग्ज",
  baseMaintenance: "मूळ मेंटेनन्स (₹)",
  save: "जतन करा",
  lateFeeToday: "आजचे विलंब शुल्क",
  residentDirectory: "रहिवासी यादी",
  flat: "फ्लॅट",
  name: "नाव",
  current: "चालू",
  pastDues: "मागील थकबाकी",
  penalty: "दंड",
  totalOutstanding: "एकूण थकबाकी",
  status: "स्थिती",
  mode: "पद्धत",
  paid: "भरले",
  pending: "बाकी",
  active: "सक्रिय",
  pendingMonth: "बाकी",
  billingDate: "बिलिंग तारीख: दर महिन्याची 1 तारीख",
  dueDate: "अंतिम तारीख: दर महिन्याची 10 तारीख",
  assignDuty: "कर्तव्य द्या",
  task: "कार्य",
  resident: "रहिवासी",
  assign: "द्या",
  assignedDuties: "सोपवलेली कर्तव्ये",
  remove: "काढा",
  broadcastCenter: "व्हॉट्सॲप ब्रॉडकास्ट केंद्र",
  message: "संदेश",
  audience: "प्रेक्षक",
  allResidents: "सर्व रहिवासी",
  pendingPayers: "बाकी भरणारे",
  ownersOnly: "फक्त मालक",
  tenantsOnly: "फक्त भाडेकरू",
  myDashboard: "माझा डॅशबोर्ड",
  home: "होम",
  todaysDuty: "आजचे कार्य",
  markDone: "पूर्ण झाले",
  noDuty: "आजसाठी कोणतेही कार्य नाही.",
  complaintBox: "डिजिटल तक्रार पेटी",
  complaintHint: "तुमची तक्रार लगेच ऍडमिनकडे जाते.",
  describeIssue: "समस्या लिहा...",
  submitComplaint: "तक्रार पाठवा",
  pastComplaints: "माझ्या मागील तक्रारी",
  transparency: "सोसायटी निधी पारदर्शकता",
  totalBuildingFund: "एकूण बिल्डिंग निधी संकलन",
  expectedThisMonth: "या महिन्यासाठी अपेक्षित",
  cleared: "पूर्ण",
  due: "बाकी",
};

const STRINGS = {
  en: { ...EN, ...EXTRA_EN },
  hi: { ...HI, ...EXTRA_HI },
  mr: { ...MR, ...EXTRA_MR },
};
export type TKey = keyof typeof EN | keyof typeof EXTRA_EN;

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: TKey) => string }>({
  lang: "en",
  setLang: () => {},
  t: (k) => (EN as Record<string, string>)[k as string] ?? String(k),
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem("lang")) as Lang | null;
    if (saved === "en" || saved === "hi" || saved === "mr") setLangState(saved);
  }, []);
  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem("lang", l);
  };
  const t = (k: TKey): string => {
    const dict = STRINGS[lang] as Record<string, string>;
    const fall = STRINGS.en as Record<string, string>;
    return dict[k as string] ?? fall[k as string] ?? String(k);
  };
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export function useT() {
  return useContext(Ctx);
}

export function monthLabel(month: string, lang: Lang) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, (m ?? 1) - 1, 1);
  const loc = lang === "hi" ? "hi-IN" : lang === "mr" ? "mr-IN" : "en-US";
  return d.toLocaleDateString(loc, { month: "long", year: "numeric" });
}