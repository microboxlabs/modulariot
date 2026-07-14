import { Label, TextInput } from "flowbite-react";
import type { UseFormRegister } from "react-hook-form";
import type { RegisterFormMessages } from "./form-sign-in.types";
import type { RegisterSchema } from "./register-form.schema";
import { LoginButton } from "../login-button";
import { LoginDivider } from "../login-divider";
import type { AuthProviderConfig } from "@/features/auth/config/auth-providers.types";

// Static — the register wizard isn't wired to a live OAuth flow yet, this
// mirrors the sign-in card's provider buttons for a consistent look.
const OAUTH_PROVIDERS: readonly AuthProviderConfig[] = [
  { id: "google", name: "Google", type: "oauth", provider: "google", icon: "google" },
  { id: "microsoft", name: "Microsoft", type: "oauth", provider: "microsoft-entra-id", icon: "microsoft" },
  { id: "github", name: "GitHub", type: "oauth", provider: "github", icon: "github" },
];

export default function RegisterStepProfile({
  msg,
  register,
}: Readonly<{
  msg: RegisterFormMessages;
  register: UseFormRegister<RegisterSchema>;
}>) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-y-3">
        {OAUTH_PROVIDERS.map((provider) => (
          <LoginButton
            key={provider.id}
            provider={provider}
            label={`${msg.createAccountWithLabel} ${provider.name}`}
          />
        ))}
      </div>

      <LoginDivider text={msg.dividerText} />

      <div className="flex flex-col gap-y-4">
        <div className="flex flex-col gap-y-2">
          <Label htmlFor="full-name">{msg.fullNameLabel}</Label>
          <TextInput
            id="full-name"
            placeholder={msg.fullNamePlaceholder}
            type="text"
            {...register("fullName")}
          />
        </div>
        <div className="flex flex-col gap-y-2">
          <Label htmlFor="register-email">{msg.emailLabel}</Label>
          <TextInput
            id="register-email"
            placeholder={msg.emailPlaceholder}
            type="text"
            {...register("email")}
          />
        </div>
      </div>
    </div>
  );
}
