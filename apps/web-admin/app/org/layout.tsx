import { AdminHeader } from '../components/AdminHeader';
import { Footer } from '../components/Footer';

export default function OrgLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      <AdminHeader />
      <main className="flex-1 overflow-hidden bg-white dark:bg-gray-800">
        {children}
      </main>
      <Footer />
    </div>
  );
}
