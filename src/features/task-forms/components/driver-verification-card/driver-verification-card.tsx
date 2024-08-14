import { Button, Card, Label, TextInput } from "flowbite-react";
import { TaskFormProps } from "../task-form/task-form.types";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import Link from "next/link";

export default function DriverVerificationCard({
  msg,
  task,
  lang,
}: TaskFormProps) {
  return (
    <Card>
      <form className="flex flex-col min-w-96 p-8 justify-center gap-9">
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
              name="serviceCode"
              placeholder={
                ((msg!.fields as I18nRecord).service as I18nRecord)
                  .placeholder as string
              }
              defaultValue={task.properties.mintral_serviceCode as number}
              type="text"
            />
          </div>
        </div>
        <div>
          <Button
            as={Link}
            href={`/${lang}/task/edit/${task.id}?step=step2`}
            color="blue"
            type="submit"
            theme={{ inner: { base: "px-5 py-3" } }}
            className="w-full px-0 py-px"
          >
            {(msg!.buttons as I18nRecord).submit as string}
          </Button>
        </div>
      </form>
    </Card>
  );
}
