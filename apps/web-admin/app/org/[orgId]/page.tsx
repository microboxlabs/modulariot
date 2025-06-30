'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button, TextInput, Card, Spinner, Badge } from 'flowbite-react';
import { Plus, Search, Filter, FolderOpen, Calendar, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { CTAButton } from '@modulariot/ui/cta-button';
import { useOrganization } from '@/lib/hooks/organization';
import { Project } from '@modulariot/db';

function ProjectCard({ project }: { project: Project }) {
  const statusColors = {
    ACTIVE: 'green',
    PAUSED: 'yellow',
    INACTIVE: 'gray',
  };

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <Link href={`/org/${useParams().orgId}/project/${project.id}`} aria-label={`View ${project.name}`}>
        <Card className="rounded-2xl shadow-md p-6 h-full hover:ring-1 hover:ring-blue-300/60">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <FolderOpen className="h-6 w-6 text-blue-500 dark:text-blue-400" />
              </div>
              <div>
                <h5 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
                  {project.name}
                </h5>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {/* TODO: Add description */}
                  {/* {project.description} */}
                  {project.name} is a project that monitors the temperature and humidity of the warehouse.
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-4">
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              {/* TODO: Add device count */}
              <span>{/*project.deviceCount*/} {Math.floor(Math.random() * 1000)} devices</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>Updated {new Date(project.updatedAt).toLocaleDateString()}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge color={statusColors['ACTIVE']} title={`Status: ACTIVE`}>
              ACTIVE
            </Badge>
            <Badge color="gray" title={`Region: ${project.regionId}`}>{project.regionId}</Badge>
          </div>
        </Card>
      </Link>
    </motion.div>
  );
}

export default function OrgDetailPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const [searchTerm, setSearchTerm] = useState('');

  const { data: organization, isLoading } = useOrganization(orgId, { projects: true });

  const filteredProjects = organization?.projects?.filter(project => 
    project.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container px-6 mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-white tracking-tight">
          {`${organization?.name}'s Projects`}
        </h1> 
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Manage your device fleets and IoT projects for this organization.
        </p>
      </div>

      {/* Main toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8">
        <div className="relative w-full sm:w-72">
          <TextInput
            id="search"
            type="search"
            icon={Search}
            placeholder="Search projects"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
            aria-label="Search projects"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button disabled>
            <Filter className="h-5 w-5 mr-2" />
            Filter
          </Button>
          <CTAButton as={Link} href={`/org/${orgId}/projects/new`} variant="primary" size="md" disabled={isLoading}>
            <Plus className="h-5 w-5 mr-2" />
            New project
          </CTAButton>
        </div>
      </div>

      {/* Projects grid */}
      {isLoading ? (
        <div className="text-center">
          <Spinner size="xl" />
        </div>
      ) : (filteredProjects?.length ?? 0) > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects?.map((project, i) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
            >
              <ProjectCard project={project} />
            </motion.div>
          ))}
        </div>
      ) : (
        // Empty state
        <Card className="rounded-2xl shadow-md p-6 text-center">
          <div className="flex flex-col items-center gap-4 py-8">
            <FolderOpen className="h-16 w-16 text-gray-400" />
            <h3 className="text-xl font-semibold">No projects yet</h3>
            <p className="text-gray-500">
              Get started by creating your first project to group your device fleets.
            </p>
            <CTAButton as={Link} href={`/org/${orgId}/projects/new`} className="mt-4">
              <Plus className="h-5 w-5 mr-2" />
              Create your first project
            </CTAButton>
          </div>
        </Card>
      )}
    </div>
  );
} 