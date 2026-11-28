import { getCaseDetail } from "@scamshield/core";
import { parseRuntimeDatabaseEnv } from "@scamshield/shared";
import { notFound } from "next/navigation";
import { CaseDetailView } from "../../../../../features/cases/CaseDetailView";
import { caseHref } from "../../../../../features/cases/list-url";
import { getDeps } from "../../../../../server/deps";
import { requireStaffPage } from "../../../../../server/ops-session";

// No loading.tsx and no Suspense: once the response streams, notFound() and the sign-in redirect
// can no longer set the status.
export default async function CasePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const session = await requireStaffPage(caseHref(code));
  const env = parseRuntimeDatabaseEnv(process.env);
  if (!env.success) throw new Error("config_missing");
  const detail = await getCaseDetail(session, code, { db: getDeps(env.data).database.db });
  if (!detail) notFound();
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-4">
      <CaseDetailView detail={detail} />
    </main>
  );
}
