import { Label, TextInput } from "flowbite-react";
import { DetailsTextInputProps } from "./details-text-input.types";

export default function DetailsTextInput({
  name,
  label,
  value,
  diabled = true,
  type = "text",
}: DetailsTextInputProps) {
  return (
    <div className="flex-1 flex flex-col gap-y-2">
      <Label htmlFor={name}>{label}</Label>
      <TextInput
        id={name}
        name={name}
        type={type}
        disabled={diabled}
        defaultValue={value}
      />
    </div>
  );
}
