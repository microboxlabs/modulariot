import { Label, TextInput, Checkbox, Button } from "flowbite-react";
import Link from "next/link";
import { LoginDivider } from "../login-divider";
import { RegisterLink } from "../register-link";

// Matches the light-bordered look of the provider buttons on the main view
// (border-gray-200/bg-white) instead of flowbite's default gray-50 fill,
// so the credentials form reads as part of the same card.
export const inputTheme = {
  field: {
    input: {
      colors: {
        gray: "border-gray-200 bg-white text-gray-900 placeholder-gray-500 focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400 dark:focus:border-primary-500 dark:focus:ring-primary-500",
      },
    },
  },
};

export default function SignIn({
  msg,
  register,
  _state,
  pending,
  onSubmitForm,
  getMessages,
  setShowLogin,
  showRegisterLink,
}: {
  msg: any;
  register: any;
  _state: any;
  pending: any;
  onSubmitForm: any;
  getMessages: any;
  setShowLogin: any;
  showRegisterLink: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-y-2">
        <Label htmlFor="email">{msg.emailLabel}</Label>
        <TextInput
          id="email"
          /* name="email" */
          placeholder={msg.emailPlaceHolder}
          type="text"
          theme={inputTheme}
          className={
            _state && _state.dataErrors?.email
              ? "animate-pulse border-2 border-rose-500"
              : ""
          }
          {...register("email")}
        />
      </div>
      <div className="flex flex-col gap-y-2">
        <Label htmlFor="password">{msg.passwordLabel}</Label>
        <TextInput
          id="password"
          /* name="password" */
          placeholder="••••••••"
          type="password"
          theme={inputTheme}
          className={
            _state && _state.dataErrors?.password
              ? "animate-pulse border-2 border-rose-500"
              : ""
          }
          {...register("password")}
        />
      </div>
      
      {/* <div>
  {_state && _state.dataErrors && JSON.stringify(_state.dataErrors)}
</div> */}
      <div className="flex flex-col gap-y-2">
          <div className="flex items-center justify-between">
          <div className="flex items-center gap-x-3">
            <Checkbox id="rememberMe" name="rememberMe" />
            <Label htmlFor="rememberMe" className="font-light">{msg.rememberMeLabel}</Label>
          </div>
          <Link
            href="#"
            className="text-right text-sm text-blue-700 hover:underline dark:text-blue-400"
          >
            {msg.forgotPasswordLabel}
          </Link>
        </div>
        {_state?.message && !_state?.success && (
          <div className="text-red-500 mb-4">{getMessages(_state.message)}</div>
        )}
        <Button
          color="blue"
          className="w-full px-0 py-px submit px-5 py-3"
          disabled={pending && _state?.success == undefined}
          aria-disabled={pending && _state?.success == undefined}
          onClick={onSubmitForm}
        >
          {msg.buttonSubmitLabel}
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
