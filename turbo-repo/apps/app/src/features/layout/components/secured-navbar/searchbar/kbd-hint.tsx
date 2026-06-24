/**
 * Small ⌘K affordance shown inside the search field. Matches the Mintral design
 * kit hint; the actual shortcut is wired globally in {@link SearchBar}.
 */
export function KbdHint() {
  return (
    <kbd className="hidden items-center rounded border border-gray-200 bg-gray-100 px-1.5 font-mono text-[10px] font-medium text-gray-400 lg:inline-flex dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400">
      ⌘ K
    </kbd>
  );
}
