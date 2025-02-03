import { Conditions } from "./table-item.type";

export default function ConditionIcon({ condition }: { condition: string }) {
  return (
    <div
      className={`gap-2 h-10 w-10 ${Conditions[condition as keyof typeof Conditions].innerColor} ${Conditions[condition as keyof typeof Conditions].color} border-2 rounded-full m-auto`}
    ></div>
  );
}
