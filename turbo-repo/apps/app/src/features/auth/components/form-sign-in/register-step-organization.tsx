"use client";

import { useEffect, useState } from "react";
import { Label, TextInput, Tooltip } from "flowbite-react";
import Markdown from "react-markdown";
import { Controller } from "react-hook-form";
import type {
  Control,
  FieldErrors,
  UseFormRegister,
  UseFormSetValue,
  UseFormWatch,
} from "react-hook-form";
import {
  CheckCircle,
  ErrorCircle,
} from "@/features/task-forms/components/task-bento-form/components/driver/driver-validations";
import { MARKDOWN_COMPONENTS } from "@/features/dashboard/dashlets/common/settings-fields";
import type { RegisterFormMessages } from "./form-sign-in.types";
import {
  TEAM_NAME_REGEX,
  type RegisterSchema,
} from "./register-form.schema";
import BadgeSelectGroup from "./badge-select-group";
import BadgeMultiSelectGroup from "./badge-multi-select-group";
import CountryCombobox from "./country-combobox";
import PhoneInput from "./phone-input";
import {
  ORGANIZATION_SIZES,
  INDUSTRIES,
  INDUSTRY_OTHER,
  MONITORING_INTERESTS,
  MONITORING_INTEREST_OTHER,
} from "@/features/auth/constants/register-options.constants";
import { countryNameToCode } from "@/features/auth/utils/country-name-to-code";
import {
  failureBorderTheme,
  failureBorderClearTheme,
  withFailureBorderTheme,
} from "./failure-border-theme";

/** Lowercases and hyphenates free text into a team-name-shaped slug. */
function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

/** Reuses the same green-check/red-X circle used for driver validation
 * status elsewhere in the app, instead of a one-off icon. The X gets a
 * tooltip since "invalid" alone doesn't tell the user what to fix. */
function TeamNameIcon({
  isValid,
  invalidMessage,
}: Readonly<{ isValid: boolean; invalidMessage: string }>) {
  if (isValid) return <CheckCircle />;
  return (
    <Tooltip
      content={
        <div className="w-80 text-left text-xs">
          <Markdown components={MARKDOWN_COMPONENTS}>
            {invalidMessage}
          </Markdown>
        </div>
      }
      style="auto"
      // flowbite-react's `className`/`theme` merging is additive, not a
      // replace — the base theme's `dark:border-none` (from the "auto"
      // style) stuck around no matter what was layered on top of it,
      // `!important` included. `clearTheme` resets this specific leaf
      // first so the replacement below is the only thing left standing.
      clearTheme={{ style: true }}
      theme={{
        style: {
          auto: "border border-gray-400 bg-white text-gray-900 dark:border dark:border-gray-400 dark:bg-gray-700 dark:text-white",
        },
      }}
    >
      <ErrorCircle />
    </Tooltip>
  );
}

export default function RegisterStepOrganization({
  msg,
  register,
  control,
  watch,
  setValue,
  errors,
}: Readonly<{
  msg: RegisterFormMessages;
  register: UseFormRegister<RegisterSchema>;
  control: Control<RegisterSchema>;
  watch: UseFormWatch<RegisterSchema>;
  setValue: UseFormSetValue<RegisterSchema>;
  errors: FieldErrors<RegisterSchema>;
}>) {
  const organizationName = watch("organizationName");
  const teamName = watch("teamName");
  const isTeamNameValid = TEAM_NAME_REGEX.test(teamName || "");

  // Suggests the phone field's country from the location just picked above
  // it — e.g. picking "Chile" defaults the phone to +56. It's only a
  // starting point: react-phone-number-input won't reapply this once the
  // user has explicitly chosen a country of their own on the phone field,
  // or has started typing a number.
  const organizationLocation = watch("organizationLocation");
  const organizationPhoneDefaultCountry = organizationLocation
    ? countryNameToCode(organizationLocation)
    : undefined;

  // Live-syncs the team name from the organization name on every keystroke,
  // until the user types into the team name field themselves — at that
  // point we stop touching it for good, even if they clear it back to empty.
  const [teamNameEdited, setTeamNameEdited] = useState(false);

  useEffect(() => {
    if (!teamNameEdited) {
      // Not unconditionally `{ shouldValidate: true }`: that force-validates
      // on every keystroke (mount included, while it's still ""), which
      // fought the "only show errors once the user tries to continue"
      // behavior — the red border would show up before anyone had done
      // anything. But once teamName *has* a red border (from an earlier
      // failed attempt to continue), this sync is the only thing that ever
      // touches its value — without re-validating here too, typing more of
      // the organization name would never clear it even after the synced
      // slug becomes valid.
      //
      // `errors.teamName` is read but deliberately left out of the
      // dependency array: zodResolver hands back a new error object on
      // every validation pass even when the failure is unchanged, so
      // depending on it here — combined with `shouldValidate` triggering
      // exactly that revalidation — is a one-line infinite render loop.
      // Re-running this effect on every `organizationName` keystroke
      // already re-reads the current value each time, which is all this
      // needs.
      setValue("teamName", slugify(organizationName || ""), {
        shouldValidate: !!errors.teamName,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationName, teamNameEdited, setValue]);

  const teamNameField = register("teamName");

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex flex-col gap-y-2">
        <Label htmlFor="organization-name">{msg.organizationNameLabel}</Label>
        <TextInput
          id="organization-name"
          placeholder={msg.organizationNamePlaceholder}
          type="text"
          color={errors.organizationName ? "failure" : undefined}
          theme={failureBorderTheme}
          clearTheme={failureBorderClearTheme}
          {...register("organizationName")}
        />
      </div>

      <div className="flex flex-col gap-y-2">
        <Label htmlFor="team-name">
          {msg.teamNameLabel}{" "}
          <span className="font-normal text-gray-400">
            {msg.teamNameSsoLabel}
          </span>
        </Label>
        <div className="relative">
          {/* Not TextInput's `rightIcon` prop: that slot is hardcoded
              `pointer-events-none` (it's normally decoration-only), which
              would block hover from ever reaching the invalid-state
              tooltip below. flowbite-react's theme overrides only add
              classes, they can't strip an existing one, so there's no way
              to unset that through the `theme` prop either — positioning
              the icon manually is the only way to keep it hoverable. */}
          <TextInput
            id="team-name"
            placeholder={msg.teamNamePlaceholder}
            type="text"
            color={errors.teamName ? "failure" : undefined}
            theme={withFailureBorderTheme("pr-10")}
            clearTheme={failureBorderClearTheme}
            {...teamNameField}
            onChange={(e) => {
              setTeamNameEdited(true);
              teamNameField.onChange(e);
            }}
          />
          {teamName && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              <TeamNameIcon
                isValid={isTeamNameValid}
                invalidMessage={msg.teamNameInvalidMessage}
              />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-y-2 sm:col-span-1">
          <Label>{msg.organizationLocationLabel}</Label>
          <Controller
            name="organizationLocation"
            control={control}
            render={({ field }) => (
              <CountryCombobox
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                placeholder={msg.organizationLocationPlaceholder}
                noResultsLabel={msg.organizationLocationNoResults}
                invalid={!!errors.organizationLocation}
              />
            )}
          />
        </div>
        <div className="flex flex-col gap-y-2 sm:col-span-2">
          <Label htmlFor="organization-phone">
            {msg.organizationPhoneLabel}{" "}
            <span className="font-normal text-gray-400">
              {msg.optionalLabel}
            </span>
          </Label>
          <Controller
            name="organizationPhone"
            control={control}
            render={({ field }) => (
              <PhoneInput
                id="organization-phone"
                name={field.name}
                placeholder={msg.organizationPhonePlaceholder}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                defaultCountry={organizationPhoneDefaultCountry}
              />
            )}
          />
        </div>
      </div>

      <div className="flex flex-col gap-y-2">
        <Label>
          {msg.organizationSizeLabel}
          {errors.organizationSize && (
            <span className="text-red-500"> *</span>
          )}
        </Label>
        <Controller
          name="organizationSize"
          control={control}
          render={({ field }) => (
            <BadgeSelectGroup
              name={msg.organizationSizeLabel}
              options={ORGANIZATION_SIZES}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </div>

      <div className="flex flex-col gap-y-2">
        <Label>
          {msg.industryLabel}
          {errors.industry && <span className="text-red-500"> *</span>}
        </Label>
        <Controller
          name="industry"
          control={control}
          render={({ field }) => (
            <Controller
              name="industryOtherDetail"
              control={control}
              render={({ field: otherField }) => (
                <BadgeSelectGroup
                  name={msg.industryLabel}
                  options={INDUSTRIES}
                  value={field.value}
                  onChange={field.onChange}
                  otherOption={INDUSTRY_OTHER}
                  otherValue={otherField.value}
                  onOtherValueChange={otherField.onChange}
                  otherPlaceholder={msg.industryOtherPlaceholder}
                />
              )}
            />
          )}
        />
      </div>

      <div className="flex flex-col gap-y-2">
        <Label>
          {msg.monitoringInterestLabel}{" "}
          <span className="font-normal text-gray-400">
            {msg.optionalLabel}
          </span>
        </Label>
        <Controller
          name="monitoringInterest"
          control={control}
          render={({ field }) => (
            <Controller
              name="monitoringInterestOtherDetail"
              control={control}
              render={({ field: otherField }) => (
                <BadgeMultiSelectGroup
                  name={msg.monitoringInterestLabel}
                  options={MONITORING_INTERESTS}
                  value={field.value}
                  onChange={field.onChange}
                  otherOption={MONITORING_INTEREST_OTHER}
                  otherValue={otherField.value}
                  onOtherValueChange={otherField.onChange}
                  otherPlaceholder={msg.monitoringInterestOtherPlaceholder}
                />
              )}
            />
          )}
        />
      </div>
    </div>
  );
}
