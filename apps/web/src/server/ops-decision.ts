import { decideCase, logEvent, type DecideResult, type StaffSession } from "@scamshield/core";
import {
  DECISION_ERROR_MESSAGE_VI,
  DecisionRecord,
  DecisionRequest,
  parseRuntimeDatabaseEnv,
  type RuntimeDatabaseEnv,
} from "@scamshield/shared";
import { getDeps } from "./deps";
import { failure, json, readJson } from "./http";
import { isSameOrigin } from "./ops-guards";
import { requireStaffApi, verifyWithDatabase, type VerifyToken } from "./ops-session";

// POST /api/ops/cases/{caseCode}/decision (api.md §4, fraudops §5.3). The reason is never logged.

/** The I/O the route needs, replaceable in tests. */
export interface DecisionServices {
  verify: VerifyToken;
  decide: (session: StaffSession, caseCode: string, req: DecisionRequest) => Promise<DecideResult>;
}

export interface DecisionContext {
  env?: Record<string, string | undefined>;
  services?: DecisionServices;
}

function realServices(env: RuntimeDatabaseEnv): DecisionServices {
  return {
    verify: verifyWithDatabase(env),
    decide: (session, caseCode, req) =>
      decideCase(session, caseCode, req, {
        db: getDeps(env).database.db,
        now: () => new Date(),
      }),
  };
}

type BodyError = NonNullable<ReturnType<typeof DecisionRequest.safeParse>["error"]>;

/** Field names with their wording; undefined when the request is malformed in another way. */
function fieldErrors(error: BodyError): Record<string, string> | undefined {
  const fields = Object.fromEntries(
    error.issues.flatMap((issue) => {
      const field = issue.path[0];
      return field === "decision" || field === "reason"
        ? [[field, DECISION_ERROR_MESSAGE_VI[field]]]
        : [];
    }),
  );
  return Object.keys(fields).length > 0 ? fields : undefined;
}

export async function handleDecision(
  request: Request,
  caseCode: string,
  context: DecisionContext = {},
): Promise<Response> {
  let step = "config";
  try {
    if (!isSameOrigin(request)) return failure("forbidden_origin");
    const env = parseRuntimeDatabaseEnv(context.env ?? process.env);
    if (!env.success) {
      logEvent({ event: "ops_decision_failed", code: "config_missing" });
      return failure("internal");
    }
    const services = context.services ?? realServices(env.data);

    step = "session";
    const session = await requireStaffApi(request, services.verify);
    if (session instanceof Response) return session;

    step = "input";
    const body = DecisionRequest.safeParse(await readJson(request));
    if (!body.success) return failure("validation_failed", undefined, fieldErrors(body.error));

    step = "decide";
    const result = await services.decide(session, caseCode, body.data);
    if (result.kind === "not_found") return failure("not_found");
    // The existing decision is not sent: the page reloads and shows it (OP-03 b).
    if (result.kind === "conflict") return failure("conflict");
    return json(DecisionRecord.parse(result.decision), 200);
  } catch {
    logEvent({ event: "ops_decision_failed", code: step });
    return failure("internal");
  }
}
