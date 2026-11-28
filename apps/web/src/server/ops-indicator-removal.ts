import {
  logEvent,
  removeConfirmedIndicator,
  type RemoveResult,
  type StaffSession,
} from "@scamshield/core";
import {
  ALREADY_REMOVED_MESSAGE_VI,
  DECISION_ERROR_MESSAGE_VI,
  IndicatorId,
  IndicatorRemovalRequest,
  IndicatorRemovalResponse,
  parseRuntimeDatabaseEnv,
  type RuntimeDatabaseEnv,
} from "@scamshield/shared";
import { getDeps } from "./deps";
import { failure, json, readJson } from "./http";
import { isSameOrigin } from "./ops-guards";
import { requireStaffApi, verifyWithDatabase, type VerifyToken } from "./ops-session";

// POST /api/ops/confirmed-indicators/{id}/removal (api.md §4, verified-indicators §5). The reason is
// never logged.

/** The I/O the route needs, replaceable in tests. */
export interface RemovalServices {
  verify: VerifyToken;
  remove: (session: StaffSession, id: string, reason: string) => Promise<RemoveResult>;
}

export interface RemovalContext {
  env?: Record<string, string | undefined>;
  services?: RemovalServices;
}

function realServices(env: RuntimeDatabaseEnv): RemovalServices {
  return {
    verify: verifyWithDatabase(env),
    remove: (session, id, reason) =>
      removeConfirmedIndicator(session, id, reason, {
        db: getDeps(env).database.db,
        now: () => new Date(),
      }),
  };
}

export async function handleIndicatorRemoval(
  request: Request,
  id: string,
  context: RemovalContext = {},
): Promise<Response> {
  let step = "config";
  try {
    if (!isSameOrigin(request)) return failure("forbidden_origin");
    const env = parseRuntimeDatabaseEnv(context.env ?? process.env);
    if (!env.success) {
      logEvent({ event: "ops_indicator_removal_failed", code: "config_missing" });
      return failure("internal");
    }
    const services = context.services ?? realServices(env.data);

    step = "session";
    const session = await requireStaffApi(request, services.verify);
    if (session instanceof Response) return session;

    step = "input";
    if (!IndicatorId.safeParse(id).success) return failure("validation_failed");
    const body = IndicatorRemovalRequest.safeParse(await readJson(request));
    if (!body.success) {
      const onReason = body.error.issues.some((issue) => issue.path[0] === "reason");
      return failure(
        "validation_failed",
        undefined,
        onReason ? { reason: DECISION_ERROR_MESSAGE_VI.reason } : undefined,
      );
    }

    step = "remove";
    const result = await services.remove(session, id, body.data.reason);
    if (result.kind === "not_found") return failure("not_found");
    // The shared wording of `conflict` is about closing a case.
    if (result.kind === "already_removed") return failure("conflict", ALREADY_REMOVED_MESSAGE_VI);
    return json(IndicatorRemovalResponse.parse({ removed: true }), 200);
  } catch {
    logEvent({ event: "ops_indicator_removal_failed", code: step });
    return failure("internal");
  }
}
