import ExpandableButton from "../../../buttons/expansible-button"
import { RefreshCw, Truck, Atom } from 'lucide-react';


const test_data = [
    {
        title: "Services",
        icon: <RefreshCw />,
        items: [
            {
            key: "Trips",
            value: 0,
            },
            {
            key: "Emergencies",
            value: 0,
            },
            {
            key: "In Transit",
            value: 0,
            },
            {
            key: "In Destination",
            value: 0,
            },
            {
            key: "Monitoring Hours",
            value: 0,
            },
            {
            key: "Monitored Distance",
            value: 0,
            },
        ],
    },
    {
        title: "Fleets",
        icon: <Truck />,
        items: [
            {
            key: "Asset Monitored",
            value: 0,
            },
            {
            key: "Vehicles" as string,
            value: 0,
            },
            {
            key: "Vehicle Signal Quality",
            value: 0,
            },
            {
            key: "Vehicle Signal Delay",
            value: 0,
            },
            {
            key: "Containers",
            value: 0,
            },
            {
            key: "Drivers",
            value: 0,
            },
        ],
    },
    {
        title: "Symptoms",
        icon: <Atom />,
        items: [
            {
            key: "Stable",
            value: 0,
            },
            {
            key: "In Observation",
            value: 0,
            },
            {
            key: "Compromised",
            value: 0,
            },
            {
            key: "Critical",
            value: 0,
            },
            {
            key: "Black Code",
            value: 0,
            },
        ],
    },
]

export default function Monitoring() {
    return (<div
        className="w-full h-full overflow-y-auto flex flex-col gap-2"
      >
        {test_data.map((section: any) => (
          <ExpandableButton
            key={section.title}
            initial_state={true}
            icon={section.icon}
            title={section.title}
            description=""
            withBorder={true}
          >
            <div className="w-full flex flex-col gap-1 text-xs font-normal text-gray-900">
              {section.items.map((item: any) => (
                <p
                  className="text-gray-900 dark:text-white first-letter:capitalize"
                  key={item.key}
                >
                  {item.key}:{" "}
                  <span className="text-gray-500 dark:text-gray-400">
                    {item.value}
                  </span>
                </p>
              ))}
            </div>
          </ExpandableButton>
        ))}
      </div>);
}