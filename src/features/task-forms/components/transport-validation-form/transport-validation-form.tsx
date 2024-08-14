import StepperNavigation from "@/features/layout/components/stepper-navigation/stepper-navigation";
import { TaskFormProps } from "../task-form/task-form.types";
import { Button, Card, Label, TextInput } from "flowbite-react";
import { tr } from "@/features/i18n/tr.service";

export default function TransportValidationForm({ task }: TaskFormProps) {
  return (
    <div className="flex-1 flex flex-col items-center gap-6">
      <StepperNavigation
        routePaths={["driverVerification", "driverVerified", "backToHome"]}
      />
      <Card>
        <form className="flex flex-col min-w-96 p-8 justify-center gap-9">
          <div className="flex flex-col">
            <h5 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              {tr("transportValidationForm.title", {})}
            </h5>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {tr("transportValidationForm.subtitle", {})}
            </p>
          </div>
          <div>
            <div className="flex flex-col gap-y-2">
              <Label htmlFor="email">
                {tr("transportValidationForm.subtitle", {})}
              </Label>
              <TextInput
                id="email"
                name="email"
                placeholder={tr("transportValidationForm.subtitle", {})}
                type="text"
              />
            </div>
          </div>
          <div>
            <Button
              color="blue"
              type="submit"
              theme={{ inner: { base: "px-5 py-3" } }}
              className="w-full px-0 py-px"
            >
              {tr("msg.buttonSubmitLabel", {})}
            </Button>
          </div>
        </form>
      </Card>
      <pre>{JSON.stringify(task, null, 2)}</pre>
    </div>
  );
}
