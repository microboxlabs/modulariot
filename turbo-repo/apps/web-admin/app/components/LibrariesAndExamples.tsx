import { Card, Badge } from "flowbite-react";
import { ExternalLink, Code, Smartphone, Globe, Terminal, Cpu, Database } from "lucide-react";
import Link from "next/link";

interface Library {
  name: string;
  language: string;
  description: string;
  version: string;
  popularity: "high" | "medium" | "low";
  npmPackage?: string;
  githubUrl?: string;
  docsUrl?: string;
}

interface ExampleProject {
  id: string;
  title: string;
  description: string;
  tags: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  githubUrl: string;
  liveDemo?: string;
  icon: string;
}

const clientLibraries: Library[] = [
  {
    name: "modulariot-js",
    language: "JavaScript/TypeScript",
    description: "Official JavaScript SDK for browser and Node.js",
    version: "2.1.4",
    popularity: "high",
    npmPackage: "@modulariot/sdk",
    githubUrl: "https://github.com/modulariot/js-sdk",
    docsUrl: "/docs/sdks/javascript"
  },
  {
    name: "modulariot-python",
    language: "Python",
    description: "Python SDK with async support and pandas integration",
    version: "1.8.2",
    popularity: "high",
    npmPackage: "modulariot",
    githubUrl: "https://github.com/modulariot/python-sdk",
    docsUrl: "/docs/sdks/python"
  },
  {
    name: "modulariot-flutter",
    language: "Dart/Flutter",
    description: "Cross-platform mobile SDK for iOS and Android",
    version: "0.6.1",
    popularity: "medium",
    githubUrl: "https://github.com/modulariot/flutter-sdk",
    docsUrl: "/docs/sdks/flutter"
  },
  {
    name: "modulariot-go",
    language: "Go",
    description: "High-performance Go SDK for server applications",
    version: "1.3.7",
    popularity: "medium",
    githubUrl: "https://github.com/modulariot/go-sdk",
    docsUrl: "/docs/sdks/go"
  },
  {
    name: "modulariot-rust",
    language: "Rust",
    description: "Memory-safe Rust SDK for embedded and edge devices",
    version: "0.4.2",
    popularity: "low",
    githubUrl: "https://github.com/modulariot/rust-sdk",
    docsUrl: "/docs/sdks/rust"
  },
  {
    name: "modulariot-cli",
    language: "CLI",
    description: "Command-line interface for project management",
    version: "3.2.1",
    popularity: "medium",
    npmPackage: "@modulariot/cli",
    githubUrl: "https://github.com/modulariot/cli",
    docsUrl: "/docs/cli"
  }
];

const exampleProjects: ExampleProject[] = [
  {
    id: "fleet-map",
    title: "Next.js Fleet Tracker",
    description: "Real-time vehicle tracking with WebSocket updates and interactive maps",
    tags: ["Next.js", "WebSocket", "Maps", "Real-time"],
    difficulty: "intermediate",
    githubUrl: "https://github.com/modulariot/examples/fleet-tracker",
    liveDemo: "https://fleet-demo.modulariot.com",
    icon: "Globe"
  },
  {
    id: "cli-simulator",
    title: "CLI Device Simulator",
    description: "Generate realistic IoT device data for testing and development",
    tags: ["CLI", "Simulation", "Testing", "DevOps"],
    difficulty: "beginner",
    githubUrl: "https://github.com/modulariot/examples/device-simulator",
    icon: "Terminal"
  },
  {
    id: "mobile-dashboard",
    title: "Flutter Mobile Dashboard",
    description: "Cross-platform mobile app for monitoring IoT devices on the go",
    tags: ["Flutter", "Mobile", "Dashboard", "iOS", "Android"],
    difficulty: "advanced",
    githubUrl: "https://github.com/modulariot/examples/flutter-dashboard",
    icon: "Smartphone"
  },
  {
    id: "edge-processing",
    title: "Edge Data Processing",
    description: "Process and filter IoT data at the edge before cloud ingestion",
    tags: ["Edge", "Processing", "Rust", "Performance"],
    difficulty: "advanced",
    githubUrl: "https://github.com/modulariot/examples/edge-processor",
    icon: "Cpu"
  },
  {
    id: "analytics-pipeline",
    title: "Analytics Pipeline",
    description: "End-to-end data pipeline with ETL and machine learning",
    tags: ["Python", "ML", "ETL", "Analytics"],
    difficulty: "intermediate",
    githubUrl: "https://github.com/modulariot/examples/analytics-pipeline",
    icon: "Database"
  },
  {
    id: "react-widgets",
    title: "React Dashboard Widgets",
    description: "Reusable React components for building IoT dashboards",
    tags: ["React", "Components", "Dashboard", "UI"],
    difficulty: "beginner",
    githubUrl: "https://github.com/modulariot/examples/react-widgets",
    liveDemo: "https://widgets-demo.modulariot.com",
    icon: "Code"
  }
];

export function LibrariesAndExamples() {
  const getPopularityColor = (popularity: string) => {
    switch (popularity) {
      case "high": return "success";
      case "medium": return "warning";
      case "low": return "gray";
      default: return "gray";
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "beginner": return "success";
      case "intermediate": return "warning";
      case "advanced": return "failure";
      default: return "gray";
    }
  };

  const getIcon = (iconName: string) => {
    const icons = {
      Globe,
      Terminal,
      Smartphone,
      Cpu,
      Database,
      Code
    };
    return icons[iconName as keyof typeof icons] || Code;
  };

  return (
    <div className="space-y-8">
      {/* Client Libraries Section */}
      <div>
        <div className="flex items-center gap-2 mb-6">
          <Code className="h-6 w-6 text-primary-600" />
          <h3 className="text-xl font-semibold">Client Libraries ({clientLibraries.length})</h3>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2">
          {clientLibraries.map((library) => (
            <Card key={library.name} className="p-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-base">{library.name}</h4>
                    <p className="text-sm text-gray-600">{library.language}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge color={getPopularityColor(library.popularity)} size="sm">
                      {library.popularity}
                    </Badge>
                    <span className="text-xs text-gray-500">v{library.version}</span>
                  </div>
                </div>
                
                <p className="text-sm text-gray-700">{library.description}</p>
                
                <div className="flex items-center gap-3 text-sm">
                  {library.docsUrl && (
                    <Link 
                      href={library.docsUrl}
                      className="text-primary-600 hover:text-primary-700 flex items-center gap-1"
                    >
                      Docs <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                  {library.githubUrl && (
                    <Link 
                      href={library.githubUrl}
                      className="text-gray-600 hover:text-gray-700 flex items-center gap-1"
                      target="_blank"
                    >
                      GitHub <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                  {library.npmPackage && (
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                      npm i {library.npmPackage}
                    </code>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Example Projects Section */}
      <div>
        <div className="flex items-center gap-2 mb-6">
          <Globe className="h-6 w-6 text-primary-600" />
          <h3 className="text-xl font-semibold">Example Projects ({exampleProjects.length})</h3>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {exampleProjects.map((project) => {
            const IconComponent = getIcon(project.icon);
            return (
              <Card key={project.id} className="p-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <IconComponent className="h-5 w-5 text-primary-600" />
                      <h4 className="font-semibold text-base">{project.title}</h4>
                    </div>
                    <Badge color={getDifficultyColor(project.difficulty)} size="sm">
                      {project.difficulty}
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-gray-700">{project.description}</p>
                  
                  <div className="flex flex-wrap gap-1">
                    {project.tags.map((tag) => (
                      <Badge key={tag} color="gray" size="sm">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  
                  <div className="flex items-center gap-3 text-sm">
                    <Link 
                      href={project.githubUrl}
                      className="text-primary-600 hover:text-primary-700 flex items-center gap-1"
                      target="_blank"
                    >
                      GitHub <ExternalLink className="h-3 w-3" />
                    </Link>
                    {project.liveDemo && (
                      <Link 
                        href={project.liveDemo}
                        className="text-green-600 hover:text-green-700 flex items-center gap-1"
                        target="_blank"
                      >
                        Live Demo <ExternalLink className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}