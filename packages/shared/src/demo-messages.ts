import { z } from "zod";
import data from "../data/demo-messages.json";
import { Verdict } from "./enums";

/**
 * Demo messages (demo-data §2): `data/demo-messages.json` is the only source, read by the page and
 * later by seed, E2E and eval. The current texts are placeholders until T-093 writes the final ones.
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
