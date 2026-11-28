import { vi } from "../../../copy/vi";
import { requireStaffPage } from "../../../server/ops-session";

export default async function OpsHomePage() {
  await requireStaffPage("/ops");
  // The case list replaces this (T-061).
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-6">
      <h1 className="text-xl font-bold">{vi.ops.cases}</h1>
      <p>{vi.ops.casesNotBuilt}</p>
    </main>
  );
}
