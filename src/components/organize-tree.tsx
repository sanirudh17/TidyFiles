'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Sparkles,
  FolderTree,
  Play,
  Loader2,
  GripVertical,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  Archive,
  Code,
  FileSpreadsheet,
  LayoutGrid,
  AlertCircle,
  RefreshCw,
  Shield,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { applyFileChanges } from '@/lib/client-file-ops';

// File type icons
const FILE_ICONS: Record<string, typeof FileText> = {
  'Documents': FileText,
  'Images': ImageIcon,
  'Videos': Film,
  'Audio': Music,
  'Archives': Archive,
  'Code': Code,
  'Spreadsheets': FileSpreadsheet,
  'Other': LayoutGrid,
};

interface FileInfo {
  id: string;
  name: string;
  path: string;
  size: number;
  category: string;
  extension: string;
}

interface ProposedFolder {
  id: string;
  name: string;
  path: string;
  reason: string;
  files: FileInfo[];
  isExpanded?: boolean;
  isEditing?: boolean;
}

interface OrganizeTreeProps {
  files: FileInfo[];
  basePath: string;
  onApply?: (moves: Array<{ fileId: string; sourcePath: string; destPath: string }>) => void;
  onApplyComplete?: (result: { applied: number; failed: number; folders: number }) => void;
}

export function OrganizeTree({ files, basePath, onApply, onApplyComplete }: OrganizeTreeProps) {
  const [proposedFolders, setProposedFolders] = useState<ProposedFolder[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationSummary, setSimulationSummary] = useState<string | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [draggedFile, setDraggedFile] = useState<FileInfo | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preserveExisting, setPreserveExisting] = useState(true);
  const [isApplying, setIsApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<{ applied: number; failed: number; folders: number; errors: string[] } | null>(null);

  // Detect existing folders and loose files
  const { existingFolders, looseFiles } = useMemo(() => {
    const folderSet = new Set<string>();
    const loose: FileInfo[] = [];

    files.forEach(file => {
      const relativePath = file.path.replace(basePath, '').replace(/^[\\/]/, '');
      const parts = relativePath.split(/[\\/]/);
      
      if (parts.length > 1) {
        // File is inside a subfolder
        folderSet.add(parts[0]);
      } else {
        // File is directly in root
        loose.push(file);
      }
    });

    return {
      existingFolders: Array.from(folderSet),
      looseFiles: loose,
    };
  }, [files, basePath]);

  // Files to organize (respecting preservation setting)
  const filesToOrganize = useMemo(() => {
    if (preserveExisting) {
      return looseFiles;
    }
    return files;
  }, [files, looseFiles, preserveExisting]);

  // Track regeneration count to vary results
  // Generate AI folder suggestions
  const generateSuggestions = async () => {
    // Clear existing proposals immediately for visual feedback
    setProposedFolders([]);
    setIsGenerating(true);
    setError(null);
    setSimulationSummary(null);
    setApplyResult(null);
    try {
      const response = await fetch('/api/organize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          files: filesToOrganize, 
          basePath,
          protectedFolders: preserveExisting ? existingFolders : [],
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate suggestions');
      }

      const data = await response.json();
      
      // Transform API response to ProposedFolder format
      const ts = Date.now();
      const folders: ProposedFolder[] = data.folders.map((folder: { name: string; path: string; reason: string; fileIds: string[] }, index: number) => ({
        id: `folder-${ts}-${index}`,
        name: folder.name,
        path: folder.path || `${basePath}\\${folder.name}`,
        reason: folder.reason,
        files: folder.fileIds
          .map((fileId: string) => filesToOrganize.find(f => f.id === fileId))
          .filter((f: FileInfo | undefined): f is FileInfo => f !== undefined),
        isExpanded: false,
      }));

      setProposedFolders(folders);
      setHasGenerated(true);
    } catch (err) {
      console.error('Error generating suggestions:', err);
      setError('Failed to generate folder suggestions. Using fallback grouping.');
      generateFallbackSuggestions();
    } finally {
      setIsGenerating(false);
    }
  };

  // Fallback suggestion generator when API fails
  const generateFallbackSuggestions = () => {
    const categoryGroups: Record<string, FileInfo[]> = {};
    
    filesToOrganize.forEach(file => {
      const cat = file.category || 'Other';
      if (!categoryGroups[cat]) categoryGroups[cat] = [];
      categoryGroups[cat].push(file);
    });

    const ts = Date.now();
    const folders: ProposedFolder[] = Object.entries(categoryGroups)
      .filter(([, groupedFiles]) => groupedFiles.length > 0)
      .map(([category, categoryFiles], index) => ({
        id: `folder-${ts}-${index}`,
        name: category,
        path: `${basePath}\\${category}`,
        reason: `Group all ${category.toLowerCase()} files together`,
        files: categoryFiles,
        isExpanded: false,
      }));

    setProposedFolders(folders);
    setHasGenerated(true);
  };

  // Toggle folder expansion
  const toggleFolder = (folderId: string) => {
    setProposedFolders(prev =>
      prev.map(f =>
        f.id === folderId ? { ...f, isExpanded: !f.isExpanded } : f
      )
    );
  };

  // Start editing folder name
  const startEditing = (folder: ProposedFolder) => {
    setEditingFolderId(folder.id);
    setEditingName(folder.name);
  };

  // Save folder name
  const saveEditing = (folderId: string) => {
    if (editingName.trim()) {
      setProposedFolders(prev =>
        prev.map(f =>
          f.id === folderId
            ? { ...f, name: editingName.trim(), path: `${basePath}\\${editingName.trim()}` }
            : f
        )
      );
    }
    setEditingFolderId(null);
    setEditingName('');
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingFolderId(null);
    setEditingName('');
  };

  // Remove folder (files go back to unassigned)
  const removeFolder = (folderId: string) => {
    setProposedFolders(prev => prev.filter(f => f.id !== folderId));
  };

  // Add new custom folder
  const addCustomFolder = () => {
    const newFolder: ProposedFolder = {
      id: `folder-custom-${Date.now()}`,
      name: 'New Folder',
      path: `${basePath}\\New Folder`,
      reason: 'Custom folder',
      files: [],
      isExpanded: true,
      isEditing: true,
    };
    setProposedFolders(prev => [...prev, newFolder]);
    setEditingFolderId(newFolder.id);
    setEditingName('New Folder');
  };

  // Handle drag start
  const handleDragStart = (file: FileInfo) => {
    setDraggedFile(file);
  };

  // Handle drag over folder
  const handleDragOver = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    setDragOverFolder(folderId);
  };

  // Handle drop on folder
  const handleDrop = (e: React.DragEvent, targetFolderId: string) => {
    e.preventDefault();
    if (!draggedFile) return;

    setProposedFolders(prev => {
      const updated = prev.map(f => ({
        ...f,
        files: f.files.filter(file => file.id !== draggedFile.id),
      }));

      return updated.map(f =>
        f.id === targetFolderId
          ? { ...f, files: [...f.files, draggedFile] }
          : f
      );
    });

    setDraggedFile(null);
    setDragOverFolder(null);
  };

  // Handle drag end
  const handleDragEnd = () => {
    setDraggedFile(null);
    setDragOverFolder(null);
  };

  // Get unassigned files
  const unassignedFiles = useMemo(() => {
    const assignedIds = new Set(proposedFolders.flatMap(f => f.files.map(file => file.id)));
    return filesToOrganize.filter(f => !assignedIds.has(f.id));
  }, [filesToOrganize, proposedFolders]);

  // Simulate changes - compute diff
  const handleSimulate = () => {
    setIsSimulating(true);
    
    const foldersToCreate = proposedFolders.filter(f => f.files.length > 0).length;
    const filesToMove = proposedFolders.reduce((sum, f) => sum + f.files.length, 0);
    
    setSimulationSummary(
      `Simulation: Would create ${foldersToCreate} folder${foldersToCreate !== 1 ? 's' : ''} and move ${filesToMove} file${filesToMove !== 1 ? 's' : ''} (only from root)`
    );
    
    setTimeout(() => setIsSimulating(false), 2000);
  };

  // Apply all changes - directly call the API to create folders and move files
  const handleApplyAll = useCallback(async () => {
    const foldersWithFiles = proposedFolders.filter(f => f.files.length > 0);
    if (foldersWithFiles.length === 0) return;

    setIsApplying(true);
    setError(null);
    setApplyResult(null);

    try {
      // Build moves list for the API
      const changes = foldersWithFiles.flatMap(folder =>
        folder.files.map(file => ({
          fileId: file.id,
          originalPath: file.path,
          action: 'move' as const,
          proposedPath: `${folder.path}\\${file.name}`,
        }))
      );

      // Also call onApply if provided (for legacy compatibility)
      if (onApply) {
        const moves = changes.map(c => ({
          fileId: c.fileId,
          sourcePath: c.originalPath,
          destPath: c.proposedPath,
        }));
        // Don't await - this is just a notification
        onApply(moves);
      }

      const result = await applyFileChanges(changes, { createBackups: true });

      const errors: string[] = [];
      if (result.results) {
        result.results
          .filter((r: { success: boolean; error?: string; originalPath?: string }) => !r.success && r.error)
          .forEach((r: { success: boolean; error?: string; originalPath?: string }) => {
            errors.push(`${r.originalPath?.split('\\').pop() || 'file'}: ${r.error}`);
          });
      }

      setApplyResult({
        applied: result.applied || 0,
        failed: result.failed || 0,
        folders: foldersWithFiles.length,
        errors,
      });

      // Notify parent of completion
      if (onApplyComplete) {
        onApplyComplete({
          applied: result.applied || 0,
          failed: result.failed || 0,
          folders: foldersWithFiles.length,
        });
      }
    } catch (err) {
      console.error('Error applying organization:', err);
      setError(
        `Failed to apply changes: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    } finally {
      setIsApplying(false);
    }
  }, [proposedFolders, onApply, onApplyComplete]);

  // Calculate stats
  const totalFilesToMove = proposedFolders.reduce((sum, f) => sum + f.files.length, 0);
  const totalFolders = proposedFolders.filter(f => f.files.length > 0).length;
  const totalFolderSize = proposedFolders.reduce(
    (sum, f) => sum + f.files.reduce((s, file) => s + file.size, 0),
    0
  );

  // Format file size
  const formatSize = (bytes: number) => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  // Get file icon based on category
  const getFileIcon = (category: string) => {
    return FILE_ICONS[category] || FILE_ICONS['Other'];
  };

  // Get preview files (first 3)
  const getPreviewFiles = (folder: ProposedFolder) => {
    return folder.files.slice(0, 3).map(f => f.name);
  };

  // Initial state - no suggestions generated yet
  if (!hasGenerated) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-6">
        <div className="w-20 h-20 bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl flex items-center justify-center">
          <FolderTree className="w-10 h-10 text-primary" />
        </div>
        
        <div className="text-center space-y-2 max-w-md">
          <h3 className="text-xl font-semibold">Organize Your Files</h3>
          <p className="text-muted-foreground text-sm">
            {preserveExisting ? (
              <>AI will organize <strong>{looseFiles.length} loose files</strong> in root. Existing folders ({existingFolders.length}) will not be touched.</>
            ) : (
              <>AI will analyze all {files.length} files and suggest an organized folder structure.</>
            )}
          </p>
        </div>

        {/* Folder preservation toggle */}
        <div className="flex items-center gap-3 p-4 bg-muted/30 border border-border rounded-lg max-w-md w-full">
          <Shield className={cn("w-5 h-5", preserveExisting ? "text-green-600" : "text-muted-foreground")} />
          <div className="flex-1">
            <p className="text-sm font-medium">Keep existing folders intact</p>
            <p className="text-xs text-muted-foreground">Only organize loose files in root</p>
          </div>
          <button
            onClick={() => setPreserveExisting(!preserveExisting)}
            className={cn(
              "w-10 h-6 rounded-full transition-colors relative",
              preserveExisting ? "bg-green-600" : "bg-muted"
            )}
          >
            <div className={cn(
              "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform",
              preserveExisting ? "translate-x-5" : "translate-x-1"
            )} />
          </button>
        </div>

        {/* Protected folders preview */}
        {preserveExisting && existingFolders.length > 0 && (
          <div className="flex flex-wrap gap-2 justify-center max-w-md">
            {existingFolders.slice(0, 6).map(folder => (
              <span key={folder} className="flex items-center gap-1.5 px-2 py-1 bg-green-50 text-green-700 text-xs rounded-lg border border-green-200">
                <Folder className="w-3 h-3" />
                {folder}
              </span>
            ))}
            {existingFolders.length > 6 && (
              <span className="px-2 py-1 text-xs text-muted-foreground">+{existingFolders.length - 6} more protected</span>
            )}
          </div>
        )}

        <button
          onClick={generateSuggestions}
          disabled={isGenerating || filesToOrganize.length === 0}
          className={cn(
            "flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all",
            "bg-primary text-primary-foreground hover:bg-primary/90",
            "shadow-md hover:shadow-lg",
            (isGenerating || filesToOrganize.length === 0) && "opacity-70 cursor-not-allowed"
          )}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Analyzing with Gemini 3 Pro Preview...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Generate Folder Structure
            </>
          )}
        </button>

        {filesToOrganize.length === 0 && (
          <p className="text-sm text-muted-foreground">No loose files to organize. All files are already in folders.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <FolderTree className="w-5 h-5 text-primary" />
            Proposed Organization
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {totalFolders} folders, {totalFilesToMove} files ({formatSize(totalFolderSize)})
            {unassignedFiles.length > 0 && ` • ${unassignedFiles.length} unassigned`}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={generateSuggestions}
            disabled={isGenerating}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-border rounded-lg hover:bg-muted transition-colors"
          >
            <RefreshCw className={cn("w-4 h-4", isGenerating && "animate-spin")} />
            Regenerate
          </button>
          
          <button
            onClick={addCustomFolder}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-border rounded-lg hover:bg-muted transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Folder
          </button>

          <button
            onClick={handleSimulate}
            disabled={isSimulating || totalFilesToMove === 0}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
              "bg-amber-100 text-amber-700 hover:bg-amber-200",
              (isSimulating || totalFilesToMove === 0) && "opacity-50 cursor-not-allowed"
            )}
          >
            <Play className="w-4 h-4" />
            {isSimulating ? 'Simulating...' : 'Simulate'}
          </button>

          <button
            onClick={handleApplyAll}
            disabled={totalFilesToMove === 0 || isApplying}
            className={cn(
              "flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-lg transition-colors",
              "bg-primary text-primary-foreground hover:bg-primary/90",
              (totalFilesToMove === 0 || isApplying) && "opacity-50 cursor-not-allowed"
            )}
          >
            {isApplying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Applying...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Apply All
              </>
            )}
          </button>
        </div>
      </div>

      {/* Apply result banner */}
      {applyResult && (
        <div className={cn(
          "p-4 rounded-lg border text-sm",
          applyResult.failed === 0
            ? "bg-green-50 border-green-200 text-green-800"
            : "bg-amber-50 border-amber-200 text-amber-800"
        )}>
          <div className="flex items-center gap-2 font-medium mb-1">
            {applyResult.failed === 0 ? (
              <><Check className="w-4 h-4 text-green-600" /> Organization Applied Successfully!</>
            ) : (
              <><AlertCircle className="w-4 h-4 text-amber-600" /> Partially Applied</>
            )}
          </div>
          <p>
            Created {applyResult.folders} folder{applyResult.folders !== 1 ? 's' : ''} and
            moved {applyResult.applied} file{applyResult.applied !== 1 ? 's' : ''}
            {applyResult.failed > 0 && ` (${applyResult.failed} failed)`}.
          </p>
          {applyResult.errors.length > 0 && (
            <div className="mt-2 space-y-1">
              {applyResult.errors.slice(0, 5).map((err, i) => (
                <p key={i} className="text-xs text-red-600">• {err}</p>
              ))}
              {applyResult.errors.length > 5 && (
                <p className="text-xs text-muted-foreground">...and {applyResult.errors.length - 5} more</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Simulation summary banner */}
      {simulationSummary && !applyResult && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          <Info className="w-4 h-4 flex-shrink-0" />
          {simulationSummary}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Folder preservation reminder */}
      {preserveExisting && existingFolders.length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          <Shield className="w-4 h-4 flex-shrink-0" />
          {existingFolders.length} existing folder{existingFolders.length !== 1 ? 's' : ''} protected ({existingFolders.slice(0, 3).join(', ')}{existingFolders.length > 3 ? '...' : ''})
        </div>
      )}

      {/* Folder cards - collapsed by default */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {proposedFolders.map((folder) => {
            const isOver = dragOverFolder === folder.id;
            const folderSize = folder.files.reduce((sum, f) => sum + f.size, 0);
            const previewFiles = getPreviewFiles(folder);

            return (
              <motion.div
                key={folder.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className={cn(
                  "border rounded-xl overflow-hidden transition-all",
                  isOver ? "border-primary ring-2 ring-primary/20 bg-primary/5" : "border-border",
                  isSimulating && "ring-2 ring-amber-400/50 border-dashed"
                )}
                onDragOver={(e) => handleDragOver(e, folder.id)}
                onDrop={(e) => handleDrop(e, folder.id)}
                onDragLeave={() => setDragOverFolder(null)}
              >
                {/* Folder card header */}
                <div 
                  className="flex items-center gap-3 p-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => toggleFolder(folder.id)}
                >
                  <button className="p-1 hover:bg-muted rounded transition-colors">
                    {folder.isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>

                  <div className="text-primary">
                    {folder.isExpanded ? (
                      <FolderOpen className="w-5 h-5" />
                    ) : (
                      <Folder className="w-5 h-5" />
                    )}
                  </div>

                  {editingFolderId === folder.id ? (
                    <div className="flex items-center gap-2 flex-1" onClick={e => e.stopPropagation()}>
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEditing(folder.id);
                          if (e.key === 'Escape') cancelEditing();
                        }}
                        className="flex-1 px-2 py-1 text-sm border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary/50"
                        autoFocus
                      />
                      <button
                        onClick={() => saveEditing(folder.id)}
                        className="p-1 text-green-600 hover:bg-green-50 rounded"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={cancelEditing}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{folder.name}</span>
                          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {folder.files.length} files
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatSize(folderSize)}
                          </span>
                        </div>
                        {/* Preview when collapsed */}
                        {!folder.isExpanded && previewFiles.length > 0 && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {previewFiles.map((name, i) => (
                              <span key={i}>
                                {i > 0 && ' · '}
                                <span className="font-mono">{name.length > 20 ? name.slice(0, 20) + '...' : name}</span>
                              </span>
                            ))}
                            {folder.files.length > 3 && ` +${folder.files.length - 3} more`}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => startEditing(folder)}
                          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => removeFolder(folder.id)}
                          className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Folder contents - expanded */}
                <AnimatePresence>
                  {folder.isExpanded && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: 'auto' }}
                      exit={{ height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-3 py-2 text-xs text-muted-foreground border-t border-border bg-muted/20">
                        {folder.reason}
                      </div>
                      {folder.files.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground border-t border-border border-dashed">
                          <p>Drag files here to add them to this folder</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-border/50 max-h-[300px] overflow-y-auto">
                          {folder.files.map((file) => {
                            const Icon = getFileIcon(file.category);
                            return (
                              <div
                                key={file.id}
                                draggable
                                onDragStart={() => handleDragStart(file)}
                                onDragEnd={handleDragEnd}
                                className={cn(
                                  "flex items-center gap-3 px-4 py-2 hover:bg-muted/50 cursor-grab active:cursor-grabbing transition-colors",
                                  draggedFile?.id === file.id && "opacity-50"
                                )}
                              >
                                <GripVertical className="w-4 h-4 text-muted-foreground/50" />
                                <Icon className="w-4 h-4 text-muted-foreground" />
                                <span className="flex-1 text-sm truncate">{file.name}</span>
                                <span className="text-xs text-muted-foreground">{formatSize(file.size)}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Unassigned files section */}
      {unassignedFiles.length > 0 && (
        <div className="border border-dashed border-border rounded-xl p-4">
          <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Unassigned Files ({unassignedFiles.length})
          </h4>
          <div className="flex flex-wrap gap-2">
            {unassignedFiles.slice(0, 10).map((file) => {
              const Icon = getFileIcon(file.category);
              return (
                <div
                  key={file.id}
                  draggable
                  onDragStart={() => handleDragStart(file)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg text-sm cursor-grab active:cursor-grabbing",
                    draggedFile?.id === file.id && "opacity-50"
                  )}
                >
                  <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="truncate max-w-[150px]">{file.name}</span>
                </div>
              );
            })}
            {unassignedFiles.length > 10 && (
              <span className="px-3 py-1.5 text-sm text-muted-foreground">
                +{unassignedFiles.length - 10} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Preview path footer */}
      <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
        <span className="font-medium">Base path:</span> {basePath}
      </div>
    </div>
  );
}
