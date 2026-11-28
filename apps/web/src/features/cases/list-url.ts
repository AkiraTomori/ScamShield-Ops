import { CaseListQuery } from "@scamshield/shared/ops";

// The filters live on the URL, so reloading keeps them (SO-06-AC05, fraudops §4).

export const LIST_PATH = "/ops";
export const PARAM = {
  status: "trang-thai",
  verdict: "verdict",
  code: "ma",
  page: "trang",
} as const;

export type SearchParams = Record<string, string | string[] | undefined>;

export function parseCaseListQuery(params: SearchParams): CaseListQuery {
  return CaseListQuery.parse({
    status: params[PARAM.status],
    verdict: params[PARAM.verdict],
    code: params[PARAM.code],
    page: params[PARAM.page],
  });
}

/** The canonical address of a query: defaults are left out. */
export function caseListHref(query: CaseListQuery): string {
  const params = new URLSearchParams();
  if (query.status !== "pending_review") params.set(PARAM.status, query.status);
  if (query.verdict) params.set(PARAM.verdict, query.verdict);
  if (query.code) params.set(PARAM.code, query.code);
  if (query.page > 1) params.set(PARAM.page, String(query.page));
  const search = params.toString();
  return search ? `${LIST_PATH}?${search}` : LIST_PATH;
}

export function caseHref(caseCode: string): string {
  return `${LIST_PATH}/ho-so/${encodeURIComponent(caseCode)}`;
}
