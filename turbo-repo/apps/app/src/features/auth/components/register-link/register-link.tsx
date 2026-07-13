export type RegisterLinkProps = Readonly<{
  /** "¿No tienes cuenta?" prompt shown before the link */
  prompt: string;
  /** "Solicitar acceso" / "Sign up" link label */
  label: string;
  /** Resolved server-side from ENABLE_REGISTER_LINK so the flag never
   * reaches the client bundle; renders null when false. */
  enabled: boolean;
}>;

export default function RegisterLink({
  prompt,
  label,
  enabled,
}: RegisterLinkProps) {
  if (!enabled) {
    return null;
  }

  return (
    <div className="flex justify-center gap-1 text-sm text-gray-500 dark:text-gray-400">
      <span>{prompt}</span>
      <button
        type="button"
        className="bg-transparent border-0 p-0 text-blue-700 hover:underline cursor-pointer dark:text-blue-400"
      >
        {label}
      </button>
    </div>
  );
}
