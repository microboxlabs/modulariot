import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { FaBook, FaPencilAlt, FaPlusCircle, FaTrashAlt } from "react-icons/fa";
import { FaClock, FaUser, FaTruck, FaMapPin } from "react-icons/fa6";
import { HiSearch } from "react-icons/hi";
import Tag from "../tag";
import { ListOptions } from "./list-options";

export default function TaskListTitle({
  dict,
  status,
  searchParams,
}: {
  dict: I18nRecord;
  status: string;
  searchParams: URLSearchParams;
}) {
  const TagsIcons = {
    service: HiSearch,
    status: FaClock,
    customer: FaUser,
    origin: FaMapPin,
    destination: FaMapPin,
    carrier: FaTruck,
    driver: FaUser,
  };
  const titleLabel = searchParams
    .toString()
    .split("&")
    .filter((filter) => filter.includes("titleLabel"))
    .join("&")
    .replace("titleLabel=", "");

  const tags = searchParams.toString()
    ? searchParams
        .toString()
        .split("&")
        .filter(
          (filter) =>
            !filter.includes("titleLabel") &&
            !filter.includes("position") &&
            !filter.includes("icon") &&
            !filter.includes("status")
        )
        .map((param) => {
          const [key, value] = param.split("=");
          return {
            key,
            value,
            icon: TagsIcons[key as keyof typeof TagsIcons],
          };
        })
    : [];

  let iconType = searchParams.get("icon");
  let icon = null;

  if (iconType) {
    switch (iconType.toLowerCase()) {
      case "book":
        icon = <FaBook className="h-4 w-4" />;
        break;
      case "clock":
        icon = <FaClock className="h-4 w-4" />;
        break;
      case "user":
        icon = <FaUser className="h-4 w-4" />;
        break;
      case "map-pin":
        icon = <FaMapPin className="h-4 w-4" />;
        break;
      case "truck":
        icon = <FaTruck className="h-4 w-4" />;
        break;
      case "search":
        icon = <HiSearch className="h-4 w-4" />;
        break;
      case "plus-circle":
        icon = <FaPlusCircle className="h-4 w-4" />;
        break;
      case "pencil-alt":
        icon = <FaPencilAlt className="h-4 w-4" />;
        break;
      case "trash-alt":
        icon = <FaTrashAlt className="h-4 w-4" />;
        break;
      default:
        icon = <FaBook className="h-4 w-4" />;
    }
  } else {
    icon = <FaBook className="h-4 w-4" />;
  }

  return (
    <div className="flex flex-row justify-between items-center p-2 bg-gray-200 dark:bg-gray-800 rounded-lg text-gray-900 dark:text-white">
      {/* Title */}
      <div className="flex flex-row items-center gap-2">
        <div className="text-gray-900 dark:text-white flex items-center justify-center transition-all duration-200  rounded-md w-10 h-10 p-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800">
          {/* <FaBook className="h-4 w-4" /> */}
          {icon}
        </div>
        {status === "finished"
          ? ((dict["myTasks"] as I18nRecord)["completed_tasks"] as string)
          : titleLabel
            ? titleLabel
            : ((dict["myTasks"] as I18nRecord)["pending_tasks"] as string)}
      </div>

      {/* Filters */}
      <div className="text-gray-600 dark:text-gray-400 flex flex-row items-center gap-2">
        Filtros
        {tags.map((tag) => (
          <Tag key={tag.key}>
            {tag.icon && <tag.icon />}
            {tag.value}
          </Tag>
        ))}
      </div>

      {/* Options */}
      <ListOptions />
    </div>
  );
}
