// Representation can be either a icon, a number, a percentage, etc...
export default function DataCard({
  title, value, representation
}: {
  title?: string;
  value?: string | number;
  representation?: React.ReactNode;
}) {
  return (
    <div className='bg-slate-100 dark:bg-slate-900 border border-slate-400 flex flex-row justify-between items-center p-2 rounded-lg gap-4'>
      <div className='flex flex-col'>
        <div className='text-sm text-left font-light text-slate-800 dark:text-white w-fit'>
          {title}
        </div>
        <div className='text-lg text-left font-semibold text-slate-800 dark:text-white'>
          {value}
        </div>
      </div>
      <div className='text-gray-800 dark:text-gray-200'>
        {representation}
      </div>
    </div>
  );
}