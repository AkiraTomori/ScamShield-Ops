import { Button } from "./Button";

type Sample = { id: string; label: string; content: string };

/** Buttons that fill the text box; they never send (SO-10-AC05). */
export function SampleChips({
  heading,
  samples,
  disabled,
  onPick,
}: {
  heading: string;
  samples: Sample[];
  disabled: boolean;
  onPick: (content: string) => void;
}) {
  return (
    <div role="group" aria-labelledby="samples-heading" className="flex flex-col gap-2">
      <p id="samples-heading" className="text-sm text-text-muted">
        {heading}
      </p>
      <div className="flex flex-wrap gap-2">
        {samples.map((sample) => (
          <Button
            key={sample.id}
            variant="secondary"
            disabled={disabled}
            onClick={() => onPick(sample.content)}
          >
            {sample.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
