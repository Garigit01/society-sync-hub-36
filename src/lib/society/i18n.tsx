import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "hi";

const STRINGS = {
  en: {
    appName: "Harmony Heights",
    signOut: "Sign out",
    signInGoogle: "Continue with Google",
    signInAdmin: "Sign in as Admin",
    signInResident: "Sign in as Resident",
    welcomeBack: "Welcome back",
    email: "Email",
    displayName: "Display name",
    demoShortcuts: "demo shortcuts",
    adminDashboard: "Admin Dashboard",
    adminSubtitle: "Manage residents, finances and complaints across the society.",
    tabPayments: "Payments & Users",
    tabFunds: "Fund Ledger",
    tabComplaints: "Complaints",
    welcome: "Welcome",
    maintenance: "Maintenance",
    paid: "PAID",
    pending: "PENDING",
    todaysDuty: "Today's duty",
    markDone: "Mark as Done",
    overdue: "Overdue Alert — please complete now",
    complaintBox: "Digital complaint box",
    complaintHint: "Your feedback reaches the admin instantly.",
    describeIssue: "Describe the issue...",
    submitComplaint: "Submit complaint",
    pastComplaints: "My past complaints",
    transparency: "Society fund transparency",
    language: "Language",
  },
  hi: {
    appName: "हार्मनी हाइट्स",
    signOut: "साइन आउट",
    signInGoogle: "Google से जारी रखें",
    signInAdmin: "एडमिन के रूप में साइन इन",
    signInResident: "रेज़िडेंट के रूप में साइन इन",
    welcomeBack: "वापसी पर स्वागत है",
    email: "ईमेल",
    displayName: "नाम",
    demoShortcuts: "डेमो शॉर्टकट्स",
    adminDashboard: "एडमिन डैशबोर्ड",
    adminSubtitle: "सोसाइटी के निवासी, फाइनेंस और शिकायतें प्रबंधित करें।",
    tabPayments: "भुगतान और सदस्य",
    tabFunds: "फंड बही",
    tabComplaints: "शिकायतें",
    welcome: "स्वागत है",
    maintenance: "मेंटेनेंस",
    paid: "भुगतान हो गया",
    pending: "बकाया",
    todaysDuty: "आज का कार्य",
    markDone: "पूरा करें",
    overdue: "विलंब सूचना — कृपया अभी पूरा करें",
    complaintBox: "डिजिटल शिकायत बॉक्स",
    complaintHint: "आपकी शिकायत तुरंत एडमिन तक पहुँचती है।",
    describeIssue: "समस्या बताएं...",
    submitComplaint: "शिकायत भेजें",
    pastComplaints: "मेरी पिछली शिकायतें",
    transparency: "सोसाइटी फंड पारदर्शिता",
    language: "भाषा",
  },
} as const;

type Key = keyof (typeof STRINGS)["en"];

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: Key) => string }>({
  lang: "en",
  setLang: () => {},
  t: (k) => STRINGS.en[k],
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem("lang")) as Lang | null;
    if (saved === "en" || saved === "hi") setLangState(saved);
  }, []);
  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem("lang", l);
  };
  const t = (k: Key) => STRINGS[lang][k] ?? STRINGS.en[k];
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export function useT() {
  return useContext(Ctx);
}