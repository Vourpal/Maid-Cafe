"use client";

import { useRouter, useSearchParams } from "next/navigation";

type PaginationProps = {
  currentPage: number;
  total: number;
  quantity: number;
};

export default function Pagination({
  currentPage,
  total,
  quantity,
}: PaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function getPageWindow(
    currentPage: number,
    total: number,
    quantity: number,
    maxVisible = 5,
  ) {
    const totalPages = Math.ceil(total / quantity);

    if (totalPages <= maxVisible) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const half = Math.floor(maxVisible / 2);
    let startPage = currentPage - half;
    let endPage = currentPage + half;

    if (startPage < 1) {
      startPage = 1;
      endPage = maxVisible;
    }

    if (endPage > totalPages) {
      endPage = totalPages;
      startPage = totalPages - maxVisible + 1;
    }

    return Array.from(
      { length: endPage - startPage + 1 },
      (_, i) => startPage + i,
    );
  }

  const pages = getPageWindow(currentPage, total, quantity);
  const totalPages = Math.ceil(total / quantity);

  function goToPage(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", page.toString());
    router.push(`/events?${params.toString()}`);
  }

  return (
    <div style={{ display: "flex", gap: "8px", marginTop: "20px" }}>
      {/* Previous */}
      <button
        disabled={currentPage === 1}
        onClick={() => goToPage(currentPage - 1)}
      >
        Prev
      </button>

      {/* Page numbers */}
      {pages.map((p) => (
        <button
          key={p}
          onClick={() => goToPage(p)}
          style={{
            fontWeight: p === currentPage ? "bold" : "normal",
            textDecoration: p === currentPage ? "underline" : "none",
          }}
        >
          {p}
        </button>
      ))}

      {/* Next */}
      <button
        disabled={currentPage === totalPages}
        onClick={() => goToPage(currentPage + 1)}
      >
        Next
      </button>
    </div>
  );
}