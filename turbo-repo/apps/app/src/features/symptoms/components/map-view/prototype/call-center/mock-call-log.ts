/**
 * Frontend-only mock breakdown for a "Llamar a…" treatment entry. The real
 * `TreatmentTimelineElement` (see `types/timeline.ts`) only carries
 * `treatment_type` + a `description` string pair — no per-call method,
 * duration, outcome or timestamp — so there is nothing to fetch here. This
 * synthesizes a plausible, stable one from a hash of the treatment's
 * position (same idea as `mock-contact-data.ts`); it's read-only, nothing
 * here is ever sent to a backend.
 */

import { ALL_CALL_METHODS, type CallMethod } from "./call-method";
import { hashId, mockNameForId } from "./mock-contact-data";

export type CallOutcome = "answered" | "missed";

export interface CallLogEntry {
  id: string;
  calledName: string;
  method: CallMethod;
  outcome: CallOutcome;
  durationSeconds: number;
  minutesAgo: number;
  /** What was communicated on this specific attempt — mocked independently
   *  per entry so several calls under one treatment don't all show the same
   *  detail on hover. */
  message: string;
  /** Empty when missed — nobody picked up to respond. */
  response: string;
}

const MOCK_MISSED_MESSAGE =
  "Se intentó comunicar la condición detectada, pero no hubo respuesta.";

const MOCK_CALL_MESSAGES = [
  "Se informó sobre la condición detectada y se solicitó corregir la conducta.",
  "Se comunicó la alerta activa y se pidió mayor atención en la ruta.",
  "Se notificó el incumplimiento y se recordó el protocolo de descanso.",
  "Se advirtió sobre la desviación de ruta detectada.",
  "Se consultó por el estado del viaje y se reforzó la indicación de seguridad.",
];

const MOCK_CALL_RESPONSES = [
  "El conductor confirmó la recepción y se comprometió a corregir.",
  "El conductor indicó que ya había corregido la condición.",
  "El conductor discutió la alerta y no aceptó responsabilidad.",
  "El conductor solicitó más información antes de responder.",
  "El conductor agradeció el aviso y confirmó que todo estaba en orden.",
];

/** 1-3 deterministic mock calls for one treatment entry — stable across
 *  re-renders for the same `seed` (e.g. `${symptomId}-${treatmentIndex}`). */
export function mockCallLogForTreatment(seed: string): CallLogEntry[] {
  const hash = hashId(seed);
  const count = 1 + (hash % 3);
  return Array.from({ length: count }, (_, i) => {
    const entryHash = hashId(`${seed}:${i}`);
    const outcome: CallOutcome = entryHash % 5 === 0 ? "missed" : "answered";
    return {
      id: `${seed}:${i}`,
      calledName: mockNameForId(`${seed}:${i}:name`),
      method: ALL_CALL_METHODS[entryHash % ALL_CALL_METHODS.length],
      outcome,
      durationSeconds: outcome === "answered" ? 15 + (entryHash % 240) : 0,
      minutesAgo: 2 + i * 7 + (entryHash % 40),
      message:
        outcome === "answered"
          ? MOCK_CALL_MESSAGES[entryHash % MOCK_CALL_MESSAGES.length]
          : MOCK_MISSED_MESSAGE,
      response:
        outcome === "answered"
          ? MOCK_CALL_RESPONSES[
              Math.floor(entryHash / MOCK_CALL_MESSAGES.length) %
                MOCK_CALL_RESPONSES.length
            ]
          : "",
    };
  });
}

export function formatCallLogDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}
