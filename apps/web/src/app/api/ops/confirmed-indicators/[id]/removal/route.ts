import { handleIndicatorRemoval } from "../../../../../../server/ops-indicator-removal";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handleIndicatorRemoval(request, (await params).id);
}
