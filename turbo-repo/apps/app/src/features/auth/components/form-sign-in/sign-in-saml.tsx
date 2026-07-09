import { Label, TextInput, Button } from "flowbite-react";
import { LoginDivider } from "../login-divider";
import { RegisterLink } from "../register-link";
import { inputTheme } from "./sign-in";

export default function SignInSaml({
  msg,
  samlLabels,
  teamSlug,
  teamSlugError,
  onTeamSlugChange,
  onSubmit,
  pending,
  setShowLogin,
  showRegisterLink,
}: {
  msg: any;
  samlLabels: any;
  teamSlug: string;
  teamSlugError: string | undefined;
  onTeamSlugChange: (value: string) => void;
  onSubmit: () => void;
  pending: boolean;
  setShowLogin: (show: boolean) => void;
  showRegisterLink: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-y-2">
        <Label htmlFor="team-slug">{samlLabels.teamSlugLabel}</Label>
        <TextInput
          id="team-slug"
          placeholder={samlLabels.teamSlugPlaceholder}
          type="text"
          theme={inputTheme}
          value={teamSlug}
          onChange={(e) => onTeamSlugChange(e.target.value)}
          color={teamSlugError ? "failure" : undefined}
        />
        {teamSlugError && (
          <p className="text-sm text-red-600 dark:text-red-500">
            {teamSlugError}
          </p>
        )}
      </div>
      <div className="">
        <Button
          color="blue"
          className="w-full px-0 py-px submit px-5 py-3"
          disabled={pending}
          aria-disabled={pending}
          onClick={onSubmit}
        >
          {msg.ssoSubmitLabel}
        </Button>
        <div className="mt-2 flex flex-col gap-2">
          <LoginDivider text="o" />
          <a
            href="#"
            className="text-center hover:underline cursor-pointer text-blue-700 dark:text-blue-400 text-sm"
            onClick={() => setShowLogin(false)}
          >
            {msg.buttonContinueWithMicrosoft}
          </a>
          <RegisterLink
            prompt={msg.requestAccessPrompt}
            label={msg.requestAccessLink}
            enabled={showRegisterLink}
          />
        </div>
      </div>
    </div>
  );
}
