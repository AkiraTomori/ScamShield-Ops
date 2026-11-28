import { handleLogin, handleLogout } from "../../../../server/ops-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return handleLogin(request);
}

export async function DELETE(request: Request): Promise<Response> {
  return handleLogout(request);
}
