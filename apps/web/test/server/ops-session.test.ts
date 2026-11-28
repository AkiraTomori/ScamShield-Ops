import { afterEach, describe, expect, it, vi } from "vitest";

const cookieValue = vi.hoisted(() => ({ current: undefined as string | undefined }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (cookieValue.current ? { value: cookieValue.current } : undefined),
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
}));

const { requireStaffPage } = await import("../../src/server/ops-session");

afterEach(() => {
  cookieValue.current = undefined;
});

describe("requireStaffPage", () => {
  it("SO-06-AC01: sends a visitor without a session to sign-in, and back afterwards", async () => {
    await expect(requireStaffPage("/ops/ho-so/SC-0101")).rejects.toThrow(
      "redirect:/ops/dang-nhap?next=%2Fops%2Fho-so%2FSC-0101",
    );
  });

  it("never carries another site in next", async () => {
    await expect(requireStaffPage("//evil.example")).rejects.toThrow(
      "redirect:/ops/dang-nhap?next=%2Fops",
    );
  });
});
