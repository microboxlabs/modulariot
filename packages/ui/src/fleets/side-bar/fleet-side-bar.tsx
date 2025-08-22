import LabelledButton from "../../buttons/labelled-button";
import { GroupedPanelView, PanelItem } from "../../grouped-panel";
import React from "react";
import { useState } from "react";
import { ChevronLeft } from 'lucide-react';
import ExpandableButton from "../../buttons/expansible-button";
import Monitoring from "./menus/monitoring";

export default function FeetSideBar()  {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="absolute top-0 right-0 bottom-0 z-40 flex flex-row min-h-0">
            <div className="p-2">
                <LabelledButton
                    label={"Sidebar"}
                    open_to_left={true}
                    onClick={() => setIsOpen(!isOpen)}
                    hover_disabled={true}
                    border="border"
                >
                    <ChevronLeft className={` h-5 w-5 transition-all duration-300 ${isOpen ? "rotate-180" : "rotate-0"}`} />
                </LabelledButton>
            </div>
            <div
                className={`h-full w-fit bg-white dark:bg-slate-900 overflow-hidden transition-all duration-500 flex ${
                    isOpen ? "max-w-[500px]" : "max-w-0"
                }`}
                aria-hidden={!isOpen}
            >
                <GroupedPanelView
                    className="h-full w-fit flex flex-col flex-none min-h-0 p-2"
                    panelClassName="flex flex-col flex-1 min-h-0 overflow-auto gap-2"
                    actionsClassName="justify-between"
                >
                    <PanelItem actionText={"Monitoring"}>
                        <Monitoring />
                    </PanelItem>
                    <PanelItem actionText={"Symptoms"}>Symptoms</PanelItem>
                    <PanelItem actionText={"Download"}>Download</PanelItem>
                </GroupedPanelView>
            </div>
        </div>
    );
}