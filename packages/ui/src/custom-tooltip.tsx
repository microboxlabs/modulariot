import { Tooltip } from "flowbite-react";

export default function CustomTooltip({
  children,
  content,
  placement = "bottom",
}: {
  children: React.ReactNode;
  content: React.ReactNode;
  placement?: "bottom" | "top" | "left" | "right";
}) {
  return (
    <Tooltip
      style="auto"
      content = {content}
      placement={placement}
      theme={
        {
          "target": "w-full h-full",
        }
      }
    >
      {children}
    </Tooltip>
  );
}