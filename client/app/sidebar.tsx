"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useUserAuthentication } from "./UserAuthentication";
import { authHeadersNoContent } from "@/lib/api";
import {
  Home,
  Calendar,
  Dumbbell,
  Link2,
  ShieldCheck,
  User,
  LogOut,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type NavItem = {
  label: string;
  href?: string;
  icon: React.ReactNode;
  authRequired?: boolean;
  adminOnly?: boolean;
  children?: { label: string; href: string }[];
};

const navItems: NavItem[] = [
  {
    label: "Home",
    href: "/",
    icon: <Home className="w-4 h-4" />,
  },
  {
    label: "Events",
    href: "/events",
    icon: <Calendar className="w-4 h-4" />,
  },
  {
    label: "Practice",
    href: "/practice",
    icon: <Dumbbell className="w-4 h-4" />,
    authRequired: true,
  },
  {
    label: "Links",
    icon: <Link2 className="w-4 h-4" />,
    authRequired: true,
    children: [
      { label: "Excel Sheets", href: "/links?category=excel" },
      { label: "Power Points", href: "/links?category=powerpoint" },
      { label: "Miscellaneous", href: "/links?category=misc" },
    ],
  },
  {
    label: "Admin",
    href: "/admin",
    icon: <ShieldCheck className="w-4 h-4" />,
    adminOnly: true,
  },
  {
    label: "Account",
    href: "/account",
    icon: <User className="w-4 h-4" />,
    authRequired: true,
  },
];

function NavLink({
  item,
  isActive,
  onClick,
}: {
  item: NavItem;
  isActive: boolean;
  onClick?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  if (item.children) {
    const anyChildActive = item.children.some((c) =>
      pathname.startsWith(c.href.split("?")[0])
    );
    return (
      <div>
        <button
          onClick={() => setOpen((p) => !p)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
            ${anyChildActive
              ? "bg-rose-500 text-white"
              : "text-rose-800 hover:bg-rose-200 hover:text-rose-900"
            }`}
        >
          {item.icon}
          <span className="flex-1 text-left">{item.label}</span>
          {open ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
        </button>

        {open && (
          <div className="ml-7 mt-1 space-y-0.5">
            {item.children.map((child) => {
              const childPath = child.href.split("?")[0];
              const childActive = pathname === childPath;
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  onClick={onClick}
                  className={`block px-3 py-2 rounded-lg text-sm transition-colors
                    ${childActive
                      ? "bg-rose-200 text-rose-700 font-medium"
                      : "text-rose-700 hover:bg-rose-100"
                    }`}
                >
                  {child.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href!}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
        ${isActive
          ? "bg-rose-500 text-white shadow-sm"
          : "text-rose-800 hover:bg-rose-200 hover:text-rose-900"
        }`}
    >
      {item.icon}
      {item.label}
    </Link>
  );
}

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, setUser, loading } = useUserAuthentication();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/logout`, {
      method: "POST",
      headers: authHeadersNoContent(),
    });
    localStorage.removeItem("token");
    setUser(null);
    router.push("/login");
    setMobileOpen(false);
  }

  const visibleItems = navItems.filter((item) => {
    if (item.adminOnly) return user?.admin;
    if (item.authRequired) return !!user;
    return true;
  });

  const initials = user
    ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
    : "";

  const SidebarContent = ({ onLinkClick }: { onLinkClick?: () => void }) => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-rose-200">
        <Link
          href="/"
          onClick={onLinkClick}
          className="flex items-center gap-2 text-rose-600 font-bold text-xl tracking-wide"
        >
          <span className="text-2xl">🎀</span>
          <span>Maid Café</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {loading ? (
          <div className="space-y-2 px-1">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : (
          visibleItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : !!item.href && pathname.startsWith(item.href);
            return (
              <NavLink
                key={item.label}
                item={item}
                isActive={isActive}
                onClick={onLinkClick}
              />
            );
          })
        )}

        {!loading && !user && (
          <Link
            href="/login"
            onClick={onLinkClick}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
              ${pathname === "/login"
                ? "bg-rose-500 text-white"
                : "text-rose-800 hover:bg-rose-200"
              }`}
          >
            <User className="w-4 h-4" />
            Login
          </Link>
        )}
      </nav>

      {/* User section */}
      {!loading && user && (
        <div className="px-3 py-4 border-t border-rose-200">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-8 h-8 rounded-full bg-rose-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-rose-900 truncate">
                {user.first_name} {user.last_name}
              </p>
              <p className="text-xs text-rose-500 capitalize truncate">
                {user.type ?? (user.admin ? "Admin" : "Member")}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-rose-700 hover:bg-rose-200 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-64 bg-rose-50 border-r border-rose-200 flex-col z-40">
        <SidebarContent />
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-rose-50 border-b border-rose-200 px-4 py-3 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 text-rose-600 font-bold text-lg"
        >
          <span>🎀</span>
          <span>Maid Café</span>
        </Link>
        <button
          onClick={() => setMobileOpen((p) => !p)}
          className="p-2 rounded-lg text-rose-600 hover:bg-rose-100 transition-colors"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/30 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`md:hidden fixed top-0 left-0 h-full w-72 bg-rose-50 border-r border-rose-200 z-50 transform transition-transform duration-300
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <SidebarContent onLinkClick={() => setMobileOpen(false)} />
      </aside>
    </>
  );
}
