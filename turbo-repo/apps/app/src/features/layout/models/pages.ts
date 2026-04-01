import CalendarIcon from "@/features/icons/calendar";
import ChartMixedIcon from "@/features/icons/chart-mixed";
import ClipboardIcon from "@/features/icons/clipboard";
import HomeIcon from "@/features/icons/home";
import TruckIcon from "@/features/icons/truck";
import PeopleIcon from "@/features/icons/people";
import { SidebarItem } from "../types/common.types";
import FaBookIcon from "@/features/icons/FaBook";
import VideoCameraIcon from "@/features/icons/video-camera";

// cpd-off — sidebar configuration data, structural repetition is intentional
export const pages: SidebarItem[] = [
  {
    icon: HomeIcon,
    label: "home",
    totals: {},
    dynamicItemsSource: "dashboards",
    items: [
      {
        href: "/home",
        label: "dashboardOverview",
        requiredGroups: ["GROUP_DASHBOARD"],
      },
    ],
    requiredGroups: ["GROUP_DASHBOARD"],
  },
  {
    href: "/colaborators-management",
    icon: PeopleIcon,
    label: "colaboratorsManagement",
    totals: {},
    requiredGroups: ["GROUP_FLEET_MANAGEMENT"],
    blockedGroups: [],
  },
  {
    href: "/fleet-management",
    icon: TruckIcon,
    label: "fleetManagement",
    totals: {},
    requiredGroups: ["GROUP_FLEET_MANAGEMENT"],
    blockedGroups: [],
  },
  {
    icon: CalendarIcon,
    label: "calendar",
    dynamicItemsSource: "calendars",
    items: [
      {
        href: "/calendar",
        label: "calendarOverview",
      },
    ],
    totals: {},
    requiredGroups: ["GROUP_ASSIGNMENT", "GROUP_PLANNING"],
  },
  {
    icon: ClipboardIcon,
    label: "kanban",
    items: [
      // {
      //   href: "/warehouse",
      //   label: "werehouse",
      //   totals: {},
      // },
      // {
      //   href: "/logistics",
      //   label: "logistics",
      //   totals: {},
      // },
      {
        href: "/planning",
        label: "planning",
        totals: {},
      },
      {
        href: "/shipping",
        label: "shipping",
        totals: {},
        requiredGroups: [
          "GROUP_MINTRAL_KANBAN_ACCESS",
          "GROUP_GAMA_KANBAN_ACCESS",
        ],
      },
      /* {
        href: "/shippingv1",
        label: "shippingv1",
        totals: {},
        requiredGroups: [],
      }, */
      {
        href: "/delivery",
        label: "delivery",
        totals: {},
        requiredGroups: [],
      },
      {
        href: "/finished",
        label: "finished",
        totals: {},
        requiredGroups: [],
      },
      // {
      //   href: "/others",
      //   label: "others",
      //   totals: {},
      // },
    ],
    totals: {},
    requiredGroups: ["GROUP_MINTRAL_KANBAN_ACCESS", "GROUP_GAMA_KANBAN_ACCESS"],
  },
  {
    icon: FaBookIcon,
    label: "tasks",
    dynamicItemsSource: "tasks",
    items: [
      /* {
        href: "/mytasks?status=pending",
        label: "pending_tasks",
        totals: {},
      }, */
      {
        href: "/mytasks?status=finished",
        label: "completed_tasks",
        totals: {},
      },
      {
        href: "/mytasks?status=pending",
        label: "pending_tasks",
        totals: {},
      },
    ],
    totals: {},
    requiredGroups: ["GROUP_MINTRAL_KANBAN_ACCESS", "GROUP_GAMA_KANBAN_ACCESS"],
    blockedGroups: ["GROUP_MINTRAL_REVISOR"], // Hide "My Tasks" from revisors
  },
  {
    href: "/reports",
    icon: ChartMixedIcon,
    label: "controlTower",

    items: [
      {
        href: "/geographic-view",
        label: "geographicView",
        totals: {},
        requiredGroups: [], //"GROUP_MINTRAL_EJECUTIVO_TORRE_CONTROL"
        blockedGroups: [], // Hide from revisors
      },
      {
        href: "/symptoms",
        label: "symptoms",
        totals: {},
        requiredGroups: [],
        blockedGroups: ["GROUP_MINTRAL_REVISOR"], // Hide from revisors
      },
      {
        href: "/signal-history",
        label: "signalHistory",
        totals: {
          totals: 10,
        },
        requiredGroups: [],
        blockedGroups: [], // Allow access for MINTRAL_REVISOR
      },
    ],

    totals: {},
    requiredGroups: [],
    blockedGroups: [], // Hide reports section from revisors
  },
  {
    href: "/where-is-my-load",
    icon: ChartMixedIcon,
    label: "whereIsMyLoad",
    totals: {},
    requiredGroups: ["GROUP_MINTRAL_BUSCADOR_CARGAS"],
    blockedGroups: [], // Hide reports section from revisors
  },
  {
    icon: VideoCameraIcon,
    label: "liveStreams",
    items: [
      {
        href: "/live-streams/facility-scl",
        label: "facilitySCL",
        totals: {},
      },
      {
        href: "/live-streams/truck-beds",
        label: "truckBeds",
        totals: {},
      },
      {
        href: "/live-streams/devices",
        label: "allDevices",
        totals: {},
      },
    ],
    totals: {},
    requiredGroups: ["GROUP_ALFRESCO_ADMINISTRATORS"],
  },
];
// cpd-on
