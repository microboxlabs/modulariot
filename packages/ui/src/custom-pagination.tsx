import { Pagination } from "flowbite-react";

export default function CustomPagination(
  { currentPage, onPageChange, totalPages }: { currentPage: number; onPageChange: (page: number) => void; totalPages: number }
) {
  return <Pagination
    className="w-full flex justify-center"
    nextLabel=""
    previousLabel=""
    showIcons
    currentPage={currentPage}
    totalPages={totalPages}
    onPageChange={onPageChange}
    theme={
      {
        "base": "",
        "layout": {
          "table": {
            "base": "text-sm text-slate-700 dark:text-slate-400",
            "span": "font-semibold text-slate-900 dark:text-white"
          }
        },
        "pages": {
          "base": "xs:mt-0 mt-2 inline-flex items-center -space-x-px",
          "showIcon": "inline-flex",
          "previous": {
            "base": "ml-0 rounded-l-lg border border-slate-300 bg-white px-3 py-2 leading-tight text-slate-500 enabled:hover:bg-slate-100 enabled:hover:text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 enabled:dark:hover:bg-slate-700 enabled:dark:hover:text-white",
            "icon": "h-5 w-5"
          },
          "next": {
            "base": "rounded-r-lg border border-slate-300 bg-white px-3 py-2 leading-tight text-slate-500 enabled:hover:bg-slate-100 enabled:hover:text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 enabled:dark:hover:bg-slate-700 enabled:dark:hover:text-white",
            "icon": "h-5 w-5"
          },
          "selector": {
            "base": "w-12 border border-slate-300 bg-white py-2 leading-tight text-slate-500 enabled:hover:bg-slate-100 enabled:hover:text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 enabled:dark:hover:bg-slate-700 enabled:dark:hover:text-white",
            "active": "bg-cyan-50 text-cyan-600 hover:bg-cyan-100 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-600 dark:text-white",
            "disabled": "cursor-not-allowed opacity-50"
          }
        }
      }
    }
  />;
}