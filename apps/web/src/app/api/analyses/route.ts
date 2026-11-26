import { handleCreateAnalysis } from "../../../server/analyses";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Above the 20 s budget of an analysis; what the Vercel plan allows is a deploy check. */
export const maxDuration = 30;

export async function POST(request: Request): Promise<Response> {
  return handleCreateAnalysis(request);
}
