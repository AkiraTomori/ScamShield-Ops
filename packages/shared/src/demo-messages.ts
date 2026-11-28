import { z } from "zod";
import data from "../data/demo-messages.json";
import { Verdict } from "./enums";

/**
 * Demo messages (demo-data §2): `data/demo-messages.json` is the only source, read by the page and
 * E2E, and later by eval. M1 and M3 share a domain and impersonate the brand of the S1 seed cases.
 */
export const DemoMessage = z
  .object({
    id: z.enum(["M1", "M2", "M3", "prize", "urgent"]),
    /** Label of the chip on `/`; null when the message is not offered there. */
    chip: z.string().min(1).nullable(),
    expectedVerdict: Verdict,
    content: z.string().min(1),
  })
  .strict();
export type DemoMessage = z.infer<typeof DemoMessage>;

export const DEMO_MESSAGES: DemoMessage[] = z.array(DemoMessage).parse(data);
