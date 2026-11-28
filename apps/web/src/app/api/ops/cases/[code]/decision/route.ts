import { handleDecision } from "../../../../../../server/ops-decision";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
): Promise<Response> {
  return handleDecision(request, (await params).code);
}
