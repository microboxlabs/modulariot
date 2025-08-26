"use client";

import { TableHeadCell, TableHead, TableRow, Pagination, TableBody } from "flowbite-react";
import CustomTable from "../../custom-table";
import { useState } from "react";
import SymptomItem from "./symptom-item";
import { type TableItemType } from "../types/table-item.type";
import CustomPagination from "../../custom-pagination";

const test_data: TableItemType[] = [
    {
        id: "0",
        condition: "critic",
        licensePlate: "H21432",
        time: "12:30",
        trip: "1000000",
        driver: "Juan Perez",
        date: "10/04/2025 12:30",
        service: "1000000000",
        alertType: "Overspeed",
        status: null,
        last_assigned_to: "fernando@gmail.com",
    },
    {
        id: "1",
        condition: "code black",
        licensePlate: "H21432",
        time: "12:30",
        trip: "1000000",
        driver: "Juan Perez",
        date: "10/04/2025 12:30",
        service: "1000000000",
        alertType: "Overspeed",
        status: null,
        last_assigned_to: "fernando@gmail.com",
    },
    {
        id: "2",
        condition: "treatment",
        licensePlate: "H21432",
        time: "12:30",
        trip: "1000000",
        driver: "Juan Perez",
        date: "10/04/2025 12:30",
        service: "1000000000",
        alertType: "Overspeed",
        status: null,
        last_assigned_to: "fernando@gmail.com",
    },
    {
        id: "3",
        condition: "stable",
        licensePlate: "H21432",
        time: "12:30",
        trip: "1000000",
        driver: "Juan Perez",
        date: "10/04/2025 12:30",
        service: "1000000000",
        alertType: "Overspeed",
        status: null,
        last_assigned_to: "fernando@gmail.com",
    },
    {
        id: "4",
        condition: "compromised",
        licensePlate: "H21432",
        time: "12:30",
        trip: "1000000",
        driver: "Juan Perez",
        date: "10/04/2025 12:30",
        service: "1000000000",
        alertType: "Overspeed",
        status: null,
        last_assigned_to: "fernando@gmail.com",
    },
    {
        id: "5",
        condition: "under observation",
        licensePlate: "H21432",
        time: "12:30",
        trip: "1000000",
        driver: "Juan Perez",
        date: "10/04/2025 12:30",
        service: "1000000000",
        alertType: "Overspeed",
        status: null,
        last_assigned_to: "fernando@gmail.com",
    },
    {
        id: "6",
        condition: "remission",
        licensePlate: "H21432",
        time: "12:30",
        trip: "1000000",
        driver: "Juan Perez",
        date: "10/04/2025 12:30",
        service: "1000000000",
        alertType: "Overspeed",
        status: null,
        last_assigned_to: "fernando@gmail.com",
    },
    {
        id: "7",
        condition: "ignore condition",
        licensePlate: "H21432",
        time: "12:30",
        trip: "1000000",
        driver: "Juan Perez",
        date: "10/04/2025 12:30",
        service: "1000000000",
        alertType: "Overspeed",
        status: null,
        last_assigned_to: "fernando@gmail.com",
    },
]

export default function SymptomTable(
    {
        compact
    } : {
        compact: boolean
    }
) {
    const [currentPage, setCurrentPage] = useState(1);

    return (
        <div className={`w-full h-full flex flex-col`}>
            <div className="flex-grow overflow-auto">
                <CustomTable>
                    <TableHead>
                        {!compact ? (
                            <TableRow>
                                <TableHeadCell className="whitespace-nowrap">
                                    {"Condition"}
                                </TableHeadCell>
                                <TableHeadCell className="whitespace-nowrap">
                                    {"Symptom"}
                                </TableHeadCell>
                                <TableHeadCell className="whitespace-nowrap">
                                    {"Active Time"}
                                </TableHeadCell>
                                <TableHeadCell className="whitespace-nowrap">
                                    {"Trip"}
                                </TableHeadCell>
                                <TableHeadCell className="whitespace-nowrap">
                                    {"Diver"}
                                </TableHeadCell>
                                <TableHeadCell className="whitespace-nowrap">
                                    {"Creation Date"}
                                </TableHeadCell>
                            </TableRow>
                        ) : (
                            <TableRow>
                                <TableHeadCell className="whitespace-nowrap">
                                    {"Condition"}
                                </TableHeadCell>
                                <TableHeadCell className="whitespace-nowrap">
                                    {"Creation Date"}
                                </TableHeadCell>
                            </TableRow>
                        )}
                    </TableHead>
                    <TableBody>
                    {test_data.map((item, index) => (
                        <SymptomItem
                            key={index}
                            data={item}
                            compact={compact}
                        />
                    ))}
                    </TableBody>
                </CustomTable>
            </div>
            <CustomPagination
                currentPage={currentPage}
                totalPages={10}
                onPageChange={(page: number) => setCurrentPage(page as number)}
            />
        </div>
    );
}