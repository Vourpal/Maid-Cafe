"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BriefcaseBusiness,
  ClipboardList,
  LayoutDashboard,
  Megaphone,
  Music,
  ScrollText,
  ShieldCheck,
  Shirt,
  Sparkles,
  Ticket,
  TrendingUp,
  UtensilsCrossed,
  Users,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserAuthentication } from "../UserAuthentication";
import AnnouncementsTab from "./AnnouncementsTab";
import AuditLogTab from "./AuditLogTab";
import CostumesTab from "./CostumesTab";
import InvitesTab from "./InvitesTab";
import MenuTab from "./MenuTab";
import OverviewTab from "./OverviewTab";
import ProficiencyTab from "./ProficiencyTab";
import ReportsTab from "./ReportsTab";
import RoutinesTab from "./RoutinesTab";
import ShiftsTab from "./ShiftsTab";
import StaffTab from "./StaffTab";
import TasksTab from "./TasksTab";

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "staff", label: "Staff", icon: Users },
  { id: "tasks", label: "Tasks", icon: ClipboardList },
  { id: "shifts", label: "Shifts", icon: BriefcaseBusiness },
  { id: "reports", label: "Reports", icon: TrendingUp },
  { id: "routines", label: "Routines", icon: Music },
  { id: "proficiency", label: "Proficiency", icon: Sparkles },
  { id: "costumes", label: "Costumes", icon: Shirt },
  { id: "menu", label: "Menu", icon: UtensilsCrossed },
  { id: "announcements", label: "Announcements", icon: Megaphone },
  { id: "invites", label: "Invites", icon: Ticket },
  { id: "audit", label: "Audit Log", icon: ScrollText },
] as const;

type TabId = (typeof TABS)[number]["id"];

function AdminPanel() {
  const { user, loading } = useUserAuthentication();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Tab lives in the URL so views are linkable and survive a refresh.
  const tabParam = searchParams.get("tab") as TabId | null;
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  useEffect(() => {
    if (tabParam && TABS.some((t) => t.id === tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  function selectTab(id: TabId) {
    setActiveTab(id);
    router.replace(`/admin?tab=${id}`, { scroll: false });
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-10 space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-10 w-full max-w-2xl" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  // Cosmetic guard only — every endpoint behind these tabs is enforced
  // server-side by require_admin.
  if (!user?.admin) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <p className="text-5xl mb-4">🔒</p>
        <p className="text-gray-500">You do not have access to this page.</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-rose-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Admin Panel</h1>
          <p className="text-gray-500 text-sm">
            Staff, shifts, routines, inventory, menus and activity history
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => selectTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === id
                ? "bg-white text-rose-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && <OverviewTab />}
      {activeTab === "staff" && <StaffTab currentUserId={user.id} />}
      {activeTab === "tasks" && <TasksTab />}
      {activeTab === "shifts" && <ShiftsTab />}
      {activeTab === "reports" && <ReportsTab />}
      {activeTab === "routines" && <RoutinesTab />}
      {activeTab === "proficiency" && <ProficiencyTab />}
      {activeTab === "costumes" && <CostumesTab />}
      {activeTab === "menu" && <MenuTab />}
      {activeTab === "announcements" && <AnnouncementsTab />}
      {activeTab === "invites" && <InvitesTab />}
      {activeTab === "audit" && <AuditLogTab />}
    </div>
  );
}

export default function Admin() {
  // useSearchParams requires a Suspense boundary in the App Router.
  return (
    <Suspense
      fallback={
        <div className="max-w-6xl mx-auto px-4 py-10 space-y-4">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-48 w-full" />
        </div>
      }
    >
      <AdminPanel />
    </Suspense>
  );
}
