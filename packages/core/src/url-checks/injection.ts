import { EVIDENCE_MAX_CHARS, type Signal } from "@scamshield/shared";
import { clip } from "../text/clip";
import { fold } from "../text/fold";

/** Blunt instructions aimed at an AI (SO-01-AC05, analysis-pipeline §6.8). Matched without diacritics. */
const PATTERNS = [
  /bo qua (?:(?:moi|tat ca|cac|toan bo) )*(?:huong dan|chi dan|yeu cau) (?:truoc|o tren|ben tren)/,
  /ignore (?:all )?(?:the )?(?:previous|prior|above) instructions/,
  /(?:danh gia|ket luan|tra loi).{0,30}(?:an toan|khong lua dao)/,
  /system prompt/,
  /you are (?:now )?an? (?:ai|assistant)(?![a-z])/,
];

export function detectInjection(text: string): Signal[] {
  const folded = fold(text);
  const flat = folded.text.replace(/\s/g, " ");
  for (const pattern of PATTERNS) {
    const match = pattern.exec(flat);
    if (!match) continue;
    const evidence = text.slice(folded.at(match.index), folded.at(match.index + match[0].length));
    return [
      {
        type: "ai_directed_instruction",
        source: "deterministic",
        evidence: clip(evidence, EVIDENCE_MAX_CHARS),
        indicator: null,
      },
    ];
  }
  return [];
}
