"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ALREADY_REMOVED_MESSAGE_VI,
  DECISION_ERROR_MESSAGE_VI,
  IndicatorRemovalRequest,
  type ConfirmedIndicatorItem,
  type ConfirmedIndicatorPage,
} from "@scamshield/shared/ops";
import { Button } from "../../components/Button";
import { vi } from "../../copy/vi";
import { caseHref } from "../cases/list-url";
import { formatShortTime } from "../lookup/format-time";
import { RemoveDialog } from "./RemoveDialog";
import { submitRemoval } from "./submit-removal";
import { indicatorsHref } from "./url";

/** Long enough to read why the page is about to change. */
const SIGN_IN_AFTER_MS = 2_000;
const CELL = "px-3 py-2";
const LINK = "inline-flex min-h-11 items-center text-primary underline";

function Pagination({ page, totalPages }: { page: number; totalPages: number }) {
  const t = vi.ops.list;
  const link = (target: number, label: string) =>
    target >= 1 && target <= totalPages ? (
      <Link href={indicatorsHref(target)} className={LINK}>
        {label}
      </Link>
    ) : (
      <span aria-disabled="true" className="inline-flex min-h-11 items-center text-text-muted">
        {label}
      </span>
    );
  return (
    <nav aria-label={t.pagesLabel} className="flex items-center justify-end gap-4">
      {link(page - 1, t.previous)}
      <span>{t.pageOf(page, totalPages)}</span>
      {link(page + 1, t.next)}
    </nav>
  );
}

/**
 * The confirmed list and its removals (SO-08-AC03). The dialog and the announcement live here, not in
 * a row: the refresh after a removal takes the row away.
 */
export function ConfirmedList({ page }: { page: ConfirmedIndicatorPage }) {
  const t = vi.ops.indicators;
  const router = useRouter();
  const [target, setTarget] = useState<ConfirmedIndicatorItem | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<{ message: string }>();
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);
  /** A new object each time, so the same words twice still move focus. */
  const [notice, setNotice] = useState<{ text: string; signedOut?: boolean } | null>(null);
  const inFlight = useRef(false);
  const openId = useRef<string | null>(null);
  const noticeRef = useRef<HTMLDivElement>(null);

  // The button that opened the dialog goes with its row, so focus moves to what happened.
  useEffect(() => {
    if (notice) noticeRef.current?.focus();
  }, [notice]);

  useEffect(() => {
    if (!notice?.signedOut) return;
    const next = encodeURIComponent(indicatorsHref(page.page));
    // A full load: nothing rendered with the old session should be reused.
    const timer = setTimeout(() => {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`/ops/dang-nhap?next=${next}`);
    }, SIGN_IN_AFTER_MS);
    return () => clearTimeout(timer);
  }, [notice, page.page]);

  function open(item: ConfirmedIndicatorItem) {
    openId.current = item.id;
    setReason("");
    setReasonError(undefined);
    setError(undefined);
    setNotice(null);
    setTarget(item);
  }

  function close() {
    openId.current = null;
    setTarget(null);
  }

  async function remove(item: ConfirmedIndicatorItem) {
    if (inFlight.current) return;
    const body = IndicatorRemovalRequest.safeParse({ reason });
    if (!body.success) {
      setReasonError({ message: DECISION_ERROR_MESSAGE_VI.reason });
      return;
    }
    inFlight.current = true;
    setSending(true);
    setReasonError(undefined);
    setError(undefined);
    const outcome = await submitRemoval(item.id, body.data);
    inFlight.current = false;
    setSending(false);

    const stillOpen = openId.current === item.id;
    if (outcome.kind === "invalid") {
      setReasonError({ message: outcome.message ?? DECISION_ERROR_MESSAGE_VI.reason });
    } else if (outcome.kind === "failed" || outcome.kind === "aborted") {
      // Kept open with what was typed; said outside the dialog if the browser closed it.
      if (stillOpen) setError(t.failed);
      else setNotice({ text: t.failed });
    } else {
      if (stillOpen) close();
      if (outcome.kind === "signed_out") {
        setNotice({ text: vi.ops.decision.expired, signedOut: true });
        return;
      }
      setNotice({
        text:
          outcome.kind === "removed"
            ? t.removed(item.normalized)
            : outcome.kind === "already"
              ? ALREADY_REMOVED_MESSAGE_VI
              : t.notFound,
      });
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Always mounted: a live region that appears already filled is often not read. */}
      <div ref={noticeRef} tabIndex={-1} aria-live="polite">
        {notice ? <p className="font-semibold wrap-anywhere">{notice.text}</p> : null}
      </div>

      {page.items.length === 0 ? (
        <p>{t.empty}</p>
      ) : (
        <>
          {/* The table scrolls, not the page, on a narrow window. */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-2xl text-left text-sm">
              <thead>
                <tr className="border-b border-border-strong">
                  {[t.columnIndicator, t.columnType, t.columnCase, t.columnTime, t.columnBy].map(
                    (heading) => (
                      <th key={heading} scope="col" className={CELL}>
                        {heading}
                      </th>
                    ),
                  )}
                  {/* `relative`: the hidden text is positioned, and without a positioned parent
                      inside the scroll box it widens the whole page on a narrow window. */}
                  <th scope="col" className={`${CELL} relative`}>
                    <span className="sr-only">{t.columnAction}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((item) => (
                  <tr key={item.id} className="border-b border-border">
                    {/* P5: from a message. Text, never a link. */}
                    <th scope="row" className={`${CELL} font-mono font-normal wrap-anywhere`}>
                      {item.normalized}
                    </th>
                    <td className={CELL}>{vi.ops.detail.indicatorType[item.type]}</td>
                    <td className={`${CELL} whitespace-nowrap`}>
                      {/* No prefetch: each one would be a session lookup per row. */}
                      <Link
                        href={caseHref(item.sourceCaseCode)}
                        prefetch={false}
                        className={`${LINK} font-mono`}
                      >
                        {item.sourceCaseCode}
                      </Link>
                    </td>
                    <td className={`${CELL} whitespace-nowrap`}>
                      <time dateTime={item.confirmedAt}>{formatShortTime(item.confirmedAt)}</time>
                    </td>
                    <td className={CELL}>{item.confirmedBy}</td>
                    <td className={`${CELL} text-right`}>
                      <Button
                        variant="secondary"
                        aria-label={t.removeLabel(item.normalized)}
                        onClick={() => open(item)}
                      >
                        {t.remove}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page.page} totalPages={page.totalPages} />
        </>
      )}

      {target ? (
        <RemoveDialog
          key={target.id}
          indicator={target.normalized}
          reason={reason}
          sending={sending}
          reasonError={reasonError}
          error={error}
          onReason={setReason}
          onSubmit={() => void remove(target)}
          onCancel={close}
        />
      ) : null}
    </div>
  );
}
