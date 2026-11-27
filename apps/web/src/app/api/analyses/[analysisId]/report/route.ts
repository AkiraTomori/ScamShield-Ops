import { handleReport } from "../../../../../server/reports";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Above the 8 s summary budget; what the Vercel plan allows is a deploy check. */
export const maxDuration = 30;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ analysisId: string }> },
): Promise<Response> {
  const { analysisId } = await params;
  return handleReport(request, analysisId);
}
