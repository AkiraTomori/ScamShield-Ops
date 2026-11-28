import { CaseListQuery } from "@scamshield/shared/ops";
import { PARAM, type SearchParams } from "../cases/list-url";

export const INDICATORS_PATH = "/ops/chi-dau";

/** The page number read as the case list reads it: anything odd is page 1. */
export function parseIndicatorsPage(params: SearchParams): number {
  return CaseListQuery.shape.page.parse(params[PARAM.page]);
}

export function indicatorsHref(page: number): string {
  return page > 1 ? `${INDICATORS_PATH}?${PARAM.page}=${page}` : INDICATORS_PATH;
}
