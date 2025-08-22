"use client";

import React from "react";
import type { FleetStatus } from "../types/fleet.types";

export function FilterBar({
	search,
	onSearchChange,
	status,
	onStatusChange,
}: {
	search: string;
	onSearchChange: (v: string) => void;
	status: FleetStatus | "all";
	onStatusChange: (v: FleetStatus | "all") => void;
}) {
	return (
		<div className="flex gap-2 items-center rounded-md border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur px-2 py-1">
			<input
				value={search}
				onChange={(e) => onSearchChange(e.target.value)}
				placeholder="Search asset…"
				className="text-sm bg-transparent outline-none px-2 py-1"
				aria-label="Search by asset"
			/>
			<select
				value={status}
				onChange={(e) => onStatusChange(e.target.value as FleetStatus | "all")}
				className="text-sm bg-transparent outline-none px-2 py-1"
				aria-label="Filter by status"
			>
				<option value="all">All</option>
				<option value="ok">OK</option>
				<option value="warn">Warn</option>
				<option value="error">Error</option>
			</select>
		</div>
	);
} 