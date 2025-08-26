import { Download } from 'lucide-react';
import CustomBaseButton from "../../../../buttons/custom-base-button";
import Screenshot from "./actions/screenshot/screenshot";


export default function DownloadTab() {
    return (
        <div className="flex flex-col gap-2 w-full overflow-visible">
            <Screenshot />
            <CustomBaseButton>
                <Download className="h-4 w-4 mr-2"/>
                Download
            </CustomBaseButton>
        </div>
    )
}