"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface PaginationControlsProps {
  page: number;
  hasPrevious: boolean;
  hasNext: boolean;
  loading?: boolean;
  onPrevious: () => void;
  onNext: () => void;
}

export function PaginationControls({
  page,
  hasPrevious,
  hasNext,
  loading = false,
  onPrevious,
  onNext,
}: PaginationControlsProps) {
  return (
    <div className="mt-4 flex items-center justify-between gap-3">
      <Button type="button" variant="secondary" size="sm" disabled={!hasPrevious || loading} onClick={onPrevious}>
        <ChevronLeft className="h-4 w-4" /> Anterior
      </Button>
      <span className="text-xs text-ink-muted">PÃ¡gina {page}</span>
      <Button type="button" variant="secondary" size="sm" disabled={!hasNext || loading} onClick={onNext}>
        PrÃ³xima pÃ¡gina <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
