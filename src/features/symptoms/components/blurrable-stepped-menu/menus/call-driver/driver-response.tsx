import { Textarea } from "flowbite-react";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { useState } from "react";
import TagManager from "@/features/symptoms/components/tag-manager";

export default function DriverResponse({
  dict,
  driverResponse,
  setDriverResponse,
}: {
  dict: I18nRecord;
  driverResponse: string;
  setDriverResponse: (driverResponse: string) => void;
}) {
  const [selectedTags, setSelectedTags] = useState<Array<{ text: string }>>([]);
  const [inputValue, setInputValue] = useState("");

  const handleTagCreate = () => {
    if (inputValue.trim()) {
      setSelectedTags([...selectedTags, { text: inputValue.trim() }]);
      setInputValue("");
    }
  };

  const handleTagRemove = (index: number) => {
    const newTags = selectedTags.filter((_, i) => i !== index);
    setSelectedTags(newTags);
  };

  const predefinedTags = [
    { text: "Ruta con problemas" },
    { text: "Conductor problemático" },
    { text: "Prueba" },
  ];

  return (
    <div className="h-full w-full flex flex-col items-center gap-2">
      <div className="w-full flex flex-col items-center gap-5 flex-grow">
        <div className="w-full flex flex-col gap-2">
          <h1 className="w-full text-left text-sm font-light justify-self-end text-gray-900 dark:text-white">
            {(dict.symptoms as I18nRecord).driver_response as string}
          </h1>
          <Textarea
            placeholder={
              (dict.symptoms as I18nRecord).message_to_the_driver as string
            }
            className="w-full h-32 text-gray-900 dark:text-white"
            defaultValue={driverResponse}
            onChange={(e) => setDriverResponse(e.target.value)}
          />

          <div className="w-full flex flex-col gap-2">
            <h2 className="text-sm font-light text-gray-900 dark:text-white">
              Tags
            </h2>
            <div className="flex flex-wrap gap-2 mb-2">
              {selectedTags.length > 0 && (
                <TagManager
                  tags={selectedTags.map((tag, index) => ({
                    text: tag.text,
                    icon: (
                      <button
                        onClick={() => handleTagRemove(index)}
                        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                      >
                        ×
                      </button>
                    ),
                  }))}
                  tag_style="bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              )}
            </div>

            <div className="flex gap-2 flex-wrap">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleTagCreate();
                  }
                }}
                placeholder="Ingresa un tag"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-blue-500 dark:focus:border-blue-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div className="flex flex-wrap gap-2 mt-2">
              {predefinedTags.map((tag, index) => (
                <button
                  key={index}
                  onClick={() => {
                    if (!selectedTags.some((t) => t.text === tag.text)) {
                      setSelectedTags([...selectedTags, tag]);
                    }
                  }}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-900 dark:text-white"
                >
                  {tag.text}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
