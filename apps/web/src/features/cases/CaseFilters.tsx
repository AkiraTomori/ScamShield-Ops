import Form from "next/form";
import type { SelectHTMLAttributes } from "react";
import { Verdict } from "@scamshield/shared/enums";
import { CaseStatusFilter, type CaseListQuery } from "@scamshield/shared/ops";
import { Button } from "../../components/Button";
import { vi } from "../../copy/vi";
import { LIST_PATH, PARAM } from "./list-url";

const FIELD = "min-h-11 rounded-control border border-border-strong bg-bg px-3";

function Field({
  id,
  label,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { id: string; label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-semibold">
        {label}
      </label>
      <select {...rest} id={id} className={FIELD}>
        {children}
      </select>
    </div>
  );
}

/** A GET form: the filters end up on the URL, and it works before the page hydrates. */
export function CaseFilters({ query }: { query: CaseListQuery }) {
  const t = vi.ops.list;
  return (
    <Form action={LIST_PATH} aria-label={t.filtersLabel} className="flex flex-col gap-1">
      <div className="flex flex-wrap items-end gap-3">
        <Field
          id="filter-status"
          name={PARAM.status}
          label={t.statusLabel}
          defaultValue={query.status}
        >
          {CaseStatusFilter.options.map((status) => (
            <option key={status} value={status}>
              {status === "all" ? t.all : t.status[status]}
            </option>
          ))}
        </Field>
        <Field
          id="filter-verdict"
          name={PARAM.verdict}
          label={t.verdictLabel}
          defaultValue={query.verdict ?? ""}
        >
          <option value="">{t.all}</option>
          {Verdict.options.map((verdict) => (
            <option key={verdict} value={verdict}>
              {vi.verdict[verdict].label}
            </option>
          ))}
        </Field>
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-code" className="font-semibold">
            {t.codeLabel}
          </label>
          <input
            id="filter-code"
            name={PARAM.code}
            defaultValue={query.code}
            placeholder={vi.caseStatus.codePlaceholder}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-describedby="filter-code-hint"
            className={`${FIELD} font-mono`}
          />
        </div>
        <Button type="submit">{t.apply}</Button>
      </div>
      <p id="filter-code-hint" className="text-sm text-text-muted">
        {t.codeHint}
      </p>
    </Form>
  );
}
