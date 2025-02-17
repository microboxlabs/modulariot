import { CiCircleCheck } from "react-icons/ci";

export default function EndTreatment({ dict }: { dict: any }) {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-2 p-5">
      <div className="flex flex-col items-center justify-center gap-2 flex-grow">
        <CiCircleCheck className="h-32 w-32 text-blue-500" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{dict.symptoms.end_treatment}</h1>
      </div>
    </div>
  );
}
