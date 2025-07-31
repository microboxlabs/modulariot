import { Button, Dropdown } from "flowbite-react";
import { useState, useEffect, useRef } from "react";
import { HiChevronDown } from "react-icons/hi";

export default function SelectorDropdown({
  categories,
  selectCategory = () => {},
  baseCategory = null,
}: {
  categories: { value: string; label: string }[];
  selectCategory?: (category: string) => void;
  baseCategory?: string | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    baseCategory,
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
    setSelectedCategory(baseCategory);
  }, [baseCategory]);

  return (
    <div ref={dropdownRef}>
      <Dropdown
        label="Opciones"
        theme={{
          content: "w-full",
          floating: {
            base: "overflow-hidden rounded-lg z-10",
            item: {
              container: "w-full ",
            },
            style: {
              auto: "border border-gray-200 dark:border-gray-500 bg-white text-gray-900 dark:bg-gray-700 dark:text-white",
            },
          },
        }}
        renderTrigger={() => (
          <Button
            theme={{
              size: {
                md: "h-5 px-2 text-sm",
              },
            }}
            color="gray"
            className="flex flex-row items-center justify-center gap-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white p-2 rounded-lg text-sm font-light cursor-pointer w-full border border-gray-200 dark:border-gray-500 hover"
          >
            <div
              className="flex flex-row items-center justify-center gap-2"
              onClick={() => setIsOpen(!isOpen)}
            >
              {selectedCategory ? (
                <span className="text-sm font-light">{selectedCategory}</span>
              ) : (
                <span className="text-sm font-light">
                  Selecciona una categoría
                </span>
              )}
              <HiChevronDown
                className={`w-5 h-5 transition-transform ease-in-out duration-300 ${isOpen ? "rotate-180" : "rotate-0"}`}
              />
            </div>
          </Button>
        )}
        className="w-full"
        style={{ width: "100%" }}
      >
        {categories.map((category) => (
          <Dropdown.Item
            key={category.value}
            onClick={() => {
              setSelectedCategory(category.label);
              selectCategory(category.value);
            }}
          >
            {category.label}
          </Dropdown.Item>
        ))}
      </Dropdown>
    </div>
  );
}
