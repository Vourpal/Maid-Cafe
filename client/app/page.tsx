"use client";

import Link from "next/link";
import { useUserAuthentication } from "./UserAuthentication";
import { Calendar, Dumbbell, Users, ArrowRight, Sparkles } from "lucide-react";

export default function Home() {
  const { user, loading } = useUserAuthentication();

  return (
    <div className="px-4 py-8 max-w-5xl mx-auto space-y-8">
      {/* Hero banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-400 via-rose-500 to-rose-600 p-8 text-white shadow-lg">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2 text-rose-100 text-sm font-medium">
            <Sparkles className="w-4 h-4" />
            <span>Welcome to the Staff Portal</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">
            🎀 Maid Café
          </h1>
          <p className="text-rose-100 text-lg max-w-xl">
            {user
              ? `Good to see you, ${user.first_name}! Ready for your next shift?`
              : "Your cozy hub for events, practices, and staff coordination."}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/events"
              className="inline-flex items-center gap-2 bg-white text-rose-600 font-semibold px-5 py-2.5 rounded-full hover:bg-rose-50 transition text-sm shadow"
            >
              Browse Events
              <ArrowRight className="w-4 h-4" />
            </Link>
            {!user && !loading && (
              <Link
                href="/login"
                className="inline-flex items-center gap-2 bg-rose-700 text-white font-semibold px-5 py-2.5 rounded-full hover:bg-rose-800 transition text-sm"
              >
                Staff Login
              </Link>
            )}
            {user && (
              <Link
                href="/practice"
                className="inline-flex items-center gap-2 bg-rose-700 text-white font-semibold px-5 py-2.5 rounded-full hover:bg-rose-800 transition text-sm"
              >
                View Schedule
              </Link>
            )}
          </div>
        </div>

        {/* Decorative circles */}
        <div className="absolute -right-8 -top-8 w-48 h-48 rounded-full bg-white/10" />
        <div className="absolute -right-4 -bottom-12 w-64 h-64 rounded-full bg-white/5" />
      </div>

      {/* Quick action cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <QuickCard
          href="/events"
          icon={<Calendar className="w-5 h-5 text-rose-500" />}
          title="Events"
          description="Browse and sign up for upcoming café events."
          color="rose"
        />
        {user && (
          <QuickCard
            href="/practice"
            icon={<Dumbbell className="w-5 h-5 text-purple-500" />}
            title="Practice"
            description="View the practice schedule and session details."
            color="purple"
          />
        )}
        {user?.admin && (
          <QuickCard
            href="/admin"
            icon={<Users className="w-5 h-5 text-blue-500" />}
            title="Admin"
            description="Manage staff, invite codes, and availability."
            color="blue"
          />
        )}
      </div>

      {/* Info section for guests */}
      {!user && !loading && (
        <div className="rounded-2xl border border-rose-100 bg-white p-6 text-center shadow-sm">
          <p className="text-3xl mb-3">🎀</p>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Staff Portal
          </h2>
          <p className="text-gray-500 text-sm max-w-sm mx-auto mb-4">
            This portal is for Maid Café staff members. Log in to access
            practice schedules, resources, and more.
          </p>
          <div className="flex justify-center gap-3">
            <Link
              href="/login"
              className="bg-rose-500 text-white px-5 py-2 rounded-full text-sm font-medium hover:bg-rose-600 transition"
            >
              Login
            </Link>
            <Link
              href="/login/newUser"
              className="border border-rose-300 text-rose-500 px-5 py-2 rounded-full text-sm font-medium hover:bg-rose-50 transition"
            >
              Register
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function QuickCard({
  href,
  icon,
  title,
  description,
  color,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  color: "rose" | "purple" | "blue";
}) {
  const borderMap = {
    rose: "border-rose-100 hover:border-rose-300",
    purple: "border-purple-100 hover:border-purple-300",
    blue: "border-blue-100 hover:border-blue-300",
  };
  const iconBg = {
    rose: "bg-rose-50",
    purple: "bg-purple-50",
    blue: "bg-blue-50",
  };

  return (
    <Link
      href={href}
      className={`group block rounded-xl border bg-white p-5 shadow-sm transition-all hover:shadow-md ${borderMap[color]}`}
    >
      <div
        className={`inline-flex items-center justify-center w-10 h-10 rounded-lg mb-3 ${iconBg[color]}`}
      >
        {icon}
      </div>
      <h3 className="font-semibold text-gray-800 mb-1 group-hover:text-rose-600 transition-colors">
        {title}
      </h3>
      <p className="text-sm text-gray-500">{description}</p>
    </Link>
  );
}
