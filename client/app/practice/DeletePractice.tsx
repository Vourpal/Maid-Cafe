"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { authHeadersNoContent } from "@/lib/api";
import { PracticeSessions } from "@/types/event";

type Props = {
  session: PracticeSessions;
  setSessions: React.Dispatch<React.SetStateAction<PracticeSessions[]>>;
  onDeleted?: () => void;
};

export default function DeletePractice({
  session,
  setSessions,
  onDeleted,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    try {
      setLoading(true);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/practice-sessions/${session.id}`,
        {
          method: "DELETE",
          headers: authHeadersNoContent(),
        }
      );

      if (!res.ok) {
        throw new Error("Failed to delete practice");
      }

      setSessions((prev) =>
        prev.filter((p) => p.id !== session.id)
      );

      toast.success("Practice deleted");

      setOpen(false);

      if (onDeleted) {
        onDeleted();
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete practice");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        className="border-red-200 text-red-500 hover:bg-red-50"
        onClick={() => setOpen(true)}
      >
        Delete Practice
      </Button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setOpen(false)}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="bg-white p-6 rounded-xl max-w-md w-full pointer-events-auto shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-red-500 font-semibold text-lg">
                  🗑 Delete Practice
                </h2>

                <button
                  onClick={() => setOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <p className="text-sm text-gray-600 mb-6">
                Are you sure you want to delete{" "}
                <strong>{session.title}</strong>?
              </p>

              <div className="flex gap-2">
                <Button
                  onClick={handleDelete}
                  disabled={loading}
                  className="bg-red-500 hover:bg-red-600 text-white flex-1"
                >
                  {loading ? "Deleting..." : "Delete"}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}