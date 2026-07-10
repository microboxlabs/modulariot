"use client";

import { useEffect, useState } from "react";
import type { ComponentProps } from "react";
import { Label, TextInput, Dropdown, DropdownItem } from "flowbite-react";
import { Controller } from "react-hook-form";
import type {
  Control,
  UseFormRegister,
  UseFormSetValue,
  UseFormWatch,
} from "react-hook-form";
import { HiChevronDown, HiCheckCircle, HiXCircle } from "react-icons/hi2";
import { twMerge } from "tailwind-merge";
import type { RegisterFormMessages } from "./form-sign-in.types";
import {
  TEAM_NAME_REGEX,
  type RegisterSchema,
} from "./register-form.schema";
import BadgeSelectGroup from "./badge-select-group";
import BadgeMultiSelectGroup from "./badge-multi-select-group";
import PhoneInput from "./phone-input";
import {
  ORGANIZATION_SIZES,
  INDUSTRIES,
  MONITORING_INTERESTS,
} from "@/features/auth/constants/register-options.constants";
import { COUNTRIES } from "@/features/auth/constants/countries.constants";

/** Lowercases and hyphenates free text into a team-name-shaped slug. */
function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function RegisterStepOrganization({
  msg,
  register,
  control,
  watch,
  setValue,
}: Readonly<{
  msg: RegisterFormMessages;
  register: UseFormRegister<RegisterSchema>;
  control: Control<RegisterSchema>;
  watch: UseFormWatch<RegisterSchema>;
  setValue: UseFormSetValue<RegisterSchema>;
}>) {
  const organizationName = watch("organizationName");
  const teamName = watch("teamName");
  const isTeamNameValid = TEAM_NAME_REGEX.test(teamName || "");

  // Live-syncs the team name from the organization name on every keystroke,
  // until the user types into the team name field themselves — at that
  // point we stop touching it for good, even if they clear it back to empty.
  const [teamNameEdited, setTeamNameEdited] = useState(false);

  useEffect(() => {
    if (!teamNameEdited) {
      setValue("teamName", slugify(organizationName || ""), {
        shouldValidate: true,
      });
    }
  }, [organizationName, teamNameEdited, setValue]);

  const teamNameField = register("teamName");

  function TeamNameIcon(props: ComponentProps<"svg">) {
    return isTeamNameValid ? (
      <HiCheckCircle {...props} className={twMerge(props.className, "text-green-500")} />
    ) : (
      <HiXCircle {...props} className={twMerge(props.className, "text-red-500")} />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex flex-col gap-y-2">
        <Label htmlFor="organization-name">{msg.organizationNameLabel}</Label>
        <TextInput
          id="organization-name"
          placeholder={msg.organizationNamePlaceholder}
          type="text"
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
        <TextInput
          id="team-name"
          placeholder={msg.teamNamePlaceholder}
          type="text"
          rightIcon={teamName ? TeamNameIcon : undefined}
          {...teamNameField}
          onChange={(e) => {
            setTeamNameEdited(true);
            teamNameField.onChange(e);
          }}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-y-2 sm:col-span-1">
          <Label>{msg.organizationLocationLabel}</Label>
          <Controller
            name="organizationLocation"
            control={control}
            render={({ field }) => (
              <Dropdown
                label=""
                dismissOnClick
                renderTrigger={() => (
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-left text-sm text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  >
                    <span className={field.value ? "" : "text-gray-400"}>
                      {field.value || msg.organizationLocationPlaceholder}
                    </span>
                    <HiChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
                  </button>
                )}
                className="max-h-64 overflow-y-auto"
              >
                {COUNTRIES.map((country) => (
                  <DropdownItem
                    key={country}
                    onClick={() => field.onChange(country)}
                  >
                    {country}
                  </DropdownItem>
                ))}
              </Dropdown>
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
          <PhoneInput
            id="organization-phone"
            placeholder={msg.organizationPhonePlaceholder}
            {...register("organizationPhone")}
          />
        </div>
      </div>

      <div className="flex flex-col gap-y-2">
        <Label>{msg.organizationSizeLabel}</Label>
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
        <Label>{msg.industryLabel}</Label>
        <Controller
          name="industry"
          control={control}
          render={({ field }) => (
            <BadgeSelectGroup
              name={msg.industryLabel}
              options={INDUSTRIES}
              value={field.value}
              onChange={field.onChange}
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
            <BadgeMultiSelectGroup
              name={msg.monitoringInterestLabel}
              options={MONITORING_INTERESTS}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </div>
    </div>
  );
}
