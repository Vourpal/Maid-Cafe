/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { useUserAuthentication } from "../UserAuthentication";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authHeaders } from "@/lib/api";

const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

interface StaffMember {
  id: number;
  first_name: string;
  last_name: string;
  type: string | null;
  availability: Record<
    string,
    { enabled: boolean; start?: string; end?: string }
  >;
}

export default function Admin() {
  const { user, loading } = useUserAuthentication();

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);

  useEffect(() => {
    // Only fetch if user is confirmed to be an admin
    if (!user || !user.admin) {
      setStaffLoading(false);
      return;
    }

    async function fetchStaff() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users`, {
          headers: authHeaders(),
        });

        if (!res.ok) return;

        const json = await res.json();
        console.log(json, "fetch data");
        // success_response wraps results under { data: [...] }
        const users: StaffMember[] = Array.isArray(json) ? json : json.data;
        setStaff(users);
      } catch (err) {
        console.error(err);
      } finally {
        setStaffLoading(false);
      }
    }

    fetchStaff();
  }, [user]);

  useEffect(() => {
    console.log(staff, "UPDATED staff data");
  }, [staff]);

  // ── Auth loading ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  // ── Not logged in or not admin ────────────────────────────
  if (!user || !user.admin) {
    return (
      <div className="max-w-lg mx-auto px-4 py-10 text-center text-gray-500">
        You do not have access to this page.
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      {/* HEADER CARD */}
      <Card className="border-rose-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-rose-500 text-2xl">
            🛡️ Admin Panel
          </CardTitle>
        </CardHeader>
      </Card>

      {/* STAFF CARD */}
      <Card className="border-rose-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-rose-500 text-2xl">
            👥 Staff Members
          </CardTitle>
        </CardHeader>

        <CardContent>
          {staffLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : staff.length === 0 ? (
            <p className="text-gray-400 text-sm">No staff members found.</p>
          ) : (
            <div className="space-y-4">
              {staff.map((member) => (
                <div
                  key={member.id}
                  className="border border-rose-100 rounded-lg p-4 space-y-3"
                >
                  {/* Name + Type */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-800 font-semibold text-lg">
                        {member.first_name} {member.last_name}
                      </p>
                      <p className="text-xs text-gray-400 uppercase tracking-wide mt-0.5">
                        {member.type ?? "Unknown"}
                      </p>
                    </div>

                    <span
                      className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize
                        ${
                          member.type === "maid"
                            ? "bg-rose-100 text-rose-600"
                            : member.type === "butler"
                              ? "bg-stone-100 text-stone-600"
                              : "bg-gray-100 text-gray-500"
                        }`}
                    >
                      {member.type ?? "—"}
                    </span>
                  </div>

                  {/* Availability */}
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">
                      Availability
                    </p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-1">
                      {days.map((day) => {
                        const d = member.availability?.[day];
                        const enabled = d?.enabled;

                        return (
                          <div
                            key={day}
                            className={`rounded-md px-2 py-1.5 text-center text-xs
                              ${
                                enabled
                                  ? "bg-rose-50 border border-rose-200 text-rose-700"
                                  : "bg-gray-50 border border-gray-100 text-gray-400"
                              }`}
                          >
                            <p className="font-semibold uppercase">{day}</p>
                            {enabled ? (
                              <p className="mt-0.5 leading-tight">
                                {d?.start}
                                <br />
                                {d?.end}
                              </p>
                            ) : (
                              <p className="mt-0.5 text-gray-300">—</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
