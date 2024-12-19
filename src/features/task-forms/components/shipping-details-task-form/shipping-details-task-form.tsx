import "server-only";

import { getDictionary } from "@/features/i18n/i18n.service";
import { TaskFormProps } from "../task-form/task-form.types";
import { defaultLocale } from "@/features/i18n/tr.service";
import {
  Accordion,
  AccordionContent,
  AccordionPanel,
  Card,
  Label,
  Textarea,
} from "flowbite-react";
// import CheckIcon from "@/features/icons/CheckIcon";
import FormIcon from "@/features/icons/formIcon";
import TaskDetailsAccordionTitle from "../task-details-accordion-title/task-details-accordion-title";
import DetailsTextInput from "../details-text-input/details-text-input";
import TaskActions from "../task-actions/task-actions";
import { ShippingCoordinatorProcessForms } from "../../services/form.service.types";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { HiClipboardList } from "react-icons/hi";
import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import Validations from "../validations/validations";

export default async function ShippingDetailsTaskForm({
  task,
  lang,
}: TaskFormProps) {
  const [dict, dictionary] = await getDictionary(lang ?? defaultLocale);

  const detailsTitle = dict("layout.secured.sidebar.details", {
    serviceCode: task.mintral_serviceCode as string,
  });

  const cardsMsg = (
    (dictionary.pages as I18nRecord).transportValidationForm as I18nRecord
  ).cards as I18nRecord;

  const check1Subtitle = dict("layout.secured.sidebar.subtitle1", {
    serviceCode: task.mintral_serviceCode as string,
  });
  const check2Subtitle = dict("layout.secured.sidebar.subtitle2", {
    serviceCode: task.mintral_serviceCode as string,
  });
  const check3Subtitle = dict("layout.secured.sidebar.subtitle3", {
    serviceCode: task.mintral_serviceCode as string,
  });
  const check4Subtitle = dict("layout.secured.sidebar.subtitle4", {
    serviceCode: task.mintral_serviceCode as string,
  });

  return (
    <div className="px-4 pt-6">
      <Breadcrumb
        path={["my_tasks", "shipping", "details"]}
        lang={lang}
        rootIcon={<HiClipboardList className="mr-2 h-4 w-4" />}
        dict={dictionary.pages as I18nRecord}
      />
      <div className="pt-8">
        <Card
          theme={{
            root: {
              children: "flex h-full flex-col justify-center gap-4",
            },
          }}
        >
          <div className="pt-5 px-5 flex-wrap">
            <div className="flex flex-wrap justify-between">
              <small className="flex flex-1 items-center p-1 text-lg text-gray-800 font-semibold sm:text-xl lg:text-1xl xl:text-1xl">
                <FormIcon className="mr-3" />
                {detailsTitle}
              </small>
              <TaskActions
                taskId={task.id}
                taskType={task.taskFormKey as ShippingCoordinatorProcessForms}
                lang={lang}
                dict={
                  (dictionary.pages as I18nRecord)
                    .shippingDetailsTaskForm as I18nRecord
                }
              />
              <Validations
                task={task}
                lang={lang}
                msg={{
                  check1Subtitle,
                  check2Subtitle,
                  check3Subtitle,
                  check4Subtitle,
                  cards: cardsMsg,
                }}
              />
            </div>
          </div>

          <Accordion
            className="rounded-none"
            theme={{
              root: {
                base: "divide-y divide-gray-200 dark:divide-gray-700 rounded1111none",
              },
              content: {
                base: "p-5 dark:bg-gray-900",
              },
              title: {
                base: "flex w-full items-center justify-between px-5 py-4 text-left font-medium text-gray-500 first:rounded-t-lg last:rounded-b-lg dark:text-gray-400",
              },
            }}
          >
            <AccordionPanel>
              <TaskDetailsAccordionTitle
                title={dict("pages.shippingDetailsTaskForm.trip")}
              />
              <AccordionContent>
                <div className="flex flex-col gap-4 text-sm">
                  <div className="w-full font-semibold text-gray-600">
                    {dict("pages.shippingDetailsTaskForm.tripCreation")}
                  </div>
                  <div className="flex gap-4">
                    {/* serviceCode */}
                    <DetailsTextInput
                      name="serviceCode"
                      label={dict("pages.shippingDetailsTaskForm.serviceCode")}
                      value={task.mintral_serviceCode as string}
                    />
                    {/* serviceKind */}
                    <DetailsTextInput
                      name="serviceKind"
                      label={dict("pages.shippingDetailsTaskForm.serviceKind")}
                      value={task.mintral_serviceKind as string}
                    />
                  </div>
                  <div className="flex gap-4">
                    {/* creationDate */}
                    <DetailsTextInput
                      name="creationDate"
                      label={dict("pages.shippingDetailsTaskForm.creationDate")}
                      value={task.mintral_creationDate as string}
                      type="date"
                    />
                    {/* closureDate */}
                    <DetailsTextInput
                      name="closureDate"
                      label={dict("pages.shippingDetailsTaskForm.closureDate")}
                      value={task.mintral_closureDate as string}
                      type="date"
                    />
                  </div>
                  <div className="flex gap-4 w-1/2">
                    {/* approxTime */}
                    <DetailsTextInput
                      name="approxTime1"
                      label={dict("pages.shippingDetailsTaskForm.approxTime")}
                      value={task.mintral_approxTime as string}
                      type="time"
                    />
                  </div>

                  <div className="w-full font-semibold text-gray-600">
                    {dict("pages.shippingDetailsTaskForm.tripRoute")}
                  </div>

                  <div className="flex gap-4">
                    {/* distance */}
                    <DetailsTextInput
                      name="distance"
                      label={dict("pages.shippingDetailsTaskForm.distance")}
                      value={task.mintral_distance as string}
                      type="number"
                    />
                    {/* speed */}
                    <DetailsTextInput
                      name="speed"
                      label={dict("pages.shippingDetailsTaskForm.speed")}
                      value={task.mintral_speed as string}
                      type="number"
                    />
                  </div>

                  <div className="flex gap-4">
                    {/* originDelegateCode */}
                    <DetailsTextInput
                      name="originDelegateCode"
                      label={dict(
                        "pages.shippingDetailsTaskForm.originDelegateCode",
                      )}
                      value={task.mintral_originDelegateCode as string}
                    />
                    {/* destinationDelegateCode */}
                    <DetailsTextInput
                      name="destinationDelegateCode"
                      label={dict(
                        "pages.shippingDetailsTaskForm.destinationDelegateCode",
                      )}
                      value={task.mintral_destinationDelegateCode as string}
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionPanel>
            <AccordionPanel>
              <TaskDetailsAccordionTitle
                title={dict("pages.shippingDetailsTaskForm.drivers")}
              />
              <AccordionContent>
                <div className="flex flex-col gap-4 text-sm">
                  <div className="w-full font-semibold text-gray-600">
                    {dict("pages.shippingDetailsTaskForm.driver1")}
                  </div>
                  <div className="flex gap-4">
                    {/* driver1Name */}
                    <DetailsTextInput
                      name="driverName"
                      label={dict("pages.shippingDetailsTaskForm.driverName")}
                      value={task.mintral_driver1Name as string}
                    />
                    {/* driver1Rut */}
                    <DetailsTextInput
                      name="driverRut"
                      label={dict("pages.shippingDetailsTaskForm.driverRut")}
                      value={task.mintral_driver1Rut as string}
                    />
                  </div>
                  <div className="flex gap-4 w-1/2">
                    {/* driver1Phone */}
                    <DetailsTextInput
                      name="driverPhone"
                      label={dict("pages.shippingDetailsTaskForm.driverPhone")}
                      value={task.mintral_driver1Phone as string}
                      type="tel"
                    />
                  </div>
                  <div className="w-full font-semibold text-gray-600">
                    {dict("pages.shippingDetailsTaskForm.driver2")}
                  </div>
                  <div className="flex gap-4">
                    {/* driver2Name */}
                    <DetailsTextInput
                      name="driverName"
                      label={dict("pages.shippingDetailsTaskForm.driverName")}
                      value={task.mintral_driver2Name as string}
                    />
                    {/* driver2Rut */}
                    <DetailsTextInput
                      name="driverRut"
                      label={dict("pages.shippingDetailsTaskForm.driverRut")}
                      value={task.mintral_driver2Rut as string}
                    />
                  </div>
                  <div className="flex gap-4 w-1/2">
                    {/* driver2Phone */}
                    <DetailsTextInput
                      name="driverPhone"
                      label={dict("pages.shippingDetailsTaskForm.driverPhone")}
                      value={task.mintral_driver2Phone as string}
                      type="tel"
                    />
                  </div>
                  <div className="flex gap-4">
                    {/* supplierName */}
                    <DetailsTextInput
                      name="supplierName"
                      label={dict("pages.shippingDetailsTaskForm.supplierName")}
                      value={task.mintral_supplierName as string}
                    />
                    {/* transportNumberCode */}
                    <DetailsTextInput
                      name="transportNumberCode"
                      label={dict(
                        "pages.shippingDetailsTaskForm.transportNumberCode",
                      )}
                      value={task.mintral_transportNumberCode as string}
                    />
                  </div>
                  <div className="flex gap-4">
                    {/* truckLicensePlate */}
                    <DetailsTextInput
                      name="truckLicensePlate"
                      label={dict(
                        "pages.shippingDetailsTaskForm.truckLicensePlate",
                      )}
                      value={task.mintral_truckLicensePlate as string}
                    />
                    {/* trailerLicensePlate */}
                    <DetailsTextInput
                      name="trailerLicensePlate"
                      label={dict(
                        "pages.shippingDetailsTaskForm.trailerLicensePlate",
                      )}
                      value={task.mintral_trailerLicensePlate as string}
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionPanel>
            <AccordionPanel>
              <TaskDetailsAccordionTitle
                title={dict("pages.shippingDetailsTaskForm.clientInfo")}
              />
              <AccordionContent>
                <div className="w-full font-semibold text-gray-600">
                  {dict("pages.shippingDetailsTaskForm.clientInfo")}
                </div>
                <div className="flex gap-4">
                  {/* customerCode */}
                  <DetailsTextInput
                    name="customerCode"
                    label={dict("pages.shippingDetailsTaskForm.customerCode")}
                    value={task.mintral_customerCode as string}
                  />
                  {/* key */}
                  <DetailsTextInput
                    name="key"
                    label={dict("pages.shippingDetailsTaskForm.key")}
                    value={task.mintral_key as string}
                  />
                </div>
              </AccordionContent>
            </AccordionPanel>
            <AccordionPanel>
              <TaskDetailsAccordionTitle
                title={dict("pages.shippingDetailsTaskForm.observations")}
              />
              <AccordionContent>
                <div className="flex gap-4">
                  {/* observations */}
                  <div className="flex-1 flex flex-col gap-y-2">
                    <Label htmlFor="comments">
                      {dict("pages.shippingDetailsTaskForm.comments")}
                    </Label>
                    <Textarea
                      id="comments"
                      name="comments"
                      required
                      rows={4}
                      disabled={true}
                      defaultValue={task.mintral_observations as string}
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionPanel>
          </Accordion>
        </Card>
      </div>
    </div>
  );
}
