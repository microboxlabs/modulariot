import { Download } from "flowbite-react-icons/outline";
import { Button } from "flowbite-react";

/* isProcessing={pending && _state.success == undefined}
      aria-disabled={pending && _state.success == undefined}
      onClick={onSubmitForm} */
export default function DownloadSignedDocument() {
  return (
    <div className="flex items-center justify-center rounded-lg px-3 text-sm font-medium h-7">
      <Button
        outline
        color="blue"
        theme={{ inner: { base: "px-5 py-3" } }}
        size="xs"
        className="w-full px-0 py-px submit"
      >
        {/* <DownloadIcon className="mr-1 h-4 w-4 text-primary-700" /> */}
        <Download className="mr-1 h-4 w-4 text-primary-700" />
      </Button>
    </div>
  );
}
