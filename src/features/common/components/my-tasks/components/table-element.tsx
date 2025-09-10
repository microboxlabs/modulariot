import { Table } from "flowbite-react";

export default function TableElement() {
  return (
    <Table.Row className="bg-white dark:bg-gray-800">
      <Table.Cell className="whitespace-nowrap font-medium text-gray-900 dark:text-white">
        <div className="flex flex-col text-xl">
          Viaje Iniciado
          <div className="flex flex-row gap-4 text-sm font-light">
            <span className="text-gray-500 dark:text-gray-400">#1420423-v</span>
            <span className="text-gray-500 dark:text-gray-400">14-08-2025</span>
            <span className="text-gray-500 dark:text-gray-400">Despachos</span>
          </div>
        </div>
      </Table.Cell>
      <Table.Cell>
        <p className="text-lg whitespace-nowrap">02:22:45 hrs</p>
      </Table.Cell>
      <Table.Cell>
        <p className="text-lg whitespace-nowrap">PBHX50</p>
      </Table.Cell>
      <Table.Cell>
        <p className="text-lg whitespace-nowrap">SLC-MEL</p>
      </Table.Cell>
      <Table.Cell>
        <p className="text-lg whitespace-nowrap">BHP</p>
      </Table.Cell>
    </Table.Row>
  );
}
