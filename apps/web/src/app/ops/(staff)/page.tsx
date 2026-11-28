import { listCases, type StaffSession } from "@scamshield/core";
import { parseRuntimeDatabaseEnv, type CaseListQuery } from "@scamshield/shared";
import { Suspense } from "react";
import { vi } from "../../../copy/vi";
import { CaseFilters } from "../../../features/cases/CaseFilters";
import { CaseList } from "../../../features/cases/CaseList";
import { CaseListSkeleton } from "../../../features/cases/CaseListSkeleton";
import {
  caseListHref,
  parseCaseListQuery,
  type SearchParams,
} from "../../../features/cases/list-url";
import { getDeps } from "../../../server/deps";
import { requireStaffPage } from "../../../server/ops-session";

async function Cases({ session, query }: { session: StaffSession; query: CaseListQuery }) {
  const env = parseRuntimeDatabaseEnv(process.env);
  if (!env.success) throw new Error("config_missing");
  const page = await listCases(session, query, { db: getDeps(env.data).database.db });
  return <CaseList page={page} query={query} />;
}

export default async function OpsHomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const query = parseCaseListQuery(await searchParams);
  const href = caseListHref(query);
  const session = await requireStaffPage(href);
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6">
      <h1 className="text-xl font-bold">{vi.ops.cases}</h1>
      {/* Remounted per query, so the fields show the filters of the address. */}
      <div key={href}>
        <CaseFilters query={query} />
      </div>
      {/* Not loading.tsx: that would start the response before the session check, turning the
          redirect of a visitor without a session into a 200. */}
      <Suspense key={`list:${href}`} fallback={<CaseListSkeleton />}>
        <Cases session={session} query={query} />
      </Suspense>
    </main>
  );
}
