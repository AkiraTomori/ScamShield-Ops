import type { Metadata } from "next";
import type { ReactNode } from "react";
import { vi } from "../../copy/vi";

export const metadata: Metadata = { title: vi.ops.productName, description: vi.ops.description };

export default function OpsLayout({ children }: { children: ReactNode }) {
  return children;
}
