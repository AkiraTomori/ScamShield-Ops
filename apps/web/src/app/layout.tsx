import type { Metadata } from "next";
import type { ReactNode } from "react";
import { vi } from "../copy/vi";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: vi.productName,
  description: vi.tagline,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
