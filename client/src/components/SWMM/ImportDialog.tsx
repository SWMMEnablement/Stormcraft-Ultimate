import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Upload } from 'lucide-react';
import { parseInpFile } from '@/lib/inp-parser';
import type { SWMMState } from '@/lib/swmm-types';

interface ImportDialogProps {
  onImport: (model: SWMMState) => void;
}

export function ImportDialog({ onImport }: ImportDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [preview, setPreview] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [parsedModel, setParsedModel] = useState<SWMMState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setError('');
    setParsedModel(null);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setPreview(content.slice(0, 1000) + (content.length > 1000 ? '\n...[truncated]' : ''));
      
      try {
        const model = parseInpFile(content);
        setParsedModel(model);
      } catch (err) {
        setError('Failed to parse .inp file. Please check the format.');
      }
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    if (parsedModel) {
      onImport(parsedModel);
      setIsOpen(false);
      setPreview('');
      setParsedModel(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.inp')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setPreview(content.slice(0, 1000) + (content.length > 1000 ? '\n...[truncated]' : ''));
        
        try {
          const model = parseInpFile(content);
          setParsedModel(model);
        } catch (err) {
          setError('Failed to parse .inp file.');
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button className="mc-btn" data-testid="button-import">
          <Upload className="h-4 w-4 inline mr-1" />
          IMPORT
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl bg-gray-200 border-4 border-white border-b-gray-700 border-r-gray-700">
        <DialogHeader>
          <DialogTitle className="font-sans text-xl">Import SWMM5 .inp File</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div 
            className="border-4 border-dashed border-gray-500 p-8 text-center cursor-pointer hover:border-blue-500 transition-colors"
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <Upload className="h-12 w-12 mx-auto mb-2 text-gray-500" />
            <p className="font-sans text-lg">Drop .inp file here or click to browse</p>
            <p className="font-sans text-sm text-gray-600">Supports EPA SWMM5 input files</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".inp"
              onChange={handleFileChange}
              className="hidden"
              data-testid="input-file"
            />
          </div>

          {error && (
            <div className="bg-red-100 border-2 border-red-500 p-2 text-red-700 font-sans">
              {error}
            </div>
          )}

          {preview && (
            <div className="mc-panel p-3">
              <h3 className="font-sans text-sm font-bold mb-2">File Preview</h3>
              <pre className="bg-black text-green-400 p-2 text-xs max-h-48 overflow-auto font-mono">
                {preview}
              </pre>
            </div>
          )}

          {parsedModel && (
            <div className="mc-panel p-3">
              <h3 className="font-sans text-sm font-bold mb-2">Parsed Model</h3>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="bg-gray-300 p-2">
                  <span className="font-bold">{parsedModel.nodes.length}</span> Nodes
                </div>
                <div className="bg-gray-300 p-2">
                  <span className="font-bold">{parsedModel.links.length}</span> Links
                </div>
                <div className="bg-gray-300 p-2">
                  <span className="font-bold">{parsedModel.subcatchments.length}</span> Subcatchments
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <button 
              onClick={() => setIsOpen(false)} 
              className="mc-btn"
            >
              CANCEL
            </button>
            <button 
              onClick={handleImport}
              disabled={!parsedModel}
              className="mc-btn mc-btn-primary disabled:opacity-50"
              data-testid="button-confirm-import"
            >
              IMPORT MODEL
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
