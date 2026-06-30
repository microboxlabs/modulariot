import CalendarIcon from "@/features/icons/calendar";
import ClipboardIcon from "@/features/icons/clipboard";
import HomeIcon from "@/features/icons/home";
import TruckIcon from "@/features/icons/truck";
import PeopleIcon from "@/features/icons/people";
import { SidebarItem } from "../types/common.types";
import FaBookIcon from "@/features/icons/FaBook";
import VideoCameraIcon from "@/features/icons/video-camera";
import { FaTruckLoading } from "react-icons/fa";
import { HiCog } from "react-icons/hi";
import { LuTowerControl } from "react-icons/lu";

// cpd-off — sidebar configuration data, structural repetition is intentional
export const pages: SidebarItem[] = [
  {
    icon: HomeIcon,
    label: "home",
    totals: {},
    dynamicItemsSource: "dashboards",
    searchable: true,
    createAction: { href: "/home", label: "createDashboard" },
    items: [],
    requiredGroups: ["GROUP_DASHBOARD"],
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
    // Three-way role split for the calendar feature (OR-evaluated):
    //  - GROUP_PLANNING        → slot/time changes, reassign, delete planning
    //  - GROUP_ASSIGNMENT      → carrier/driver/truck/trailer assignment
    //  - GROUP_CALENDAR_VIEWER → inspect-only; right-click a chip to open
    //    the sidebar in read-only mode. UI gating in
    //    features/calendar/components/planning + the matching backend gate
    //    in api/calendar/bookings/* enforce that viewers never mutate.
    requiredGroups: [
      "GROUP_ASSIGNMENT",
      "GROUP_PLANNING",
      "GROUP_CALENDAR_VIEWER",
    ],
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
    icon: LuTowerControl,
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
      {
        href: "/whatsapp/conversations",
        label: "conversations",
        totals: {},
        requiredGroups: [],
        blockedGroups: [],
      },
    ],

    totals: {},
    requiredGroups: [],
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
  {
    href: "/collaborators-management",
    icon: PeopleIcon,
    label: "collaboratorsManagement",
    totals: {},
    // Legacy group name kept for backward compat during the colaborator→collaborator
    // typo migration. Remove GROUP_COLABORATORS_MANAGEMENT once the Alfresco side
    // has been renamed (see Phase 6 of settings_module_multitenancy.plan.md).
    requiredGroups: [
      "GROUP_COLLABORATORS_MANAGEMENT",
      "GROUP_COLABORATORS_MANAGEMENT",
    ],
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
    href: "/where-is-my-load",
    icon: FaTruckLoading,
    label: "whereIsMyLoad",
    totals: {},
    requiredGroups: ["GROUP_MINTRAL_BUSCADOR_CARGAS"],
    blockedGroups: [], // Hide reports section from revisors
  },
  {
    icon: HiCog,
    label: "settings",
    items: [
      {
        href: "/users/settings/organizations",
        label: "organizations",
      },
      {
        href: "/users/settings/data-sources",
        label: "dataSources",
      },
    ],
    totals: {},
  },
];
// cpd-on
