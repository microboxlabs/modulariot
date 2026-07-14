import { z } from "zod";
import { isValidPhoneNumber } from "react-phone-number-input";
import {
  ORGANIZATION_SIZES,
  INDUSTRIES,
  MONITORING_INTERESTS,
} from "@/features/auth/constants/register-options.constants";

// PhoneInput (react-phone-number-input) stores E.164 values, e.g.
// "+14155552671" — validated against the actual national number length
// per country rather than a generic character pattern.
const phoneNumber = z.string().refine(isValidPhoneNumber, {
  message: "Invalid phone number",
});

// Lowercase alphanumeric with single hyphens between segments, e.g.
// "acme-labs" — no leading/trailing/doubled hyphens.
export const TEAM_NAME_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const registerSchema = z.object({
  organizationName: z.string().min(1),
  teamName: z.string().min(2).regex(TEAM_NAME_REGEX),
  organizationLocation: z.string().min(1),
  organizationPhone: z.union([phoneNumber, z.literal("")]).optional(),
  organizationSize: z.enum(ORGANIZATION_SIZES),
  industry: z.enum(INDUSTRIES),
  // Only meaningful when industry/monitoringInterest includes the "other"
  // badge — not validated as required even then, since asking someone to
  // elaborate on "Otro" isn't itself a required field in the UI.
  industryOtherDetail: z.string().optional(),
  monitoringInterest: z.array(z.enum(MONITORING_INTERESTS)).optional(),
  monitoringInterestOtherDetail: z.string().optional(),

  fullName: z.string().min(1),
  email: z.string().email(),
});

export type RegisterSchema = z.infer<typeof registerSchema>;

// Subsets of the full schema used to gate the "Next" button per step —
// only the fields required on that step (i.e. not labeled "opcional" in the
// UI). Optional fields are deliberately left out: their own constraints
// (e.g. organizationPhone still has to be a valid number if filled in)
// are enforced by `registerSchema` itself at submit time, not by this gate.
export const organizationStepSchema = registerSchema.pick({
  organizationName: true,
  teamName: true,
  organizationLocation: true,
  organizationSize: true,
  industry: true,
});

export const profileStepSchema = registerSchema.pick({
  fullName: true,
  email: true,
});
