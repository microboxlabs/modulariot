import LabelledButton from "../../buttons/labelled-button";
import { GroupedPanelView, PanelItem } from "../../grouped-panel";
import React from "react";
import { useState } from "react";
import { ChevronLeft } from 'lucide-react';
import ExpandableButton from "../../buttons/expansible-button";
import Monitoring from "./menus/monitoring";
import DownloadTab from "./menus/download/download";
import Symptoms from "./menus/symptoms";

export default function FeetSideBar()  {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="absolute top-0 right-0 bottom-0 z-10 flex flex-row min-h-0 pointer-events-none">
            <div className="mt-2 mr-2 h-fit pointer-events-auto">
                <LabelledButton
                    label={"Sidebar"}
                    open_to_left={true}
                    onClick={() => setIsOpen(!isOpen)}
                    hover_disabled={true}
                >
                    <ChevronLeft className={` h-5 w-5 transition-all duration-300 ${isOpen ? "rotate-180" : "rotate-0"}`} />
                </LabelledButton>
            </div>
            <div
                className={`h-full w-fit bg-white dark:bg-slate-900 overflow-hidden pointer-events-auto transition-all duration-500 flex ${
                    isOpen ? "max-w-[500px]" : "max-w-0"
                }`}
                aria-hidden={!isOpen}
            >
                <GroupedPanelView
                    className="h-full w-fit flex flex-col flex-none min-h-0 p-2"
                    panelClassName="flex flex-col flex-1 min-h-0 h-full overflow-auto gap-2"
                    actionsClassName="justify-between"
                >
                    <PanelItem actionText={"Monitoring"}>
                        <Monitoring />
                    </PanelItem>
                    <PanelItem actionText={"Symptoms"}>
                        <Symptoms/>
                    </PanelItem>
                    <PanelItem actionText={"Download"}>
                        <DownloadTab />
                    </PanelItem>
                </GroupedPanelView>
            </div>
        </div>
    );
}