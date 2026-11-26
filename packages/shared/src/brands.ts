import { z } from "zod";
import data from "../data/brands.json";

/** Brands and their official registrable domains (Q-10). `data/brands.json` is the only source. */
export const Brand = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    name: z.string().min(1),
    kind: z.enum(["wallet", "bank"]),
    aliases: z.array(z.string().min(2)).min(1),
    domains: z.array(z.string().regex(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/)).min(1),
  })
  .strict();
export type Brand = z.infer<typeof Brand>;

export const BrandList = z
  .array(Brand)
  .refine((brands) => new Set(brands.map((b) => b.id)).size === brands.length, {
    message: "brand ids must be unique",
  });
export type BrandList = z.infer<typeof BrandList>;

/** Parsed at load: a broken list stops the app instead of silently checking nothing. */
export const BRANDS: BrandList = BrandList.parse(data);
