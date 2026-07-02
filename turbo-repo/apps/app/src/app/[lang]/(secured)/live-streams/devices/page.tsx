import { ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { getDictionary } from "@/features/i18n/i18n.service";
import { FaVideo } from "react-icons/fa";
import { AllDevicesView } from "@/features/live-streams/components/all-devices-view";
import { StreamDevice } from "@/features/live-streams/types/device.types";
import { SectionHeader } from "@/features/layout/components/section-header/section-header";

const MOCK_DEVICES: StreamDevice[] = [
  { id: "cam-001", name: "Dock A - Entry", location: "facility-scl", status: "live" },
  { id: "cam-002", name: "Dock A - Loading Bay", location: "facility-scl", status: "live" },
  { id: "cam-003", name: "Dock B - Entry", location: "facility-scl", status: "offline", lastSeen: "2 hours ago" },
  { id: "cam-004", name: "Warehouse - Section 1", location: "facility-scl", status: "live" },
  { id: "cam-005", name: "Warehouse - Section 2", location: "facility-scl", status: "offline", lastSeen: "1 day ago" },
  { id: "truck-001", name: "Truck ABC-123", location: "truck-bed", status: "live" },
  { id: "truck-002", name: "Truck DEF-456", location: "truck-bed", status: "offline", lastSeen: "30 min ago" },
  { id: "truck-003", name: "Truck GHI-789", location: "truck-bed", status: "live" },
];

export default async function AllDevicesPage({ params }: ParamsWithLang) {
  const { lang } = await params;
  const [, dict] = await getDictionary(lang);

  return (
    <div className="h-full w-full flex flex-col">
      <SectionHeader
        path={["liveStreams", "allDevices"]}
        lang={lang}
        rootIcon={<FaVideo className="mr-2 h-4 w-4" />}
        breadcrumbDict={dict["layout"]?.["secured"]?.["sidebar"] ?? {}}
        filterDict={dict}
      />
      <div className="flex-1 p-5 pt-0 overflow-hidden max-w-screen-2xl mx-auto w-full">
        <AllDevicesView devices={MOCK_DEVICES} lang={lang} dict={dict.liveStreams} />
      </div>
    </div>
  );
}
