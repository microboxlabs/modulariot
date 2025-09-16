"use client";

"use client";

import { useRef, useState, useEffect } from "react";
import { FaArrowUp } from "react-icons/fa";
import TaskList from "./components/tasks";
import TaskListTitle from "./components/title/title";
import { I18nRecord } from "@/features/i18n/i18n.service.types";

export default function ClientContainer({ dict }: { dict: I18nRecord }) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const scrollToTop = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      if (scrollContainerRef.current) {
        const scrollTop = scrollContainerRef.current.scrollTop;
        setShowScrollButton(scrollTop > 100); // Show button after scrolling 100px
      }
    };

    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener("scroll", handleScroll);
      return () => scrollContainer.removeEventListener("scroll", handleScroll);
    }
  }, []);

  return (
    <div
      ref={scrollContainerRef}
      className="flex flex-col bg-white dark:bg-gray-900 p-2 gap-2 overflow-y-auto relative"
    >
      <TaskListTitle />
      <TaskList dict={dict} />

      {/* Scroll to top button - only visible when scrolled */}
      {showScrollButton && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-16 right-6 p-3 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg transition-all duration-200 z-10 opacity-90 hover:opacity-100"
          title="Scroll to top"
        >
          <FaArrowUp className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
