export type LoginDividerProps = Readonly<{
  /** Text to display in the divider */
  text: string;
}>;

export default function LoginDivider({ text }: LoginDividerProps) {
  return (
    <div className="flex justify-center">
      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
        {text}
      </span>
    </div>
  );
}
