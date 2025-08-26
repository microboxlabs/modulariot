import { Table } from "flowbite-react"

export default function CustomTable(
  { children }: { children: React.ReactNode }
) {
    return (
      <Table
        striped
        theme={{
            body: {
                cell: {
                    base: "px-6 py-1 group-first/body:group-first/row:first:rounded-tl-lg group-first/body:group-first/row:last:rounded-tr-lg group-last/body:group-last/row:first:rounded-bl-none group-last/body:group-last/row:last:rounded-br-none",
                },
            },
            head: {
                base: "group/head text-xs uppercase text-slate-700 dark:text-slate-300",
                cell: {
                    base: "font-normal bg-slate-100 px-6 py-3 group-first/head:first:rounded-tl-lg group-first/head:last:rounded-tr-lg dark:bg-slate-700"
                }
            },
            row: {
                "hovered": "hover:bg-slate-50 dark:hover:bg-slate-600",
                "striped": "odd:bg-white even:bg-slate-50 odd:dark:bg-slate-800 even:dark:bg-slate-700"
            }
        }}
      >
        {children}
      </Table>
    );
}