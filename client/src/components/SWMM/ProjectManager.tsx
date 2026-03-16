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
        <button className="mc-btn-sm" data-testid="button-projects">
          PROJECTS
        </button>
      </DialogTrigger>
      <DialogContent
        className="max-w-2xl text-white"
        style={{
          background: 'rgba(0,0,0,0.95)',
          border: '2px solid #555',
          imageRendering: 'pixelated',
        }}
      >
        <DialogHeader>
          <DialogTitle
            style={{
              fontFamily: '"Press Start 2P", monospace',
              fontSize: '14px',
              color: '#FFFF55',
            }}
          >
            PROJECT MANAGER
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div
            className="p-3"
            style={{ border: '2px solid #555', background: '#1a1a1a' }}
          >
            <h3
              className="mb-2"
              style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '8px', color: '#aaa' }}
            >
              SAVE CURRENT
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Project name..."
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="flex-1 px-2 py-1 outline-none"
                style={{
                  fontFamily: '"Press Start 2P", monospace',
                  fontSize: '8px',
                  background: '#000',
                  border: '2px inset #555',
                  color: '#55FF55',
                }}
                data-testid="input-project-name"
              />
              <button
                onClick={() => projectName && saveMutation.mutate(projectName)}
                disabled={!projectName || saveMutation.isPending}
                className="mc-btn-sm mc-btn-primary-sm"
                data-testid="button-save"
              >
                SAVE
              </button>
            </div>
          </div>

          <div
            className="p-3"
            style={{ border: '2px solid #555', background: '#1a1a1a' }}
          >
            <h3
              className="mb-2"
              style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '8px', color: '#aaa' }}
            >
              SAVED WORLDS
            </h3>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {projects.length === 0 ? (
                <p style={{ fontFamily: 'VT323, monospace', fontSize: '14px', color: '#666' }}>
                  No saved projects yet
                </p>
              ) : (
                projects.map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between p-2"
                    style={{ background: '#2a2a2a', border: '2px solid #444' }}
                    data-testid={`project-${project.id}`}
                  >
                    <div className="flex-1 cursor-pointer" onClick={() => loadProject(project)}>
                      <div
                        style={{
                          fontFamily: '"Press Start 2P", monospace',
                          fontSize: '8px',
                          color: '#fff',
                          textShadow: '1px 1px 0 #000',
                        }}
                      >
                        {project.name}
                      </div>
                      <div style={{ fontFamily: 'VT323, monospace', fontSize: '12px', color: '#666' }}>
                        {new Date(project.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteMutation.mutate(project.id)}
                      className="mc-btn-sm"
                      style={{ backgroundColor: '#7a1a1a' }}
                      data-testid={`button-delete-${project.id}`}
                    >
                      <Trash2 className="h-3 w-3" />
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
