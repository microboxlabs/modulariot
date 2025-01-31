import { Button, Label } from "flowbite-react";
import { FaCamera } from "react-icons/fa6";
import { FaRegFile } from "react-icons/fa";
import { RiFileChartLine } from "react-icons/ri";

export default function Download() {
  return (
    <div className="w-full flex flex-col gap-4">
      <Label className="w-full flex text-left text-lg">
        Elementos descargables
      </Label>
      <div className="w-full flex flex-col gap-2">
        <Button color="blue" className="flex align-middle justify-center">
          <FaCamera className="h-4 w-4 mr-2" /> Screenshot
        </Button>
        <Button color="blue" className="flex align-middle justify-center">
          <RiFileChartLine className="h-4 w-4 mr-2" /> Documento SVG
        </Button>
        <Button color="blue" className="flex align-middle justify-center">
          <FaRegFile className="h-4 w-4 mr-2" /> Otros
        </Button>
      </div>
    </div>
  );
}
