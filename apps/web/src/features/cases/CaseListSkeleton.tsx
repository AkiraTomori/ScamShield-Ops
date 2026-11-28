import { Skeleton } from "../../components/Skeleton";
import { vi } from "../../copy/vi";

export function CaseListSkeleton() {
  return (
    <div role="status" className="flex flex-col gap-4">
      <span className="sr-only">{vi.ops.list.loading}</span>
      <Skeleton />
      <Skeleton />
    </div>
  );
}
