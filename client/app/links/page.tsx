"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { authHeadersNoContent } from "@/lib/api";
import { useUserAuthentication } from "../UserAuthentication";

type Link = {
  id: number;
  link_url: string;
  title: string;
};

async function fetchLinks(category: string): Promise<Link[]> {
  if (!category) return [];

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/links?category=${category}`,
    {
      headers: authHeadersNoContent(),
    }
  );

  if (!res.ok) throw new Error("Failed to fetch links");

  const json = await res.json();
  return json.data ?? [];
}

function getDisplayLabel(url: string, title?: string): string {
  if (title && title.trim().length > 0) return title;

  try {
    const { hostname, pathname } = new URL(url);
    const host = hostname.replace(/^www\./, "");
    const pathPart = pathname.replace(/\/$/, "").split("/").pop();

    if (pathPart && pathPart.length > 1 && pathPart.length < 40) {
      return pathPart.replace(/[-_]/g, " ");
    }

    return host;
  } catch {
    return url;
  }
}

function getResourceType(url: string): { label: string; color: string } {
  const lower = url.toLowerCase();

  if (lower.includes("docs.google") || lower.includes("drive.google"))
    return { label: "Google Docs", color: "text-blue-600" };
  if (lower.includes("notion")) return { label: "Notion", color: "text-gray-700" };
  if (lower.includes("figma")) return { label: "Figma", color: "text-purple-600" };
  if (lower.includes("github")) return { label: "GitHub", color: "text-gray-700" };
  if (lower.includes("slack")) return { label: "Slack", color: "text-rose-600" };
  if (
    lower.includes("trello") ||
    lower.includes("asana") ||
    lower.includes("linear")
  )
    return { label: "Project Mgmt", color: "text-teal-600" };
  if (lower.includes("airtable")) return { label: "Airtable", color: "text-orange-600" };
  if (lower.includes("loom") || lower.includes("youtube"))
    return { label: "Video", color: "text-rose-600" };
  if (lower.includes("pdf")) return { label: "PDF", color: "text-rose-500" };

  return { label: "Resource", color: "text-gray-500" };
}

function ExternalIcon() {
  return (
    <svg
      className="h-3.5 w-3.5 opacity-40 group-hover:opacity-70 transition-opacity"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
      />
    </svg>
  );
}

function LinkRow({ link, index }: { link: Link; index: number }) {
  const label = getDisplayLabel(link.link_url, link.title);
  const { label: typeLabel, color: typeColor } = getResourceType(link.link_url);
  const rowNum = String(index + 1).padStart(2, "0");

  return (
    <a
      href={link.link_url}
      target="_blank"
      rel="noreferrer"
      className="group flex items-center gap-4 px-5 py-3.5 border-b border-gray-200 hover:bg-gray-50 transition-colors duration-150"
    >
      <span className="w-6 shrink-0 text-xs font-mono text-gray-400 group-hover:text-gray-600 transition-colors">
        {rowNum}
      </span>

      {/* TITLE is now primary clickable label */}
      <span className="flex-1 min-w-0 text-sm text-black group-hover:text-black transition-colors capitalize truncate font-medium tracking-wide">
        {label}
      </span>

      <span
        className={`shrink-0 text-xs font-mono ${typeColor} opacity-60 group-hover:opacity-100 transition-opacity hidden sm:block`}
      >
        {typeLabel}
      </span>

      <ExternalIcon />
    </a>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 border-b border-gray-200">
      <div className="w-6 h-2.5 rounded bg-gray-200 animate-pulse" />
      <div className="flex-1 h-2.5 rounded bg-gray-200 animate-pulse" />
      <div className="w-20 h-2 rounded bg-gray-200 animate-pulse hidden sm:block" />
    </div>
  );
}

function Gate({
  emoji,
  title,
  sub,
}: {
  emoji: string;
  title: string;
  sub?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-2">
      <span className="text-2xl mb-1">{emoji}</span>
      <p className="text-sm font-medium text-gray-600">{title}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

export default function Links() {
  const { user, loading: authLoading } = useUserAuthentication();
  const searchParams = useSearchParams();
  const category = searchParams.get("category") ?? "";

  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.admin;

  useEffect(() => {
    if (authLoading) return;

    if (!user || !isAdmin || !category) {
      setLinks([]);
      setLoading(false);
      return;
    }

    async function load() {
      try {
        setLoading(true);
        const data = await fetchLinks(category);
        setLinks(data);
      } catch (err) {
        console.error(err);
        setLinks([]);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [category, user, isAdmin, authLoading]);

  const categoryLabel = category
    ? category.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "Resources";

  const isLoading = authLoading || loading;

  return (
    <div className="min-h-screen bg-white text-black px-4 py-12 font-mono">
      <div className="mx-auto max-w-2xl">

        <div className="flex items-center gap-3 mb-8">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-[10px] tracking-[0.2em] text-gray-400 uppercase">
            Staff Portal · Admin
          </span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        <div className="flex items-end justify-between mb-6">
          <div>
            <p className="text-[10px] tracking-[0.18em] text-gray-500 uppercase mb-1.5">
              🎀 Resource Hub
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-black">
              {categoryLabel}
            </h1>
          </div>

          {!isLoading && links.length > 0 && (
            <span className="text-xs text-gray-400 font-mono pb-1">
              {links.length} {links.length === 1 ? "entry" : "entries"}
            </span>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">

          <div className="flex items-center gap-4 px-5 py-2.5 border-b border-gray-200 bg-gray-50">
            <span className="w-6 text-[10px] tracking-widest text-gray-400 uppercase">
              #
            </span>
            <span className="flex-1 text-[10px] tracking-widest text-gray-400 uppercase">
              Name
            </span>
            <span className="text-[10px] tracking-widest text-gray-400 uppercase hidden sm:block">
              Type
            </span>
            <span className="w-3.5" />
          </div>

          {authLoading ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : !user ? (
            <Gate emoji="🔒" title="Not logged in" sub="Please sign in to continue." />
          ) : !isAdmin ? (
            <Gate emoji="⛔" title="Access restricted" sub="Admins only." />
          ) : loading ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : links.length === 0 ? (
            <Gate emoji="📂" title="No resources found" />
          ) : (
            links.map((link, i) => (
              <LinkRow key={link.id} link={link} index={i} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}