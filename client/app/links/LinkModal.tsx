"use client";

import { useState, useEffect } from "react";
import { authHeadersNoContent } from "@/lib/api";

type Link = {
  id?: number;
  title: string;
  link_url: string;
};

export default function LinkModal({
  open,
  onClose,
  initialData,
  category,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  initialData?: Link | null;
  category: string;
  onSuccess: () => void;
}) {
  const isEdit = !!initialData;

  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setUrl(initialData.link_url);
    } else {
      setTitle("");
      setUrl("");
    }
  }, [initialData]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      setLoading(true);

      const endpoint = isEdit
        ? `${process.env.NEXT_PUBLIC_API_URL}/links/${initialData?.id}`
        : `${process.env.NEXT_PUBLIC_API_URL}/links`;

      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...authHeadersNoContent(),
        },
        body: JSON.stringify({
          title,
          link_url: url,
          category,
        }),
      });

      if (!res.ok) throw new Error("Failed request");

      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-xl shadow-sm p-6 font-mono">
        
        {/* Header */}
        <div className="mb-4">
          <p className="text-[10px] uppercase tracking-widest text-gray-400">
            {isEdit ? "Modify Link" : "Add Link"}
          </p>
          <h2 className="text-lg font-semibold text-black">
            {isEdit ? "Edit Resource" : "New Resource"}
          </h2>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          <div>
            <label className="text-xs text-gray-500 block mb-1">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full border border-gray-200 rounded px-3 py-2 text-sm outline-none focus:border-gray-400"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">URL</label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              className="w-full border border-gray-200 rounded px-3 py-2 text-sm outline-none focus:border-gray-400"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-100"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="text-xs px-3 py-1.5 border border-black rounded bg-black text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {loading ? "Saving..." : isEdit ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}