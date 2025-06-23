import { Sidebar } from '../components/Sidebar';
import { Topbar } from '../components/Topbar';
import { Footer } from '../components/Footer';

export default function OrgLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <div className="flex flex-col flex-1 w-full">
        <Topbar />
        <main className="h-full overflow-y-auto bg-white dark:bg-gray-800">
          <div className="container px-6 mx-auto grid">
            {children}
          </div>
        </main>
        <Footer />
      </div>
    </div>
  );
}
