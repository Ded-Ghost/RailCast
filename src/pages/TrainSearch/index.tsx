import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, X } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/common/Card";
import { EmptyState } from "@/components/common/EmptyState";
import { CardSkeleton } from "@/components/common/Skeleton";
import { TrainResultRow } from "@/components/train/TrainResultRow";
import { useTrains } from "@/hooks/useTrains";
import { trainService } from "@/services/trainService";
import { cn } from "@/lib/cn";
import type { DelayStatus, Train } from "@/types";

type StatusFilter = "all" | DelayStatus;

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "on-time", label: "On Time" },
  { value: "minor", label: "Minor" },
  { value: "significant", label: "Significant" },
  { value: "severe", label: "Severe" },
];

/**
 * Browse-and-search: shows the full live train list by default (filterable
 * by delay status), or query results when a search term is present via the
 * global header search or the input below. Every row prioritizes ETA,
 * delay, and current location per the brief — see TrainResultRow.
 */
export default function TrainSearch() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initialQuery);
  const [queryResults, setQueryResults] = useState<Train[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const { data: allTrains, isLoading: isLoadingAll } = useTrains();

  useEffect(() => {
    if (!initialQuery) {
      setQueryResults(null);
      return;
    }
    setIsSearching(true);
    trainService
      .searchTrains(initialQuery)
      .then(setQueryResults)
      .finally(() => setIsSearching(false));
  }, [initialQuery]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSearchParams(query ? { q: query } : {});
  }

  function clearSearch() {
    setQuery("");
    setSearchParams({});
  }

  const baseResults = initialQuery ? queryResults : allTrains;
  const isLoading = initialQuery ? isSearching : isLoadingAll;

  const results = useMemo(() => {
    if (!baseResults) return null;
    if (statusFilter === "all") return baseResults;
    return baseResults.filter((train) => train.delayStatus === statusFilter);
  }, [baseResults, statusFilter]);

  return (
    <PageContainer>
      <PageHeader
        title="Train Search"
        description="Find any train by number or name to see its live ETA and telemetry."
      />

      <form onSubmit={handleSubmit} className="relative max-w-2xl">
        <Search
          size={20}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant"
        />
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by train number or name (e.g. 12345, Rajdhani)"
          className="h-14 w-full rounded-lg border border-outline-variant bg-surface-container-lowest pl-12 pr-12 text-body-lg text-on-surface shadow-card placeholder:text-on-surface-variant/70 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        {initialQuery && (
          <button
            type="button"
            onClick={clearSearch}
            aria-label="Clear search"
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded p-1 text-on-surface-variant hover:bg-surface-container-high"
          >
            <X size={18} />
          </button>
        )}
      </form>

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => setStatusFilter(filter.value)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-body-sm font-semibold transition-colors",
              statusFilter === filter.value
                ? "border-primary bg-primary text-on-primary"
                : "border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high",
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <CardSkeleton rows={2} />
          <CardSkeleton rows={2} />
        </div>
      ) : !results || results.length === 0 ? (
        <Card>
          <EmptyState
            icon={Search}
            title="No trains found"
            description={
              initialQuery
                ? `No results for "${initialQuery}" with the current filter.`
                : "No trains match the current filter."
            }
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {results.map((train) => (
            <TrainResultRow key={train.id} train={train} />
          ))}
        </div>
      )}
    </PageContainer>
  );
}
