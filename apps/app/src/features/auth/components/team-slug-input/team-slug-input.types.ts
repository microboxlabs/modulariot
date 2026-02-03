export type TeamSlugInputProps = Readonly<{
  /** Label for the input field */
  label: string;
  /** Placeholder text */
  placeholder: string;
  /** Current value */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Error message (if any) */
  error?: string;
}>;
