import { Button, Label } from "flowbite-react";
import { FaCamera } from "react-icons/fa6";
import { FaRegFile } from "react-icons/fa";
import { RiFileChartLine } from "react-icons/ri";
import { I18nRecord } from "@/features/i18n/i18n.service.types";

export default function Download({ dict }: { dict: I18nRecord }) {
  return (
    <div className="w-full flex flex-col gap-4">
      <Label className="w-full flex text-left text-lg">
        {(dict.symptoms as I18nRecord).downloadable_elements as string}
      </Label>
      <div className="w-full flex flex-col gap-2">
        <Button color="blue" className="flex align-middle justify-center">
          <FaCamera className="h-4 w-4 mr-2" />{" "}
          {(dict.symptoms as I18nRecord).screenshot as string}
        </Button>
        <Button color="blue" className="flex align-middle justify-center">
          <RiFileChartLine className="h-4 w-4 mr-2" />
          {(dict.symptoms as I18nRecord).svg_document as string}
        </Button>
        <Button color="blue" className="flex align-middle justify-center">
          <FaRegFile className="h-4 w-4 mr-2" />{" "}
          {(dict.symptoms as I18nRecord).other as string}
        </Button>
      </div>
    </div>
  );
}
