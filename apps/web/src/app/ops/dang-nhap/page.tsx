import { vi } from "../../../copy/vi";
import { LoginForm } from "../../../features/auth/LoginForm";
import { safeNextPath } from "../../../server/ops-guards";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="mx-auto flex w-full max-w-sm flex-col gap-4 px-4 py-8">
      <p className="font-bold">{vi.ops.productName}</p>
      <h1 className="text-xl font-bold">{vi.ops.login.heading}</h1>
      <LoginForm next={safeNextPath(next)} />
      <p className="text-sm">{vi.ops.login.accountHint}</p>
    </main>
  );
}
