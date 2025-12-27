import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProjects, createProject, deleteProject, getProject } from '@/lib/api';
import type { Project } from '@shared/schema';
import type { SWMMState } from '@/lib/swmm-types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Trash2, FolderOpen } from 'lucide-react';

interface ProjectManagerProps {
  currentModel: SWMMState;
  onLoadProject: (model: SWMMState) => void;
}

export function ProjectManager({ currentModel, onLoadProject }: ProjectManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const queryClient = useQueryClient();

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
  });

  const saveMutation = useMutation({
    mutationFn: (name: string) => createProject({
      name,
      description: '',
      modelData: currentModel as any,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setProjectName('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const loadProject = async (project: Project) => {
    const modelData = project.modelData as unknown as SWMMState;
    onLoadProject(modelData);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button className="mc-btn" data-testid="button-projects">
          <FolderOpen className="h-4 w-4 inline mr-1" />
          PROJECTS
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl bg-gray-200 border-4 border-white border-b-gray-700 border-r-gray-700">
        <DialogHeader>
          <DialogTitle className="font-sans text-xl">Project Manager</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Save Current */}
          <div className="mc-panel p-3">
            <h3 className="font-sans text-sm font-bold mb-2">Save Current Project</h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Project name..."
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="mc-input flex-1"
                data-testid="input-project-name"
              />
              <button
                onClick={() => projectName && saveMutation.mutate(projectName)}
                disabled={!projectName || saveMutation.isPending}
                className="mc-btn mc-btn-primary"
                data-testid="button-save"
              >
                SAVE
              </button>
            </div>
          </div>

          {/* Load Existing */}
          <div className="mc-panel p-3">
            <h3 className="font-sans text-sm font-bold mb-2">Saved Projects</h3>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {projects.length === 0 ? (
                <p className="text-gray-600 text-sm">No saved projects yet</p>
              ) : (
                projects.map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between bg-gray-300 p-2 border-2 border-gray-400"
                    data-testid={`project-${project.id}`}
                  >
                    <div className="flex-1 cursor-pointer" onClick={() => loadProject(project)}>
                      <div className="font-sans font-bold">{project.name}</div>
                      <div className="text-xs text-gray-600">
                        {new Date(project.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteMutation.mutate(project.id)}
                      className="mc-btn mc-btn-danger p-2"
                      data-testid={`button-delete-${project.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
