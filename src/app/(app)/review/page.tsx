'use client';

import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '@/lib/store-context';
import { useRouter } from 'next/navigation';
import { 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight,
  FileDiff,
  ArrowLeft,
  Trash2,
  FileEdit,
  FolderInput,
  ListCheck,
  Shield,
  Archive,
  X,
  Folder
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Safety confirmation modal for deletions/archives
function SafetyModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  deletions,
  archives,
  settings
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onConfirm: (createBackup: boolean) => void;
  deletions: Array<{ name: string; path: string; size: number }>;
  archives: Array<{ name: string; path: string; size: number }>;
  settings: { createBackups: boolean };
}) {
  const [createBackup, setCreateBackup] = useState(settings.createBackups);
  const [confirmed, setConfirmed] = useState(false);
  
  if (!isOpen) return null;
  
  const totalSize = [...deletions, ...archives].reduce((sum, f) => sum + f.size, 0);
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  
  // Group by folder
  const folderGroups = useMemo(() => {
    const groups: Record<string, number> = {};
    [...deletions, ...archives].forEach(f => {
      const folder = f.path.split(/[/\\]/).slice(-2, -1)[0] || 'root';
      groups[folder] = (groups[folder] || 0) + 1;
    });
    return Object.entries(groups).sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [deletions, archives]);

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-full">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold">Confirm Destructive Actions</h3>
              <p className="text-sm text-muted-foreground">
                {deletions.length + archives.length} files will be modified
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3">
            {deletions.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-red-700 mb-1">
                  <Trash2 className="w-4 h-4" />
                  <span className="font-medium text-sm">Delete</span>
                </div>
                <p className="text-xl font-bold text-red-900">{deletions.length} files</p>
                <p className="text-xs text-red-600">{formatSize(deletions.reduce((s, f) => s + f.size, 0))}</p>
              </div>
            )}
            {archives.length > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-gray-700 mb-1">
                  <Archive className="w-4 h-4" />
                  <span className="font-medium text-sm">Archive</span>
                </div>
                <p className="text-xl font-bold text-gray-900">{archives.length} files</p>
                <p className="text-xs text-gray-600">{formatSize(archives.reduce((s, f) => s + f.size, 0))}</p>
              </div>
            )}
          </div>
          
          {/* Folder breakdown */}
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">From folders:</p>
            <div className="flex flex-wrap gap-2">
              {folderGroups.map(([folder, count]) => (
                <span key={folder} className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-border rounded text-xs">
                  <Folder className="w-3 h-3 text-muted-foreground" />
                  {folder} ({count})
                </span>
              ))}
            </div>
          </div>
          
          {/* Backup option */}
          <label className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={createBackup}
              onChange={(e) => setCreateBackup(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <div>
              <p className="text-sm font-medium text-blue-900">Create backup before deleting</p>
              <p className="text-xs text-blue-700">Files will be archived to a backup folder first</p>
            </div>
          </label>
          
          {/* Per-file warnings */}
          {deletions.length > 0 && deletions.length <= 5 && (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              <p className="text-xs font-medium text-muted-foreground">Files to delete:</p>
              {deletions.map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-red-700 bg-red-50/50 px-2 py-1 rounded">
                  <Trash2 className="w-3 h-3" />
                  <span className="truncate">{f.name}</span>
                </div>
              ))}
            </div>
          )}
          
          {/* Confirmation checkbox */}
          <label className="flex items-start gap-3 p-3 border border-amber-300 bg-amber-50 rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="w-4 h-4 mt-0.5 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
            />
            <div>
              <p className="text-sm font-medium text-amber-900">I understand these changes cannot be undone</p>
              <p className="text-xs text-amber-700">Deleted files may not be recoverable without backups</p>
            </div>
          </label>
        </div>
        
        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t border-border bg-muted/30 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(createBackup)}
            disabled={!confirmed}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2",
              confirmed
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            <Shield className="w-4 h-4" />
            Confirm & Apply
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function ReviewPage() {
  const { suggestions, scanStatus, applyChanges, resetScan, rejectSuggestion, settings } = useApp();
  const router = useRouter();
  const [isApplying, setIsApplying] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [appliedCount, setAppliedCount] = useState(0);
  const [showSafetyModal, setShowSafetyModal] = useState(false);

  // Filter for approved suggestions
  const approvedSuggestions = suggestions.filter(s => s.status === 'approved');

  // Get deletions and archives for safety modal
  const deletions = approvedSuggestions
    .filter(s => s.action === 'delete')
    .map(s => ({ name: s.originalFile.name, path: s.originalFile.path, size: s.originalFile.size }));
  
  const archives = approvedSuggestions
    .filter(s => s.action === 'archive')
    .map(s => ({ name: s.originalFile.name, path: s.originalFile.path, size: s.originalFile.size }));

  const hasDestructiveActions = deletions.length > 0 || archives.length > 0;

  const handleApplyClick = () => {
    // Show safety modal if there are deletions or archives
    if (hasDestructiveActions && settings.requireConfirmation) {
      setShowSafetyModal(true);
    } else {
      handleApply(settings.createBackups);
    }
  };

  const handleApply = async (createBackup: boolean) => {
    setShowSafetyModal(false);
    setIsApplying(true);
    setAppliedCount(approvedSuggestions.length);
    
    // Simulate processing delay then apply
    await new Promise(resolve => setTimeout(resolve, 1500));
    await applyChanges();
    
    setIsApplying(false);
    setIsComplete(true);
  };

  const handleStartNew = () => {
    resetScan();
    router.push('/');
  };

  // Show friendly message if no scan, but don't redirect
  if (scanStatus !== 'complete' && !isComplete) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <ListCheck className="w-16 h-16 text-muted-foreground/30" />
        <div className="text-center">
          <h3 className="text-lg font-medium mb-2">Nothing to review</h3>
          <p className="text-muted-foreground text-sm mb-4">Approve suggestions first, then come here to apply changes.</p>
          <button 
            onClick={() => router.push('/')} 
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
          >
            Go to Scan Setup
          </button>
        </div>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 animate-in zoom-in-95 duration-500">
        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">All Clean!</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Successfully queued {appliedCount} changes for your folders.
            A backup log has been saved to history.
          </p>
        </div>
        <div className="flex gap-4 pt-4">
          <button 
            onClick={() => router.push('/history')}
            className="px-6 py-2 bg-white border border-border rounded-lg font-medium hover:bg-muted transition-colors"
          >
            View History
          </button>
          <button 
            onClick={handleStartNew}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            Start New Scan
          </button>
        </div>
      </div>
    );
  }

  // Group by action type
  const byAction = {
    rename: approvedSuggestions.filter(s => s.action === 'rename'),
    delete: approvedSuggestions.filter(s => s.action === 'delete'),
    move: approvedSuggestions.filter(s => s.action === 'move'),
    archive: approvedSuggestions.filter(s => s.action === 'archive'),
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <button 
            onClick={() => router.push('/suggestions')}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Suggestions
          </button>
          <h2 className="text-2xl font-bold tracking-tight">Review Changes</h2>
          <p className="text-muted-foreground">
            {approvedSuggestions.length} changes ready to apply. Review them carefully.
          </p>
        </div>
        <button
          onClick={handleApplyClick}
          disabled={approvedSuggestions.length === 0 || isApplying}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3 rounded-lg font-medium shadow-sm transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isApplying ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Applying Changes...
            </>
          ) : (
            <>
              Apply {approvedSuggestions.length} Changes
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>

      {/* Safety Modal */}
      <SafetyModal
        isOpen={showSafetyModal}
        onClose={() => setShowSafetyModal(false)}
        onConfirm={handleApply}
        deletions={deletions}
        archives={archives}
        settings={settings}
      />

      {approvedSuggestions.length === 0 ? (
        <div className="text-center py-20 bg-muted/30 rounded-xl border border-dashed border-border">
          <p className="text-muted-foreground">No changes approved yet.</p>
          <button 
            onClick={() => router.push('/suggestions')}
            className="text-primary hover:underline mt-2 font-medium"
          >
            Go back to Suggestions
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3 text-amber-800 text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-medium">Review before applying</p>
              <p className="mt-1">
                These changes will be logged to history. In a production app, 
                they would modify files on your disk with automatic backups.
              </p>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4">
            {byAction.rename.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-blue-700 mb-1">
                  <FileEdit className="w-4 h-4" />
                  <span className="font-medium">Renames</span>
                </div>
                <p className="text-2xl font-bold text-blue-900">{byAction.rename.length}</p>
              </div>
            )}
            {byAction.delete.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-red-700 mb-1">
                  <Trash2 className="w-4 h-4" />
                  <span className="font-medium">Deletions</span>
                </div>
                <p className="text-2xl font-bold text-red-900">{byAction.delete.length}</p>
              </div>
            )}
            {byAction.move.length > 0 && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-purple-700 mb-1">
                  <FolderInput className="w-4 h-4" />
                  <span className="font-medium">Moves</span>
                </div>
                <p className="text-2xl font-bold text-purple-900">{byAction.move.length}</p>
              </div>
            )}
          </div>

          {/* Changes List */}
          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {approvedSuggestions.map((suggestion) => (
              <div 
                key={suggestion.id}
                className="bg-card border border-border rounded-lg p-4 flex items-center justify-between group hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className={cn(
                    "p-2 rounded shrink-0",
                    suggestion.action === 'rename' && "bg-blue-50 text-blue-600",
                    suggestion.action === 'delete' && "bg-red-50 text-red-600",
                    suggestion.action === 'move' && "bg-purple-50 text-purple-600",
                    suggestion.action === 'archive' && "bg-gray-50 text-gray-600",
                  )}>
                    <FileDiff className="w-5 h-5" />
                  </div>
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-sm text-muted-foreground line-through decoration-red-400/50 truncate">
                        {suggestion.originalFile.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60 truncate">
                        {suggestion.originalFile.path}
                      </p>
                    </div>
                    
                    <ArrowRight className="w-4 h-4 text-muted-foreground/30 shrink-0" />
                    
                    <div className="min-w-0 flex-1">
                      {suggestion.action === 'delete' ? (
                        <p className="font-mono text-sm font-medium text-red-600">
                          [Deleted]
                        </p>
                      ) : (
                        <p className="font-mono text-sm font-medium text-foreground truncate">
                          {suggestion.proposedName || suggestion.originalFile.name}
                        </p>
                      )}
                      {suggestion.proposedPath && (
                        <p className="text-[10px] text-muted-foreground/60 truncate">
                          {suggestion.proposedPath}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                
                <button 
                  onClick={() => rejectSuggestion(suggestion.id)}
                  className="ml-4 text-xs text-muted-foreground hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
