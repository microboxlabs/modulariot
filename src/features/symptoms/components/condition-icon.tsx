import { Conditions } from "./table-item.type";
import Image from "next/image";

export default function ConditionIcon({ condition }: { condition: string }) {
  return (
    <div
      className={`gap-2 h-10 w-10 display-flex justify-center items-center ${Conditions[condition as keyof typeof Conditions].innerColor} ${Conditions[condition as keyof typeof Conditions].color} border-2 rounded-full`}
    >
      <Image
        src={Conditions[condition as keyof typeof Conditions].icon}
        alt={condition}
        width={100}
        height={100}
      />
    </div>
  );
}
