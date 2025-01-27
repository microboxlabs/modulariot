import { Label } from "flowbite-react";
import CustomDropdown from "./components/custom_dropdown";

export default function Monitoring() {
  return (
    <div className="w-full">
      <Label className="w-full text-left text-lg">General</Label>
      <CustomDropdown />
    </div>
  );
}
