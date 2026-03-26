import { CreateOrgForm } from '../components/CreateOrgForm';

export default function NewOrgPage() {
  return (
    <div className="grid place-items-center h-screen">
      <div className="max-w-lg w-full border rounded-2xl shadow-md bg-white dark:bg-slate-900 p-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
            Create Organization
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Set up your new organization
          </p>
        </div>
        <CreateOrgForm />
      </div>
    </div>
  );
}