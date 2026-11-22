import { parseArgs } from "node:util";

export interface Q08Args {
  listModels: boolean;
  models: string[];
  runs: number;
  confirm: boolean;
  resume: boolean;
  fresh: boolean;
  retryFailed: boolean;
  reuseSignalsFrom: string | undefined;
  concurrency: number;
  limit: number | null;
  casesPath: string;
  noJsonMode: string[];
  reasoningFormat: string | undefined;
  reasoningEffort: string | undefined;
  priceIn: number[];
  priceOut: number[];
}

const csv = (v: string | undefined) =>
  (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s !== "");

export class ArgError extends Error {}

export function parseQ08Args(argv: readonly string[]): Q08Args {
  const { values } = parseArgs({
    args: [...argv],
    options: {
      "list-models": { type: "boolean", default: false },
      models: { type: "string" },
      runs: { type: "string", default: "3" },
      confirm: { type: "boolean", default: false },
      resume: { type: "boolean", default: false },
      fresh: { type: "boolean", default: false },
      "retry-failed": { type: "boolean", default: false },
      "reuse-signals-from": { type: "string" },
      concurrency: { type: "string", default: "2" },
      limit: { type: "string" },
      cases: { type: "string", default: "eval/cases/dev.jsonl" },
      "no-json-mode": { type: "string" },
      "reasoning-format": { type: "string" },
      "reasoning-effort": { type: "string" },
      "price-in": { type: "string" },
      "price-out": { type: "string" },
    },
    strict: true,
  });

  const runs = Number(values.runs);
  if (!Number.isInteger(runs) || runs < 1 || runs > 10) throw new ArgError("--runs must be 1..10");
  const limit = values.limit === undefined ? null : Number(values.limit);
  if (limit !== null && (!Number.isInteger(limit) || limit < 1))
    throw new ArgError("--limit must be a positive integer");
  const reasoningFormat = values["reasoning-format"];
  if (
    reasoningFormat !== undefined &&
    reasoningFormat !== "hidden" &&
    reasoningFormat !== "parsed"
  ) {
    throw new ArgError("--reasoning-format must be hidden or parsed");
  }
  const concurrency = Number(values.concurrency);
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4) {
    throw new ArgError("--concurrency must be 1..4");
  }
  if (values["retry-failed"] && !values.resume) throw new ArgError("--retry-failed needs --resume");
  if (values.resume && values.fresh)
    throw new ArgError("--resume and --fresh are mutually exclusive");

  const models = csv(values.models);
  const nums = (name: string, v: string | undefined) => {
    const list = csv(v).map(Number);
    if (list.some((n) => !Number.isFinite(n) || n < 0))
      throw new ArgError(`${name} must be non-negative numbers`);
    if (list.length > 1 && list.length !== models.length) {
      throw new ArgError(
        `${name} takes one value (all models) or one per model, in --models order`,
      );
    }
    return list;
  };

  return {
    listModels: values["list-models"],
    models,
    runs,
    confirm: values.confirm,
    resume: values.resume,
    fresh: values.fresh,
    retryFailed: values["retry-failed"],
    reuseSignalsFrom: values["reuse-signals-from"],
    concurrency,
    limit,
    casesPath: values.cases,
    noJsonMode: csv(values["no-json-mode"]),
    reasoningFormat,
    reasoningEffort: values["reasoning-effort"],
    priceIn: nums("--price-in", values["price-in"]),
    priceOut: nums("--price-out", values["price-out"]),
  };
}

/** Per-model price pair, expanding a single value to all models. Undefined if either is missing. */
export function pricesFor(
  args: Q08Args,
): { inPerMillion: number; outPerMillion: number }[] | undefined {
  if (args.priceIn.length === 0 || args.priceOut.length === 0) return undefined;
  return args.models.map((_, i) => ({
    inPerMillion: args.priceIn[args.priceIn.length === 1 ? 0 : i] ?? 0,
    outPerMillion: args.priceOut[args.priceOut.length === 1 ? 0 : i] ?? 0,
  }));
}
