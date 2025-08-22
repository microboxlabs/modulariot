"use client";

import React from "react";

export function Tooltip({
	children,
	onClose,
}: {
	children: React.ReactNode;
	onClose: () => void;
}) {
	return (
		<div className="absolute right-4 top-4 z-20 pointer-events-auto">
			<div className="rounded-md shadow-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 max-w-xs">
				<div className="flex justify-between items-center mb-2">
					<div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
						Details
					</div>
					<button
						onClick={onClose}
						className="text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white"
						aria-label="Close tooltip"
					>
						×
					</button>
				</div>
				{children}
			</div>
		</div>
	);
} 