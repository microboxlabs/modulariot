import { Button, Card, Label, TextInput } from "flowbite-react";
import { TaskFormProps } from "../task-form/task-form.types";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { useRouter } from "next/navigation";

// Define the Zod schema
const schema = z.object({
  serviceCode: z
    .union([z.string(), z.number()])
    .refine((val) => val !== "" && val !== 0, {
      message: "Service code is required",
    })
    .transform((val) => val.toString()),
});

type FormData = z.infer<typeof schema>;

export default function DriverVerificationCard({
  msg,
  task,
  lang,
}: TaskFormProps) {
  const [error /* setError */] = useState<string | null>(null);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      serviceCode: (task.mintral_serviceCode as string) || "",
    },
  });

  const onSubmit = (/* data: FormData */) => {
    // more logic here
    router.push(
      `/${lang}/task/edit/${task.id.replace("activiti$", "")}?step=step2`,
    );
  };

  return (
    <Card>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col min-w-96 p-8 justify-center gap-9"
      >
        <div className="flex flex-col">
          <h5 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            {msg!.title as string}
          </h5>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {msg!.subtitle as string}
          </p>
        </div>
        <div>
          <div className="flex flex-col gap-y-2">
            <Label htmlFor="serviceCode">
              {
                ((msg!.fields as I18nRecord).service as I18nRecord)
                  .label as string
              }
            </Label>
            <TextInput
              id="serviceCode"
              {...register("serviceCode")}
              placeholder={
                ((msg!.fields as I18nRecord).service as I18nRecord)
                  .placeholder as string
              }
              type="text"
            />
            {errors.serviceCode && (
              <p className="text-red-500 text-sm mt-1">
                {errors.serviceCode.message}
              </p>
            )}
          </div>
        </div>
        <div>
          <Button
            color="blue"
            type="submit"
            theme={{ inner: { base: "px-5 py-3" } }}
            className="w-full px-0 py-px"
          >
            {(msg!.buttons as I18nRecord).submit as string}
          </Button>
        </div>
        {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
      </form>
    </Card>
  );
}
