// The idea of this component is to be more customizable than custom dropdown.
// In custom dropdown you can only pass a list of options, here you can pass any react element as children

export default function CustomizableDropdown({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="relative">{children}</div>;
}
