interface DomainLogoProps {
  readonly logoUrl: string;
  /** When null the light logo is used on both grounds. */
  readonly logoUrlDark?: string | null;
  readonly className?: string;
  readonly width?: number;
  readonly testId?: string;
}

/**
 * The domain's logo, drawn for whichever ground the viewer is on.
 *
 * When a domain ships both, each is rendered and CSS picks — the same
 * `dark:hidden` / `hidden dark:block` pair the theme toggle in the navbars
 * uses. Reading the theme in JavaScript instead would put the wrong logo in the
 * first paint and swap it a frame later, which is exactly the flash the server
 * render exists to avoid. The unused one is `display: none`, so assistive
 * technology reads the alt text once.
 */
export default function DomainLogo({
  logoUrl,
  logoUrlDark,
  className = "mr-3 h-8",
  width = 150,
  testId,
}: Readonly<DomainLogoProps>) {
  if (!logoUrlDark) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        className={className}
        alt="Organization logo"
        src={logoUrl}
        data-testid={testId}
        width={width}
      />
    );
  }

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={`${className} dark:hidden`}
        alt="Organization logo"
        src={logoUrl}
        data-testid={testId}
        width={width}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={`hidden ${className} dark:block`}
        alt="Organization logo"
        src={logoUrlDark}
        data-testid={testId ? `${testId}-dark` : undefined}
        width={width}
      />
    </>
  );
}
