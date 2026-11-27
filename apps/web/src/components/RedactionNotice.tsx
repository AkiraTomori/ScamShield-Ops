import { InfoCircleIcon } from "./Icon";

export function RedactionNotice({ text }: { text: string }) {
  return (
    <p className="flex gap-2 text-sm text-text-muted">
      <InfoCircleIcon />
      {text}
    </p>
  );
}
