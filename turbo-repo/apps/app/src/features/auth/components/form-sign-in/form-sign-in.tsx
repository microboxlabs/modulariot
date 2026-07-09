"use client";

import {
  authenticateAction,
  signInWithProvider,
  signInWithSaml,
} from "@/features/auth/services/auth.service";
import { FormSignInProps } from "./form-sign-in.types";
import React, { useActionState, useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { formSchema, FormSchema } from "../../services/auth.service.types";
import SignIn from "./sign-in";
import RegisterForm from "./register-form";
import { LoginButton } from "../login-button";
import { LoginDivider } from "../login-divider";
import { TeamSlugInput } from "../team-slug-input";

type ViewMode = "main" | "login" | "register";

function CardHeader({
  title,
  subtitle,
}: Readonly<{ title: string; subtitle: string }>) {
  return (
    <div className="w-full text-left pb-4">
      <h2 className="text-2xl font-bold text-gray-900 lg:text-3xl dark:text-white">
        {title}
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {subtitle}
      </p>
    </div>
  );
}

export default function FormSignIn({
  messages: msg,
  registerMessages,
  authConfig,
  providerLabels,
  dividerText,
  samlLabels,
  callbackUrl,
}: FormSignInProps) {
  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "", password: "" },
  });

  const { register } = form;
  const [_state, formAction] = useActionState(authenticateAction, {});
  const [pending, setPending] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("main");
  const [teamSlug, setTeamSlug] = useState("");
  const [teamSlugError, setTeamSlugError] = useState<string | undefined>();
  const [showTeamSlugInput, setShowTeamSlugInput] = useState(false);

  useEffect(() => {
    if (_state?.success) {
      setPending(false);
    }
  }, [_state]);

  const onSubmitForm = async function (e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    setPending(true);
    await e.currentTarget.form?.requestSubmit();
  };

  const getMessages = function (message = "") {
    return message == "Invalid form data"
      ? msg.invalidFromData
      : message == "Invalid credentials"
        ? msg.invalidCredentials
        : message;
  };

  // Get OAuth providers (non-SAML)
  const oauthProviders = authConfig.providers.filter((p) => p.type === "oauth");
  // Get SAML provider (if any)
  const samlProvider = authConfig.providers.find((p) => p.type === "saml");
  // Get credentials provider (if any)
  const credentialsProvider = authConfig.providers.find(
    (p) => p.type === "credentials"
  );
  const hasSamlOrCredentials = samlProvider || credentialsProvider;
  const needsDivider = oauthProviders.length > 0 && hasSamlOrCredentials;

  // Create sign-in action for OAuth provider
  const createOAuthAction = useCallback(
    (providerId: string) => {
      return () => signInWithProvider(providerId, callbackUrl);
    },
    [callbackUrl]
  );

  // Handle SAML sign-in with two-step flow
  // First click: reveal the team slug input
  // Second click: validate and submit
  const handleSamlSignIn = useCallback(async () => {
    // If team slug is required and input is not visible yet, show it first
    if (samlProvider?.teamSlugRequired && !showTeamSlugInput) {
      setShowTeamSlugInput(true);
      return;
    }

    // If team slug is required, validate before submitting
    if (samlProvider?.teamSlugRequired && !teamSlug.trim()) {
      setTeamSlugError(samlLabels?.teamSlugRequired ?? "Team slug is required");
      return;
    }
    setTeamSlugError(undefined);
    await signInWithSaml(teamSlug);
  }, [
    teamSlug,
    samlProvider?.teamSlugRequired,
    samlLabels?.teamSlugRequired,
    showTeamSlugInput,
  ]);

  // If showing the credentials (email/password) login form
  if (viewMode === "login" && credentialsProvider) {
    return (
      <>
        <CardHeader title={msg.loginTitle} subtitle={msg.loginSubtitle} />
        <form className="space-y-6" action={formAction}>
          <SignIn
            msg={msg}
            register={register}
            _state={_state}
            pending={pending}
            onSubmitForm={onSubmitForm}
            getMessages={getMessages}
            setShowLogin={() => setViewMode("main")}
          />
        </form>
      </>
    );
  }

  // If showing the register ("request access") form
  if (viewMode === "register" && credentialsProvider) {
    return (
      <>
        <CardHeader
          title={registerMessages.title}
          subtitle={registerMessages.subtitle}
        />
        <RegisterForm
          msg={registerMessages}
          onBack={() => setViewMode("main")}
        />
      </>
    );
  }

  return (
    <>
      <CardHeader title={msg.mainTitle} subtitle={msg.mainSubtitle} />
      <form className="space-y-6" action={formAction}>
        <div className="flex flex-col gap-y-3">
          {/* Render OAuth providers as buttons */}
          {oauthProviders.map((provider) => (
            <LoginButton
              key={provider.id}
              provider={provider}
              label={providerLabels[provider.id] ?? provider.name}
              formAction={createOAuthAction(provider.provider ?? provider.id)}
            />
          ))}

          {needsDivider && <LoginDivider text={dividerText} />}

          {/* Render SAML section if configured */}
          {samlProvider && samlLabels && (
            <div className="flex flex-col gap-y-3">
              {/* Team slug input (shown only after first button click) */}
              {samlProvider.teamSlugRequired && showTeamSlugInput && (
                <TeamSlugInput
                  label={samlLabels.teamSlugLabel}
                  placeholder={samlLabels.teamSlugPlaceholder}
                  value={teamSlug}
                  onChange={(value) => {
                    setTeamSlug(value);
                    if (teamSlugError) setTeamSlugError(undefined);
                  }}
                  error={teamSlugError}
                />
              )}
              {/* SAML button */}
              <LoginButton
                provider={samlProvider}
                label={providerLabels[samlProvider.id] ?? samlProvider.name}
                onClick={handleSamlSignIn}
              />
            </div>
          )}

          {/* Render credentials link and request-access link if configured */}
          {credentialsProvider && (
            <>
              <div className="flex justify-center">
                <a
                  href="#"
                  className="text-center text-sm font-normal text-blue-700 hover:underline cursor-pointer dark:text-blue-400"
                  onClick={(e) => {
                    e.preventDefault();
                    setViewMode("login");
                  }}
                >
                  {providerLabels[credentialsProvider.id] ??
                    credentialsProvider.name}
                </a>
              </div>

              <LoginDivider text={dividerText} />

              <div className="flex justify-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                <span>{msg.requestAccessPrompt}</span>
                <a
                  href="#"
                  className="text-blue-700 hover:underline cursor-pointer dark:text-blue-400"
                  onClick={(e) => {
                    e.preventDefault();
                    setViewMode("register");
                  }}
                >
                  {msg.requestAccessLink}
                </a>
              </div>
            </>
          )}

          {/* If only credentials provider and no OAuth/SAML, show form directly */}
          {credentialsProvider &&
            oauthProviders.length === 0 &&
            !samlProvider && (
              <SignIn
                msg={msg}
                register={register}
                _state={_state}
                pending={pending}
                onSubmitForm={onSubmitForm}
                getMessages={getMessages}
                setShowLogin={() => setViewMode("main")}
              />
            )}
        </div>
      </form>
    </>
  );
}
