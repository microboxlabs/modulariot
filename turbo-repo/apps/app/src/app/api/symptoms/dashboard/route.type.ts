export interface SymptomsDashboard {
  critic: number;
  stable: number;
  codeBlack: number;
  remission: number;
  treatment: number;
  compromised: number;
  observation: number;
  /** Engine cases on an "Ignorar condición" hold, out of the other counts. */
  ignored: number;
}
