import { z } from "zod";
import {
  ORGANIZATION_SIZES,
  INDUSTRIES,
  MONITORING_INTERESTS,
} from "@/features/auth/constants/register-options.constants";

// Digits, spaces, parentheses, hyphens and a leading "+" — matches what
// PhoneInput lets the user type.
const phoneNumber = z.string().regex(/^[\d+\-() ]+$/);

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
  monitoringInterest: z.array(z.enum(MONITORING_INTERESTS)).optional(),

  fullName: z.string().min(1),
  email: z.string().email(),
  phone: phoneNumber.min(1),
});

export type RegisterSchema = z.infer<typeof registerSchema>;
