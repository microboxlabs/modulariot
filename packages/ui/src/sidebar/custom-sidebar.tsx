export default function CustomSidebar({children}: {children?: React.ReactNode}) {
    return <div className="h-full w-86">
        {children}
    </div>;
}