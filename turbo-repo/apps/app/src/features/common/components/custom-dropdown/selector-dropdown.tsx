import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { Button, Dropdown, DropdownItem } from "flowbite-react";
import { useState, useEffect, useRef } from "react";
import { HiChevronDown } from "react-icons/hi";

export default function SelectorDropdown({
  categories,
  selectCategory = () => {},
  baseCategory = null,
  disabled = false,
  dictionary,
  fitWidth = false,
  triggerClassName,
}: {
  categories: { value: string; label: string }[];
  selectCategory?: (category: string) => void;
  baseCategory?: string | null;
  disabled?: boolean;
  dictionary: I18nRecord;
  fitWidth?: boolean;
  triggerClassName?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<{
    value: string;
    label: string;
  } | null>(
    categories.find((category) => category.value === baseCategory) || null
  );
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    setSelectedCategory(
      categories.find((category) => category.value === baseCategory) || null
    );
  }, [baseCategory]);

  return (
    <div ref={dropdownRef} className={fitWidth ? "w-fit" : undefined}>
      <Dropdown
        label="Opciones"
        theme={{
          content: fitWidth ? "" : "w-full",
          floating: {
            base: "overflow-hidden rounded-lg z-10",
            item: {
              container: fitWidth ? "" : "w-full ",
            },
            style: {
              auto: "border border-gray-200 dark:border-gray-500 bg-white text-gray-900 dark:bg-gray-700 dark:text-white",
            },
          },
        }}
        renderTrigger={() => (
          <Button
            color="alternative"
            className={`flex flex-row items-center justify-center gap-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white p-2 rounded-lg text-sm font-light cursor-pointer border border-gray-200 dark:border-gray-500 hover ${fitWidth ? "w-fit" : "w-full"} ${triggerClassName ?? ""}`}
            disabled={disabled}
          >
            <a
              href="#"
              className="flex flex-row items-center justify-center gap-2"
              onClick={(e) => {
                e.preventDefault();
                setIsOpen(!isOpen);
              }}
            >
              {selectedCategory ? (
                <span className="text-sm font-light">
                  {selectedCategory?.label}
                </span>
              ) : (
                <span className="text-sm font-light">
                  {tr("bento.multimedia.select_document_type", dictionary)}
                </span>
              )}
              <HiChevronDown
                className={`w-5 h-5 transition-transform ease-in-out duration-300 ${isOpen ? "rotate-180" : "rotate-0"}`}
              />
            </a>
          </Button>
        )}
        className={fitWidth ? "w-fit" : "w-full"}
        style={fitWidth ? undefined : { width: "100%" }}
      >
        {categories.map((category) => (
          <DropdownItem
            key={category.value}
            onClick={() => {
              setSelectedCategory(category);
              selectCategory(category.value);
            }}
          >
            {category.label}
          </DropdownItem>
        ))}
      </Dropdown>
    </div>
  );
}
