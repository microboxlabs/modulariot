"use client";

import { HiArrowRight } from "react-icons/hi";
import { Button } from "flowbite-react";
import BlurrableDropdown from "./components/blurrable-dropdown";
import SideInfoData from "./components/side-info-data";
import { useState } from "react";
import BlurrableSteppedMenu from "./components/blurrable-stepped-menu/blurrable-stepped-menu";

export default function SideInfo({ dict, lang }: { dict: any, lang: string }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="flex flex-col gap-5 p-10 h-full">
      <BlurrableSteppedMenu
        lang={lang}
        dict={dict}
        isMenuOpen={isMenuOpen}
        setIsMenuOpen={setIsMenuOpen}
        className={`${isMenuOpen ? "animate-show" : "animate-hide"}`}
      />
      <div className="flex flex-col h-[90%] overflow-y-auto">
        <SideInfoData dict={dict} lang={lang} />
      </div>
      <div className="flex flex-col justify-self-end">
        <Button.Group className="w-full">
          <BlurrableDropdown
            dict={dict}
            isMenuOpen={isMenuOpen}
            setIsMenuOpen={setIsMenuOpen}
          />
          <Button
            size="md"
            color="blue"
            className="h-10 rounded-l-none w-full"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {dict.symptoms.call_driver}
            <HiArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </Button.Group>
      </div>
    </div>
  );
}
