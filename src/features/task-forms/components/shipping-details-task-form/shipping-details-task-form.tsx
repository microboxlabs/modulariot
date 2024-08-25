import { getDictionary } from "@/features/i18n/i18n.service";
import { TaskFormProps } from "../task-form/task-form.types";
import { defaultLocale } from "@/features/i18n/tr.service";
import {
  Accordion,
  AccordionContent,
  AccordionPanel,
  AccordionTitle,
  Breadcrumb,
  BreadcrumbItem,
  Card,
  Label,
  TextInput,
} from "flowbite-react";
import ClipboardIcon from "@/features/icons/clipboard";
import TaskDetailsAccordionTitle from "../task-details-accordion-title/task-details-accordion-title";

export default async function ShippingDetailsTaskForm({
  task,
  lang,
}: TaskFormProps) {
  const [dict, _dictionary] = await getDictionary(lang ?? defaultLocale);
  console.log(task);
  const detailsTitle = dict("layout.secured.sidebar.details", {
    serviceCode: task.properties.mintral_serviceCode as string,
  });
  return (
    <div className="p-5">
      <Breadcrumb aria-label="Default breadcrumb example">
        <BreadcrumbItem
          href="#"
          icon={() => (
            <span className="pr-2.5">
              <ClipboardIcon />
            </span>
          )}
        >
          {dict("layout.secured.sidebar.my_tasks")}
        </BreadcrumbItem>
        <BreadcrumbItem href="#">
          {dict("layout.secured.sidebar.shipping")}
        </BreadcrumbItem>
        <BreadcrumbItem>{detailsTitle}</BreadcrumbItem>
      </Breadcrumb>

      <div className="pt-8">
        <Card
          theme={{
            root: {
              children: "flex h-full flex-col justify-center gap-4",
            },
          }}
        >
          <h1 className="pb-0 pt-5 px-5 dark:text-white">{detailsTitle}</h1>
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
              <TaskDetailsAccordionTitle title={dict("pages.shippingDetailsTaskForm.trip")} />
              <AccordionContent>
                <div className="flex flex-col gap-4 text-sm">
                  <div className="w-full font-semibold text-gray-600">
                    {dict("pages.shippingDetailsTaskForm.tripCreation")}
                  </div>
                  <div className="flex gap-4">
                    {/* serviceCode */}
                    <div className="flex-1 flex flex-col gap-y-2">
                      <Label htmlFor="serviceCode">{dict("pages.shippingDetailsTaskForm.serviceCode")}</Label>
                      <TextInput
                        id="serviceCode"
                        name="serviceCode"
                        type="text"
                        disabled={true}
                        defaultValue={task.properties.mintral_serviceCode as string}
                      />
                    </div>
                    {/* serviceKind */}
                    <div className="flex-1 flex flex-col gap-y-2">
                      <Label htmlFor="serviceKind">{dict("pages.shippingDetailsTaskForm.serviceKind")}</Label>
                      <TextInput
                        id="serviceKind"
                        name="serviceKind"
                        type="text"
                        disabled={true}
                        defaultValue={task.properties.mintral_serviceKind as string}
                      />
                    </div>
                  </div>
                  <div className="flex gap-4">
                    {/* creationDate */}
                    <div className="flex-1 flex flex-col gap-y-2">
                        <Label htmlFor="email">{dict("pages.shippingDetailsTaskForm.creationDate")}</Label>
                        <TextInput
                          id="creationDate"
                          name="creationDate"
                          type="date"
                          disabled={true}
                          defaultValue={task.properties.mintral_creationDate as string}
                        />
                    </div>
                    {/* closureDate */}
                    <div className="flex-1 flex flex-col gap-y-2">
                      <Label htmlFor="email">{dict("pages.shippingDetailsTaskForm.closureDate")}</Label>
                      <TextInput
                        id="closureDate"
                        name="closureDate"
                        type="text"
                        disabled={true}
                        defaultValue={task.properties.mintral_closureDate as string}
                      />
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-1/2 flex flex-col gap-y-2">
                      <Label htmlFor="approxTime">{dict("pages.shippingDetailsTaskForm.approxTime")}</Label>
                      <TextInput
                        id="approxTime"
                        name="approxTime"
                        type="time"
                        disabled={true}
                        defaultValue={task.properties.mintral_approxTime as string}
                      />
                    </div>
                  </div>

                  <div className="w-full font-semibold text-gray-600">
                    {dict("pages.shippingDetailsTaskForm.tripRoute")}
                  </div>

                  <div className="flex gap-4">
                    {/* distance */}
                    <div className="flex-1 flex flex-col gap-y-2">
                      <Label htmlFor="distance">{dict("pages.shippingDetailsTaskForm.distance")}</Label>
                      <TextInput
                        id="distance"
                        name="distance"
                        type="number"
                        disabled={true}
                        defaultValue={task.properties.mintral_distance as number}
                      />
                    </div>
                    {/* speed */}
                    <div className="flex-1 flex flex-col gap-y-2">
                      <Label htmlFor="speed">{dict("pages.shippingDetailsTaskForm.speed")}</Label>
                      <TextInput
                        id="speed"
                        name="speed"
                        type="text"
                        disabled={true}
                        defaultValue={task.properties.mintral_speed as string}
                      />
                    </div>
                  </div>

                  <div className="flex gap-4">
                    {/* originDelegateCode */}
                    <div className="flex-1 flex flex-col gap-y-2">
                      <Label htmlFor="originDelegateCode">{dict("pages.shippingDetailsTaskForm.originDelegateCode")}</Label>
                      <TextInput
                        id="originDelegateCode"
                        name="originDelegateCode"
                        type="number"
                        disabled={true}
                        defaultValue={task.properties.mintral_originDelegateCode as string}
                      />
                    </div>
                    {/* destinationDelegateCode */}
                    <div className="flex-1 flex flex-col gap-y-2">
                      <Label htmlFor="destinationDelegateCode">{dict("pages.shippingDetailsTaskForm.destinationDelegateCode")}</Label>
                      <TextInput
                        id="destinationDelegateCode"
                        name="destinationDelegateCode"
                        type="text"
                        disabled={true}
                        defaultValue={task.properties.mintral_destinationDelegateCode  as string}
                      />
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionPanel>
            <AccordionPanel>
              <TaskDetailsAccordionTitle title={dict("pages.shippingDetailsTaskForm.drivers")} />
              <AccordionContent>
                <p className="mb-2 text-gray-500 dark:text-gray-400">
                  Flowbite is first conceptualized and designed using the Figma
                  software so everything you see in the library has a design
                  equivalent in our Figma file.
                </p>
                <p className="text-gray-500 dark:text-gray-400">
                  Check out the
                  <a
                    href="https://flowbite.com/figma/"
                    className="text-cyan-600 hover:underline dark:text-cyan-500"
                  >
                    Figma design system
                  </a>
                  based on the utility classes from Tailwind CSS and components
                  from Flowbite.
                </p>
              </AccordionContent>
            </AccordionPanel>
            <AccordionPanel>
              <TaskDetailsAccordionTitle title={dict("pages.shippingDetailsTaskForm.clientInfo")} />
              <AccordionContent>
                <p className="mb-2 text-gray-500 dark:text-gray-400">
                  The main difference is that the core components from Flowbite
                  are open source under the MIT license, whereas Tailwind UI is
                  a paid product. Another difference is that Flowbite relies on
                  smaller and standalone components, whereas Tailwind UI offers
                  sections of pages.
                </p>
                <p className="mb-2 text-gray-500 dark:text-gray-400">
                  However, we actually recommend using both Flowbite, Flowbite
                  Pro, and even Tailwind UI as there is no technical reason
                  stopping you from using the best of two worlds.
                </p>
                <p className="mb-2 text-gray-500 dark:text-gray-400">
                  Learn more about these technologies:
                </p>
                <ul className="list-disc pl-5 text-gray-500 dark:text-gray-400">
                  <li>
                    <a
                      href="https://flowbite.com/pro/"
                      className="text-cyan-600 hover:underline dark:text-cyan-500"
                    >
                      Flowbite Pro
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://tailwindui.com/"
                      rel="nofollow"
                      className="text-cyan-600 hover:underline dark:text-cyan-500"
                    >
                      Tailwind UI
                    </a>
                  </li>
                </ul>
              </AccordionContent>
            </AccordionPanel>
            <AccordionPanel>
              <TaskDetailsAccordionTitle title={dict("pages.shippingDetailsTaskForm.observations")} />
              <AccordionContent>
                <p className="mb-2 text-gray-500 dark:text-gray-400">
                  The main difference is that the core components from Flowbite
                  are open source under the MIT license, whereas Tailwind UI is
                  a paid product. Another difference is that Flowbite relies on
                  smaller and standalone components, whereas Tailwind UI offers
                  sections of pages.
                </p>
                <p className="mb-2 text-gray-500 dark:text-gray-400">
                  However, we actually recommend using both Flowbite, Flowbite
                  Pro, and even Tailwind UI as there is no technical reason
                  stopping you from using the best of two worlds.
                </p>
                <p className="mb-2 text-gray-500 dark:text-gray-400">
                  Learn more about these technologies:
                </p>
                <ul className="list-disc pl-5 text-gray-500 dark:text-gray-400">
                  <li>
                    <a
                      href="https://flowbite.com/pro/"
                      className="text-cyan-600 hover:underline dark:text-cyan-500"
                    >
                      Flowbite Pro
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://tailwindui.com/"
                      rel="nofollow"
                      className="text-cyan-600 hover:underline dark:text-cyan-500"
                    >
                      Tailwind UI
                    </a>
                  </li>
                </ul>
              </AccordionContent>
            </AccordionPanel>
          </Accordion>
        </Card>
      </div>
    </div>
  );
}
