export default function KanbanViewSwitcherIconCompressed({
  className = "fill-gray-700 dark:fill-gray-300",
}: {
  className?: string;
}) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      className={`${className}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="1.28198" y="12.4763" width="6" height="8.36733" rx="2" />
      <rect x="1.28198" y="3.15625" width="6" height="8.36733" rx="2" />
      <rect x="9.00024" y="10.4734" width="6" height="6.39295" rx="2" />
      <rect x="9.00024" y="3.15625" width="6" height="6.39295" rx="2" />
      <rect x="16.718" y="3.15625" width="6" height="4.89428" rx="2" />
      <rect x="16.718" y="9.00269" width="6" height="4.89428" rx="2" />
    </svg>
  );
}
