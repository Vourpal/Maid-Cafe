"use client";
import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { authHeadersNoContent } from "@/lib/api";
import { useUserAuthentication } from "../UserAuthentication";
import LinkModal from "./LinkModal";
import { ExternalLink, Plus, Pencil } from "lucide-react";

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
    { headers: authHeadersNoContent() },
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

  return (
    <div className="group flex items-center gap-4 px-5 py-3.5 border-b border-rose-50 last:border-0 hover:bg-rose-50/50 transition-colors">
      <span className="w-6 shrink-0 text-xs font-mono text-gray-300 group-hover:text-rose-400 transition-colors">
        {String(index + 1).padStart(2, "0")}
      </span>

      <a
        href={link.link_url}
        target="_blank"
        rel="noreferrer"
        className="flex-1 min-w-0 text-sm text-gray-800 hover:text-rose-600 truncate font-medium transition-colors"
      >
        {label}
      </a>

      <div className="flex items-center gap-2 shrink-0">
        {isAdmin && (
          <button
            onClick={() => onEdit(link)}
            className="p-1.5 rounded-lg text-gray-300 hover:text-rose-500 hover:bg-rose-100 transition-colors opacity-0 group-hover:opacity-100"
            title="Edit link"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
        <ExternalLink className="w-3.5 h-3.5 text-gray-300 group-hover:text-rose-400 transition-colors" />
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 border-b border-rose-50">
      <div className="w-6 h-2.5 rounded bg-gray-100 animate-pulse" />
      <div className="flex-1 h-2.5 rounded bg-gray-100 animate-pulse" />
    </div>
  );
}

function EmptyState({ emoji, title, sub }: { emoji: string; title: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
      <span className="text-2xl mb-1">{emoji}</span>
      <p className="text-sm font-medium text-gray-500">{title}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

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
    } catch {
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
    <div className="px-4 py-6 max-w-2xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{categoryLabel}</h1>
          <p className="text-gray-500 text-sm mt-0.5">Staff resource links</p>
        </div>

        {isAdmin && (
          <button
            onClick={() => { setEditingLink(null); setModalOpen(true); }}
            className="inline-flex items-center gap-1.5 bg-rose-500 hover:bg-rose-600 text-white text-sm font-medium px-4 py-2 rounded-full transition"
          >
            <Plus className="w-4 h-4" />
            Add Link
          </button>
        )}
      </div>

      {/* Links card */}
      <div className="bg-white rounded-2xl border border-rose-100 shadow-sm overflow-hidden">
        {/* Column headers */}
        <div className="flex items-center gap-4 px-5 py-2.5 border-b border-rose-100 bg-rose-50/50">
          <span className="w-6 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">#</span>
          <span className="flex-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Name</span>
        </div>

        {authLoading ? (
          <><SkeletonRow /><SkeletonRow /></>
        ) : !user ? (
          <EmptyState emoji="🔒" title="Not logged in" />
        ) : !isAdmin ? (
          <EmptyState emoji="⛔" title="Admins only" sub="You need admin access to view links." />
        ) : loading ? (
          <><SkeletonRow /><SkeletonRow /><SkeletonRow /></>
        ) : links.length === 0 ? (
          <EmptyState emoji="📂" title="No links yet" sub="Add the first link using the button above." />
        ) : (
          links.map((link, i) => (
            <LinkRow
              key={link.id}
              link={link}
              index={i}
              isAdmin={isAdmin}
              onEdit={(l) => { setEditingLink(l); setModalOpen(true); }}
            />
          ))
        )}
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

export default function Links() {
  return (
    <Suspense
      fallback={
        <div className="px-4 py-6 max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl border border-rose-100 overflow-hidden">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        </div>
      }
    >
      <LinksInner />
    </Suspense>
  );
}

function SkeletonRowFallback() {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 border-b border-rose-50">
      <div className="w-6 h-2.5 rounded bg-gray-100 animate-pulse" />
      <div className="flex-1 h-2.5 rounded bg-gray-100 animate-pulse" />
    </div>
  );
}
