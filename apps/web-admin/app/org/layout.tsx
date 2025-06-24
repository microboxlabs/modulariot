import { Topbar } from '../components/Topbar';
import { Footer } from '../components/Footer';

export default function OrgLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      <Topbar />
      <main className="flex-1 overflow-y-auto bg-white dark:bg-gray-800">
        <div className="container px-6 mx-auto">
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
}
