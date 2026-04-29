"use client";
import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { authHeadersNoContent } from "@/lib/api";
import { useUserAuthentication } from "../UserAuthentication";
import LinkModal from "./LinkModal";

export const dynamic = "force-dynamic";

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
    },
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

function LinkRow({
  link,
  index,
  isAdmin,
  onEdit,
}: {
  link: Link;
  index: number;
  isAdmin?: boolean;
  onEdit: (link: Link) => void;
}) {
  const label = getDisplayLabel(link.link_url, link.title);
  const rowNum = String(index + 1).padStart(2, "0");

  return (
    <div className="group flex items-center gap-4 px-5 py-3.5 border-b border-gray-200 hover:bg-gray-50 transition-colors duration-150">
      <span className="w-6 shrink-0 text-xs font-mono text-gray-400 group-hover:text-gray-600">
        {rowNum}
      </span>

      <a
        href={link.link_url}
        target="_blank"
        rel="noreferrer"
        className="flex-1 min-w-0 text-sm text-black hover:underline truncate font-medium tracking-wide"
      >
        {label}
      </a>

      {isAdmin && (
        <button
          onClick={() => onEdit(link)}
          className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-100"
        >
          Modify
        </button>
      )}

      <ExternalIcon />
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 border-b border-gray-200">
      <div className="w-6 h-2.5 rounded bg-gray-200 animate-pulse" />
      <div className="flex-1 h-2.5 rounded bg-gray-200 animate-pulse" />
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

// ── Inner component that uses useSearchParams ──────────────────────────────────
function LinksInner() {
  const { user, loading: authLoading } = useUserAuthentication();
  const searchParams = useSearchParams();
  const category = searchParams.get("category") ?? "";

  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<Link | null>(null);

  const isAdmin = user?.admin;

  const loadLinks = useCallback(async () => {
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
  }, [category]);

  useEffect(() => {
    if (authLoading) return;

    if (!user || !isAdmin || !category) {
      setLinks([]);
      setLoading(false);
      return;
    }

    loadLinks();
  }, [category, user, isAdmin, authLoading, loadLinks]);

  const categoryLabel = category
    ? category.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "Resources";

  return (
    <div className="min-h-screen bg-white text-black px-4 py-12 font-mono">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-[10px] tracking-[0.2em] text-gray-400 uppercase">
            Staff Portal · Admin
          </span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        {/* Title + ADD */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <p className="text-[10px] tracking-[0.18em] text-gray-500 uppercase mb-1.5">
              🎀 Resource Hub
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-black">
              {categoryLabel}
            </h1>
          </div>

          {isAdmin && (
            <button
              onClick={() => {
                setEditingLink(null);
                setModalOpen(true);
              }}
              className="text-xs px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-100"
            >
              + Add
            </button>
          )}
        </div>

        {/* Table */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="flex items-center gap-4 px-5 py-2.5 border-b border-gray-200 bg-gray-50">
            <span className="w-6 text-[10px] text-gray-400 uppercase">#</span>
            <span className="flex-1 text-[10px] text-gray-400 uppercase">
              Name
            </span>
            <span className="w-16 text-[10px] text-gray-400 uppercase text-right">
              Actions
            </span>
          </div>

          {authLoading ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : !user ? (
            <Gate emoji="🔒" title="Not logged in" />
          ) : !isAdmin ? (
            <Gate emoji="⛔" title="Admins only" />
          ) : loading ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : links.length === 0 ? (
            <Gate emoji="📂" title="No resources found" />
          ) : (
            links.map((link, i) => (
              <LinkRow
                key={link.id}
                link={link}
                index={i}
                isAdmin={isAdmin}
                onEdit={(l) => {
                  setEditingLink(l);
                  setModalOpen(true);
                }}
              />
            ))
          )}
        </div>
      </div>

      <LinkModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialData={editingLink}
        category={category}
        onSuccess={loadLinks}
      />
    </div>
  );
}

// ── Default export wraps inner component in Suspense ──────────────────────────
export default function Links() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white px-4 py-12 font-mono">
          <div className="mx-auto max-w-2xl">
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center gap-4 px-5 py-3.5 border-b border-gray-200">
                <div className="w-6 h-2.5 rounded bg-gray-200 animate-pulse" />
                <div className="flex-1 h-2.5 rounded bg-gray-200 animate-pulse" />
              </div>
              <div className="flex items-center gap-4 px-5 py-3.5 border-b border-gray-200">
                <div className="w-6 h-2.5 rounded bg-gray-200 animate-pulse" />
                <div className="flex-1 h-2.5 rounded bg-gray-200 animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      }
    >
      <LinksInner />
    </Suspense>
  );
}