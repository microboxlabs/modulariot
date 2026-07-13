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
import SignInSaml from "./sign-in-saml";
import { LoginButton } from "../login-button";
import { LoginDivider } from "../login-divider";
import { RegisterLink } from "../register-link";

type ViewMode = "main" | "login" | "sso";

function CardHeader({
  title,
  subtitle,
}: Readonly<{ title: string; subtitle: string }>) {
  return (
    <div className="w-full text-left pb-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
        {title}
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 font-light">
        {subtitle}
      </p>
    </div>
  );
}

export default function FormSignIn({
  messages: msg,
  authConfig,
  providerLabels,
  dividerText,
  samlLabels,
  callbackUrl,
  showRegisterLink,
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

  // Clicking the SSO button in the main list: if a team identifier is
  // needed, switch to the dedicated SSO screen to collect it; otherwise
  // sign in right away.
  const handleSamlButtonClick = useCallback(async () => {
    if (samlProvider?.teamSlugRequired) {
      setViewMode("sso");
      return;
    }
    await signInWithSaml(teamSlug);
  }, [samlProvider?.teamSlugRequired, teamSlug]);

  // Submitting the team identifier from the dedicated SSO screen.
  const handleSamlSubmit = useCallback(async () => {
    if (samlProvider?.teamSlugRequired && !teamSlug.trim()) {
      setTeamSlugError(samlLabels?.teamSlugRequired ?? "Team slug is required");
      return;
    }
    setTeamSlugError(undefined);
    await signInWithSaml(teamSlug);
  }, [teamSlug, samlProvider?.teamSlugRequired, samlLabels?.teamSlugRequired]);

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
            showRegisterLink={showRegisterLink}
          />
        </form>
      </>
    );
  }

  // If showing the dedicated SSO (team identifier) screen
  if (viewMode === "sso" && samlProvider && samlLabels) {
    return (
      <>
        <CardHeader title={msg.ssoTitle} subtitle={msg.ssoSubtitle} />
        <SignInSaml
          msg={msg}
          samlLabels={samlLabels}
          teamSlug={teamSlug}
          teamSlugError={teamSlugError}
          onTeamSlugChange={(value) => {
            setTeamSlug(value);
            if (teamSlugError) setTeamSlugError(undefined);
          }}
          onSubmit={handleSamlSubmit}
          pending={pending}
          setShowLogin={() => setViewMode("main")}
          showRegisterLink={showRegisterLink}
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

          {/* Render SAML/SSO button alongside the other providers */}
          {samlProvider && samlLabels && (
            <LoginButton
              provider={samlProvider}
              label={providerLabels[samlProvider.id] ?? samlProvider.name}
              onClick={handleSamlButtonClick}
            />
          )}

          {needsDivider && <LoginDivider text={dividerText} />}

          {/* Render credentials link and request-access link if configured */}
          {credentialsProvider && (
            <div className="flex flex-col items-center gap-2">
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

              <RegisterLink
                prompt={msg.requestAccessPrompt}
                label={msg.requestAccessLink}
                enabled={showRegisterLink}
              />
            </div>
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
                showRegisterLink={showRegisterLink}
              />
            )}
        </div>
      </form>
    </>
  );
}
