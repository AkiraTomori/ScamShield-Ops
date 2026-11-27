import { handleCaseStatus } from "../../../server/case-status";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return handleCaseStatus(request);
}
