/**
 * Opt-in switch for the previous treatment modal on the symptoms map.
 *
 * `NEXT_PUBLIC_SYMPTOMS_PAST_FORMS=true` opens that full-screen modal
 * (call, WhatsApp, ignore condition, invalidate symptom) instead of the
 * inline forms. Unset, or any other value, keeps the inline forms.
 */
export function isPastFormsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SYMPTOMS_PAST_FORMS === "true";
}
