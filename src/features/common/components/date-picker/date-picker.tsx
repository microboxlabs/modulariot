import { Datepicker } from "flowbite-react";

export default function DatePicker() {
  return (
    <Datepicker
      theme={{
        root: {
          base: "relative",
        },
        popup: {
          root: {
            base: "absolute top-10 z-50 block pt-2",
            inline: "relative top-0 z-auto",
            inner:
              "inline-block rounded-lg bg-white p-4 shadow-lg dark:bg-gray-700",
          },
        },
      }}
    />
  );
}
