"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "flowbite-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "motion/react";
import { HiArrowLeft, HiArrowRight } from "react-icons/hi2";
import type { RegisterFormMessages } from "./form-sign-in.types";
import {
  registerSchema,
  organizationStepSchema,
  profileStepSchema,
  type RegisterSchema,
} from "./register-form.schema";
import RegisterProgress from "./register-progress";
import RegisterStepOrganization from "./register-step-organization";
import RegisterStepProfile from "./register-step-profile";
import RegisterStepVerification, {
  RegisterVerificationBackdrop,
} from "./register-step-verification";

type RegisterStep = "organization" | "profile" | "verification";

const FULL_FLOW: readonly RegisterStep[] = [
  "organization",
  "profile",
  "verification",
];
const NO_ORG_FLOW: readonly RegisterStep[] = ["profile", "verification"];

const BUTTON_SHAPE = "rounded-lg font-semibold";

export default function RegisterForm({
  msg,
  onBackToLogin,
  verificationEmailSearchUrl,
}: Readonly<{
  msg: RegisterFormMessages;
  /** Switches the parent card back to the sign-in view (register is a URL param, not a route) */
  onBackToLogin: () => void;
  /** Gmail search URL (pre-filtered by sender) opened by the "Ver correo" button; undefined skips opening Gmail. */
  verificationEmailSearchUrl?: string;
}>) {
  const searchParams = useSearchParams();

  // ?org=false drops the organization step from the flow entirely (e.g. for
  // invited users joining an existing org).
  const includeOrganization = searchParams.get("org") !== "false";
  const flow = includeOrganization ? FULL_FLOW : NO_ORG_FLOW;

  // Step is local React state, not derived from useSearchParams() on every
  // render: next/navigation's router.push/replace re-fetches and re-renders
  // the whole server-rendered page tree (Navbar/Footer/Card) on every call,
  // which caused a visible full-page "rerender" on each Next/Back click.
  // We still reflect the step in the URL (for deep-linking/refresh) via the
  // raw History API below, which updates the address bar without going
  // through Next's router at all. We read window.location.pathname (not
  // next/navigation's usePathname()) because this app runs behind
  // basePath: "/app" and usePathname() strips it, which would drop "/app"
  // from the address bar.
  const [step, setStep] = useState<RegisterStep>(() => {
    const requestedStep = searchParams.get("step") as RegisterStep | null;
    return requestedStep && flow.includes(requestedStep)
      ? requestedStep
      : flow[0];
  });

  const currentIndex = flow.indexOf(step);
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === flow.length - 1;
  const prevStep = flow[currentIndex - 1];
  const nextStep = flow[currentIndex + 1];

  function goToStep(next: RegisterStep) {
    setStep(next);
    const params = new URLSearchParams(window.location.search);
    params.set("view", "register");
    params.set("step", next);
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}?${params.toString()}`
    );
  }

  const {
    register,
    control,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<RegisterSchema>({
    resolver: zodResolver(registerSchema),
    mode: "onBlur",
  });

  // Only the fields required on a given step (i.e. not labeled "opcional")
  // block progress — optional fields don't, matching what the UI actually
  // marks as required.
  const STEP_FIELDS: Record<RegisterStep, (keyof RegisterSchema)[]> = {
    organization: Object.keys(
      organizationStepSchema.shape
    ) as (keyof RegisterSchema)[],
    profile: Object.keys(profileStepSchema.shape) as (keyof RegisterSchema)[],
    verification: [],
  };

  // The buttons stay enabled either way — clicking with something missing
  // doesn't navigate, it just validates (via RHF's `trigger`, which
  // populates `errors` for the fields checked) so the offending inputs can
  // show a red border, instead of leaving the user guessing why the button
  // won't respond.
  async function handleNext() {
    const fields = STEP_FIELDS[step];
    const valid = fields.length === 0 || (await trigger(fields));
    if (valid) goToStep(nextStep);
  }

  async function handleVerifyClick() {
    for (const s of flow.slice(0, -1)) {
      const fields = STEP_FIELDS[s];
      const valid = fields.length === 0 || (await trigger(fields));
      if (!valid) {
        // Jump back to the earliest step with something missing so its
        // now-populated errors are actually visible to fix.
        goToStep(s);
        return;
      }
    }
    // Everything's valid and we're already on the verification step —
    // hand off to Gmail, pre-filtered to the configured sender, so the
    // user doesn't have to hunt for the verification email themselves.
    if (verificationEmailSearchUrl) {
      window.open(verificationEmailSearchUrl, "_blank", "noopener,noreferrer");
    }
  }

  // Verification has no subtitle here: its one description lives in the
  // panel below (RegisterStepVerification), so it isn't shown twice.
  const stepHeaderByStep: Record<RegisterStep, { title: string; subtitle?: string }> = {
    organization: {
      title: msg.stepOrganizationTitle,
      subtitle: msg.stepOrganizationSubtitle,
    },
    profile: {
      title: msg.stepProfileTitle,
      subtitle: msg.stepProfileSubtitle,
    },
    verification: {
      title: msg.stepVerificationTitle,
    },
  };
  const header = stepHeaderByStep[step];

  function handleBack() {
    if (isFirst) {
      onBackToLogin();
      return;
    }
    goToStep(prevStep);
  }

  const isVerification = step === "verification";

  return (
    <div className="flex w-full flex-col">
      <div className="relative overflow-hidden p-6 sm:p-8 lg:p-10">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={
              isVerification
                ? "relative -m-6 overflow-hidden sm:-m-8 lg:-m-10"
                : undefined
            }
          >
            {isVerification && <RegisterVerificationBackdrop />}
            {!isVerification && (
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 lg:text-3xl dark:text-white">
                  {header.title}
                </h2>
                {header.subtitle && (
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {header.subtitle}
                  </p>
                )}
              </div>
            )}

            <form onSubmit={(e) => e.preventDefault()} autoComplete="off">
              {step === "organization" && (
                <RegisterStepOrganization
                  msg={msg}
                  register={register}
                  control={control}
                  watch={watch}
                  setValue={setValue}
                  errors={errors}
                />
              )}
              {step === "profile" && (
                <RegisterStepProfile msg={msg} register={register} errors={errors} />
              )}
              {step === "verification" && (
                <RegisterStepVerification msg={msg} email={watch("email")} />
              )}
            </form>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="rounded-b-2xl bg-gray-50 dark:bg-gray-900/40">
        <RegisterProgress
          currentStepIndex={currentIndex}
          totalSteps={flow.length}
          rounded={false}
        />

        <div className="flex items-center justify-between gap-3 p-4">
          <Button
            color="light"
            size="sm"
            type="button"
            onClick={handleBack}
            className={`w-1/3 ${BUTTON_SHAPE}`}
          >
            <span className="flex items-center gap-1.5">
              <HiArrowLeft className="h-3.5 w-3.5" />
              {msg.backLabel}
            </span>
          </Button>
          {isLast ? (
            <Button
              color="blue"
              size="sm"
              type="button"
              onClick={handleVerifyClick}
              className={`w-2/3 ${BUTTON_SHAPE}`}
            >
              {msg.verifyEmailLabel}
            </Button>
          ) : (
            <Button
              color="blue"
              size="sm"
              type="button"
              onClick={handleNext}
              className={`w-2/3 ${BUTTON_SHAPE}`}
            >
              <span className="flex items-center gap-1.5">
                {msg.nextLabel}
                <HiArrowRight className="h-3.5 w-3.5" />
              </span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
