import { listConfirmedIndicators, type StaffSession } from "@scamshield/core";
import { parseRuntimeDatabaseEnv } from "@scamshield/shared";
import { Suspense } from "react";
import { vi } from "../../../../copy/vi";
import { CaseListSkeleton } from "../../../../features/cases/CaseListSkeleton";
import type { SearchParams } from "../../../../features/cases/list-url";
import { ConfirmedList } from "../../../../features/indicators/ConfirmedList";
import { indicatorsHref, parseIndicatorsPage } from "../../../../features/indicators/url";
import { getDeps } from "../../../../server/deps";
import { requireStaffPage } from "../../../../server/ops-session";

async function Indicators({ session, page }: { session: StaffSession; page: number }) {
  const env = parseRuntimeDatabaseEnv(process.env);
  if (!env.success) throw new Error("config_missing");
  const list = await listConfirmedIndicators(session, page, { db: getDeps(env.data).database.db });
  return <ConfirmedList page={list} />;
}

// The confirmed list (SO-08-AC03, ui-pages §7).
export default async function IndicatorsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const page = parseIndicatorsPage(await searchParams);
  const href = indicatorsHref(page);
  const session = await requireStaffPage(href);
  const t = vi.ops.indicators;
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6">
      <h1 className="text-xl font-bold">{t.heading}</h1>
      <p>{t.intro}</p>
      {/* Not loading.tsx, as on the case list: the session redirect must come first. */}
      <Suspense key={href} fallback={<CaseListSkeleton />}>
        <Indicators session={session} page={page} />
      </Suspense>
    </main>
  );
}
