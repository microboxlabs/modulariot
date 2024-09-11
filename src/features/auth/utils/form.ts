import { z } from "zod";

export const formSchema = z.object({
  email: z
    .string({ message: "Email is required" })
    .email("Invalid email address"),
  password: z
    .string()
    .min(8, "Description should be at least 10 characters long"),
});

export type FormSchema = z.infer<typeof formSchema>;
