'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '@/lib/store-context';
import { useRouter } from 'next/navigation';
import { 
  Check, 
  X, 
  FileText, 
  ArrowRight,
  Filter,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  CheckCheck,
  XCircle,
  HelpCircle,
  Folder,
  AlertTriangle,
  Shield,
  Image as ImageIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type FilterAction = 'all' | 'rename' | 'delete' | 'move' | 'archive';
type FilterConfidence = 'all' | 'high' | 'medium' | 'low';

const ITEMS_PER_PAGE = 20;

// Helper to get folder depth and breadcrumb
function getPathInfo(fullPath: string, selectedFolders: string[]) {
  // Normalize path separators
  const normalized = fullPath.replace(/\//g, '\\');
  
  // Find the root folder this file belongs to
  let rootFolder = '';
  for (const folder of selectedFolders) {
    const normalizedFolder = folder.replace(/\//g, '\\');
    if (normalized.startsWith(normalizedFolder)) {
      rootFolder = normalizedFolder;
      break;
    }
  }
  
  if (!rootFolder) {
    return { depth: 0, breadcrumb: [], parentFolder: '', isNested: false };
  }
  
  // Get the relative path
  const relativePath = normalized.slice(rootFolder.length).replace(/^\\/, '');
  const parts = relativePath.split('\\').filter(Boolean);
  
  // Remove the filename to get folder parts
  const folderParts = parts.slice(0, -1);
  const depth = folderParts.length;
  
  // Build breadcrumb (root folder name + subfolder names)
  const rootName = rootFolder.split('\\').pop() || rootFolder;
  const breadcrumb = [rootName, ...folderParts];
  
  return {
    depth,
    breadcrumb,
    parentFolder: folderParts.length > 0 ? folderParts[folderParts.length - 1] : '',
    isNested: depth >= 1
  };
}

// Confidence bar component
function ConfidenceBar({ score, label }: { score?: number; label: 'high' | 'medium' | 'low' }) {
  const numericScore = score ?? (label === 'high' ? 0.9 : label === 'medium' ? 0.7 : 0.5);
  const percentage = Math.round(numericScore * 100);
  
  const barColor = numericScore >= 0.85 
    ? 'bg-green-500' 
    : numericScore >= 0.7 
      ? 'bg-amber-500' 
      : 'bg-red-400';
  
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div 
          className={cn("h-full rounded-full transition-all", barColor)}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-[10px] font-medium text-muted-foreground w-8">
        {percentage}%
      </span>
    </div>
  );
}

// Portal-based popover with smart positioning
function WhyPopover({ explanation, reason, confidence, fileName }: { explanation?: string; reason: string; confidence?: string; fileName?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, placement: 'top' as 'top' | 'bottom' });
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const popoverRef = React.useRef<HTMLDivElement>(null);
  
  const displayText = explanation || reason;

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) {
      return;
    }

    const rect = buttonRef.current.getBoundingClientRect();
    const popoverWidth = 320;
    const popoverHeight = 220;
    const placement = rect.top > popoverHeight ? 'top' : 'bottom';

    let left = rect.right - popoverWidth + 20;
    if (left < 16) {
      left = rect.left - 20;
    }
    if (left + popoverWidth > window.innerWidth - 16) {
      left = window.innerWidth - popoverWidth - 16;
    }

    const top = placement === 'top' ? rect.top - 8 : rect.bottom + 8;
    setPosition({ top, left, placement });
  }, []);
  
  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen]);
  
  return (
    <>
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          if (isOpen) {
            setIsOpen(false);
            return;
          }

          updatePosition();
          setIsOpen(true);
        }}
        className="p-1 hover:bg-muted rounded-full text-muted-foreground hover:text-foreground transition-colors"
        title="Why this suggestion?"
        aria-label="View explanation"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      
      {isOpen && typeof window !== 'undefined' && createPortal(
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-[100]" 
            onClick={() => setIsOpen(false)}
          />
          {/* Popover - improved styling per PRD */}
          <div 
            ref={popoverRef}
            className={cn(
              "fixed z-[101] w-[320px] bg-white border border-border rounded-xl",
              "animate-in fade-in-0 zoom-in-95 duration-150"
            )}
            style={{
              top: position.placement === 'top' ? position.top : position.top,
              left: position.left,
              transform: position.placement === 'top' ? 'translateY(-100%)' : 'translateY(0)',
              boxShadow: '0 18px 40px rgba(15, 23, 42, 0.25)',
              padding: '12px 14px',
            }}
          >
            {/* Arrow */}
            <div 
              className={cn(
                "absolute w-3 h-3 bg-white border-border rotate-45",
                position.placement === 'top' 
                  ? "bottom-0 translate-y-1/2 border-r border-b" 
                  : "top-0 -translate-y-1/2 border-l border-t"
              )}
              style={{ right: 24 }}
            />
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-[13px] text-foreground">Why this suggestion?</h4>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-0.5 hover:bg-muted rounded-md transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
              
              {/* File name for context */}
              {fileName && (
                <p className="text-[11px] text-muted-foreground truncate font-mono bg-muted/50 px-2 py-1 rounded">
                  {fileName}
                </p>
              )}
              
              {confidence && (
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-medium uppercase",
                    confidence === 'high' ? 'bg-green-100 text-green-700' :
                    confidence === 'medium' ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-700'
                  )}>
                    {confidence} confidence
                  </span>
                </div>
              )}
              
              <div className="text-[13px] text-gray-600 leading-relaxed max-h-[180px] overflow-y-auto">
                {displayText.split('\n').map((line, i) => {
                  // Handle markdown-style bold
                  if (line.startsWith('**') && line.includes(':**')) {
                    const [label, ...rest] = line.split(':**');
                    return (
                      <p key={i} className={i > 0 ? 'mt-2' : ''}>
                        <strong className="text-foreground">{label.replace(/\*\*/g, '')}:</strong>{' '}
                        {rest.join(':**').replace(/\*\*/g, '')}
                      </p>
                    );
                  }
                  if (line.startsWith('**') && line.endsWith('**')) {
                    return <p key={i} className={cn("font-semibold text-foreground", i > 0 && 'mt-2')}>{line.slice(2, -2)}</p>;
                  }
                  // Handle numbered lists
                  if (/^\d+\)/.test(line)) {
                    return <p key={i} className={cn("pl-3", i > 0 && 'mt-1')}>{line}</p>;
                  }
                  return <p key={i} className={i > 0 ? 'mt-2' : ''}>{line}</p>;
                })}
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}

// Breadcrumb path display component with enhanced parent folder visibility
function FilePath({ path, name, selectedFolders, isScreenshot, onFolderClick }: { 
  path: string; 
  name: string; 
  selectedFolders: string[];
  isScreenshot?: boolean;
  onFolderClick?: (folderPath: string) => void;
}) {
  const pathInfo = getPathInfo(path, selectedFolders);
  
  return (
    <div className="space-y-1">
      {/* Primary filename */}
      <div className="flex items-center gap-2">
        <div className={cn(
          "w-6 h-6 rounded flex items-center justify-center shrink-0",
          isScreenshot ? "bg-purple-100 text-purple-600" : "bg-muted text-muted-foreground"
        )}>
          {isScreenshot ? <ImageIcon className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
        </div>
        <p className="font-medium truncate text-sm" title={name}>
          {name}
        </p>
      </div>
      
      {/* Parent folder (prominent) */}
      {pathInfo.parentFolder && (
        <button
          onClick={() => onFolderClick?.(pathInfo.parentFolder)}
          className="flex items-center gap-1.5 text-left group hover:bg-muted/50 rounded px-1 -mx-1 transition-colors"
        >
          <Folder className="w-3.5 h-3.5 text-blue-500" />
          <span className="text-xs font-medium text-blue-600 group-hover:text-blue-700">
            {pathInfo.parentFolder}/
          </span>
        </button>
      )}
      
      {/* Root context (muted) */}
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
        {pathInfo.breadcrumb.slice(0, -1).map((part, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span>/</span>}
            <span>{part}</span>
          </React.Fragment>
        ))}
        {pathInfo.breadcrumb.length > 1 && <span className="text-muted-foreground/50">(root)</span>}
      </div>
      
      {/* Deep nesting warning */}
      {pathInfo.depth >= 3 && (
        <div className="flex items-center gap-1.5 mt-1">
          <AlertTriangle className="w-3 h-3 text-amber-500" />
          <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded font-medium">
            Deep folder ({pathInfo.depth} levels)
          </span>
        </div>
      )}
    </div>
  );
}

// Confirmation dialog for nested folder deletions
function ConfirmDialog({ 
  isOpen, 
  onClose, 
  onConfirm, 
  fileName, 
  parentFolder 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onConfirm: () => void;
  fileName: string;
  parentFolder: string;
}) {
  if (!isOpen) return null;
  
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-amber-100 rounded-full">
            <AlertTriangle className="w-6 h-6 text-amber-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg">Delete file in subfolder?</h3>
            <p className="text-muted-foreground text-sm mt-2">
              You&apos;re about to delete <strong className="text-foreground">{fileName}</strong> which is inside the <strong className="text-foreground">{parentFolder}</strong> folder.
            </p>
            <p className="text-muted-foreground text-sm mt-2">
              This may belong to an installed application. Are you sure you want to proceed?
            </p>
          </div>
        </div>
        
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Yes, Delete
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function SuggestionsPage() {
  const { suggestions, approveSuggestion, rejectSuggestion, approveAll, rejectAll, scanStatus, selectedFolders } = useApp();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterAction, setFilterAction] = useState<FilterAction>('all');
  const [filterConfidence, setFilterConfidence] = useState<FilterConfidence>('all');
  const [filterFolder, setFilterFolder] = useState<string>(''); // Filter by parent folder
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; suggestionId: string; fileName: string; parentFolder: string } | null>(null);
  const router = useRouter();

  // Filter to only pending suggestions
  const pendingSuggestions = useMemo(() => {
    return suggestions.filter(s => s.status === 'pending');
  }, [suggestions]);

  // Get unique parent folders for filtering
  const uniqueFolders = useMemo(() => {
    const folders = new Set<string>();
    pendingSuggestions.forEach(s => {
      const pathInfo = getPathInfo(s.originalFile.path, selectedFolders);
      if (pathInfo.parentFolder) {
        folders.add(pathInfo.parentFolder);
      }
    });
    return Array.from(folders).sort();
  }, [pendingSuggestions, selectedFolders]);

  // Apply filters
  const filteredSuggestions = useMemo(() => {
    return pendingSuggestions.filter(s => {
      if (filterAction !== 'all' && s.action !== filterAction) return false;
      if (filterConfidence !== 'all' && s.confidence !== filterConfidence) return false;
      if (filterFolder) {
        const pathInfo = getPathInfo(s.originalFile.path, selectedFolders);
        if (pathInfo.parentFolder !== filterFolder) return false;
      }
      return true;
    });
  }, [pendingSuggestions, filterAction, filterConfidence, filterFolder, selectedFolders]);

  // Handle folder filter click from FilePath
  const handleFolderClick = useCallback((folder: string) => {
    setFilterFolder(prev => prev === folder ? '' : folder);
    setCurrentPage(1);
  }, []);

  // Pagination
  const totalPages = Math.ceil(filteredSuggestions.length / ITEMS_PER_PAGE);
  const paginatedSuggestions = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredSuggestions.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredSuggestions, currentPage]);

  // Check if a file is a screenshot
  const isScreenshot = useCallback((name: string) => {
    return /^(Screenshot|Screen Shot|IMG_|DSC_|Photo_|VID_)/i.test(name);
  }, []);

  // Handle approve with nested folder check
  const handleApprove = useCallback((suggestion: typeof suggestions[0]) => {
    const pathInfo = getPathInfo(suggestion.originalFile.path, selectedFolders);
    
    // If deleting a deeply nested file, show confirmation
    if (suggestion.action === 'delete' && pathInfo.depth >= 2) {
      setConfirmDialog({
        isOpen: true,
        suggestionId: suggestion.id,
        fileName: suggestion.originalFile.name,
        parentFolder: pathInfo.parentFolder
      });
    } else {
      approveSuggestion(suggestion.id);
    }
  }, [selectedFolders, approveSuggestion]);

  const actionCounts = useMemo(() => {
    const counts = { rename: 0, delete: 0, move: 0, archive: 0, merge: 0 };
    pendingSuggestions.forEach(s => {
      if (s.action in counts) counts[s.action as keyof typeof counts]++;
    });
    return counts;
  }, [pendingSuggestions]);

  const protectedCount = useMemo(() => {
    return pendingSuggestions.filter(s => {
      const path = s.originalFile.path.toLowerCase();
      return path.includes('program files') || 
             path.includes('windows') || 
             path.includes('appdata') ||
             /\.(dll|exe|sys)$/i.test(s.originalFile.name);
    }).length;
  }, [pendingSuggestions]);

  const approvedCount = suggestions.filter(s => s.status === 'approved').length;

  // Show friendly message if no scan
  if (scanStatus !== 'complete') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <Sparkles className="w-16 h-16 text-muted-foreground/30" />
        <div className="text-center">
          <h3 className="text-lg font-medium mb-2">No suggestions yet</h3>
          <p className="text-muted-foreground text-sm mb-4">Run a scan to get AI-powered suggestions for your files.</p>
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

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleAll = () => {
    const pageIds = paginatedSuggestions.map(s => s.id);
    const allSelected = pageIds.every(id => selectedIds.has(id));
    
    if (allSelected) {
      const newSelected = new Set(selectedIds);
      pageIds.forEach(id => newSelected.delete(id));
      setSelectedIds(newSelected);
    } else {
      const newSelected = new Set(selectedIds);
      pageIds.forEach(id => newSelected.add(id));
      setSelectedIds(newSelected);
    }
  };

  const handleBulkApprove = () => {
    selectedIds.forEach(id => approveSuggestion(id));
    setSelectedIds(new Set());
  };

  const handleBulkReject = () => {
    selectedIds.forEach(id => rejectSuggestion(id));
    setSelectedIds(new Set());
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Confirmation Dialog */}
      {confirmDialog && (
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          onClose={() => setConfirmDialog(null)}
          onConfirm={() => approveSuggestion(confirmDialog.suggestionId)}
          fileName={confirmDialog.fileName}
          parentFolder={confirmDialog.parentFolder}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Suggestions Queue</h2>
          <p className="text-muted-foreground text-sm">
            {pendingSuggestions.length} pending suggestions. Nothing happens until you approve.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "px-3 py-2 bg-white border border-border rounded-md text-sm font-medium hover:bg-muted transition-colors flex items-center gap-2",
              showFilters && "bg-muted"
            )}
          >
            <Filter className="w-4 h-4" />
            Filter
          </button>
          <button 
            onClick={() => router.push('/review')}
            disabled={approvedCount === 0}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            Review Approved ({approvedCount})
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* AI Badge with protected count */}
      <div className="bg-gradient-to-r from-primary/5 to-accent/30 border border-primary/20 rounded-lg px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-primary" />
          <span className="text-sm">
            <span className="font-medium">AI-powered suggestions</span>
            <span className="text-muted-foreground ml-2">
              {actionCounts.rename} renames • {actionCounts.delete} deletes • {actionCounts.move} moves
              {protectedCount > 0 && (
                <span className="ml-2 text-amber-600">
                  <Shield className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />
                  {protectedCount} protected
                </span>
              )}
            </span>
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={approveAll}
            disabled={pendingSuggestions.length === 0}
            className="px-3 py-1.5 text-xs font-medium bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100 transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Approve All
          </button>
          <button
            onClick={rejectAll}
            disabled={pendingSuggestions.length === 0}
            className="px-3 py-1.5 text-xs font-medium bg-red-50 text-red-700 border border-red-200 rounded hover:bg-red-100 transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            <XCircle className="w-3.5 h-3.5" />
            Reject All
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-muted/30 border border-border rounded-lg p-4 flex flex-wrap gap-4 animate-in fade-in slide-in-from-top-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-2">Action Type</label>
            <div className="flex gap-1">
              {(['all', 'rename', 'delete', 'move'] as const).map(action => (
                <button
                  key={action}
                  onClick={() => { setFilterAction(action); setCurrentPage(1); }}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded border transition-colors",
                    filterAction === action
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-white border-border hover:bg-muted"
                  )}
                >
                  {action === 'all' ? 'All' : action.charAt(0).toUpperCase() + action.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-2">Confidence</label>
            <div className="flex gap-1">
              {(['all', 'high', 'medium', 'low'] as const).map(conf => (
                <button
                  key={conf}
                  onClick={() => { setFilterConfidence(conf); setCurrentPage(1); }}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded border transition-colors",
                    filterConfidence === conf
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-white border-border hover:bg-muted"
                  )}
                >
                  {conf === 'all' ? 'All' : conf.charAt(0).toUpperCase() + conf.slice(1)}
                </button>
              ))}
            </div>
          </div>
          
          {/* Folder Filter */}
          {uniqueFolders.length > 0 && (
            <div className="flex items-end gap-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-2">Parent Folder</label>
                <select
                  value={filterFolder}
                  onChange={(e) => { setFilterFolder(e.target.value); setCurrentPage(1); }}
                  className="px-3 py-1.5 text-xs font-medium rounded border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="">All Folders</option>
                  {uniqueFolders.map(folder => (
                    <option key={folder} value={folder}>{folder}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => { setFilterFolder(''); setCurrentPage(1); }}
                disabled={!filterFolder}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded border transition-colors",
                  filterFolder
                    ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
                    : "bg-muted text-muted-foreground border-border cursor-not-allowed"
                )}
                title={filterFolder ? "Clear folder filter" : "Select a folder first"}
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-accent/50 border border-accent rounded-lg p-3 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
          <span className="text-sm font-medium text-accent-foreground pl-2">
            {selectedIds.size} selected
          </span>
          <div className="flex gap-2">
            <button 
              onClick={handleBulkApprove}
              className="px-3 py-1.5 bg-white border border-border hover:bg-green-50 hover:text-green-700 hover:border-green-200 rounded text-sm font-medium transition-colors"
            >
              Approve Selected
            </button>
            <button 
              onClick={handleBulkReject}
              className="px-3 py-1.5 bg-white border border-border hover:bg-red-50 hover:text-red-700 hover:border-red-200 rounded text-sm font-medium transition-colors"
            >
              Reject Selected
            </button>
          </div>
        </div>
      )}

      {/* Active Filters Indicator */}
      {(filterAction !== 'all' || filterFolder || filterConfidence !== 'all') && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2 text-sm text-blue-700">
            <Filter className="w-4 h-4" />
            <span>Filters active:</span>
            {filterAction !== 'all' && (
              <span className="bg-blue-100 px-2 py-0.5 rounded text-xs font-medium">
                {filterAction}
              </span>
            )}
            {filterFolder && (
              <span className="bg-blue-100 px-2 py-0.5 rounded text-xs font-medium">
                Folder: {filterFolder}
              </span>
            )}
            {filterConfidence !== 'all' && (
              <span className="bg-blue-100 px-2 py-0.5 rounded text-xs font-medium">
                {filterConfidence} confidence
              </span>
            )}
          </div>
          <button
            onClick={() => { setFilterAction('all'); setFilterFolder(''); setFilterConfidence('all'); setCurrentPage(1); }}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            Clear all
          </button>
        </div>
      )}

      {/* Table */}
      <div className="border border-border rounded-lg bg-card overflow-hidden flex-1 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground font-medium border-b border-border">
              <tr>
                <th className="p-4 w-10">
                  <button onClick={toggleAll} className="flex items-center justify-center">
                    {paginatedSuggestions.length > 0 && paginatedSuggestions.every(s => selectedIds.has(s.id)) ? (
                      <CheckSquare className="w-4 h-4 text-primary" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="p-4 w-24">Type</th>
                <th className="p-4">Original File</th>
                <th className="p-4 w-8 text-center"></th>
                <th className="p-4">Proposal</th>
                <th className="p-4 w-56">Reason</th>
                <th className="p-4 w-24 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedSuggestions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-muted-foreground">
                    {filteredSuggestions.length === 0 && pendingSuggestions.length === 0
                      ? "No pending suggestions. You're all caught up!"
                      : "No suggestions match the current filters."
                    }
                  </td>
                </tr>
              ) : (
                paginatedSuggestions.map((suggestion) => {
                  const isProtected = suggestion.originalFile.path.toLowerCase().includes('program files') ||
                                     /\.(dll|exe|sys)$/i.test(suggestion.originalFile.name);
                  
                  return (
                    <tr 
                      key={suggestion.id} 
                      className={cn(
                        "group hover:bg-muted/30 transition-colors",
                        isProtected && "bg-red-50/30"
                      )}
                    >
                      <td className="p-4">
                        <button onClick={() => toggleSelection(suggestion.id)}>
                          {selectedIds.has(suggestion.id) ? (
                            <CheckSquare className="w-4 h-4 text-primary" />
                          ) : (
                            <Square className="w-4 h-4 text-muted-foreground/50 group-hover:text-muted-foreground" />
                          )}
                        </button>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border",
                            suggestion.action === 'rename' && "bg-blue-50 text-blue-700 border-blue-200",
                            suggestion.action === 'move' && "bg-purple-50 text-purple-700 border-purple-200",
                            suggestion.action === 'delete' && "bg-red-50 text-red-700 border-red-200",
                            suggestion.action === 'merge' && "bg-orange-50 text-orange-700 border-orange-200",
                            suggestion.action === 'archive' && "bg-gray-50 text-gray-700 border-gray-200",
                          )}>
                            {suggestion.action.toUpperCase()}
                          </span>
                          {isProtected && (
                            <span title="Protected file">
                              <Shield className="w-3.5 h-3.5 text-red-500" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <FilePath 
                          path={suggestion.originalFile.path}
                          name={suggestion.originalFile.name}
                          selectedFolders={selectedFolders}
                          isScreenshot={isScreenshot(suggestion.originalFile.name)}
                          onFolderClick={handleFolderClick}
                        />
                      </td>
                      <td className="p-4 text-center">
                        <ArrowRight className="w-4 h-4 text-muted-foreground/50 mx-auto" />
                      </td>
                      <td className="p-4">
                        {suggestion.action === 'rename' && suggestion.proposedName && (
                          <p className="font-mono text-sm text-blue-600 bg-blue-50/50 px-2 py-1 rounded inline-block max-w-[200px] truncate" title={suggestion.proposedName}>
                            {suggestion.proposedName}
                          </p>
                        )}
                        {suggestion.action === 'move' && suggestion.proposedPath && (
                          <p className="font-mono text-purple-600 bg-purple-50/50 px-2 py-1 rounded text-xs break-all max-w-[200px]">
                            {suggestion.proposedPath}
                          </p>
                        )}
                        {suggestion.action === 'delete' && (
                          <span className="text-red-600 font-medium text-xs">Move to Trash</span>
                        )}
                        {suggestion.action === 'archive' && (
                          <span className="text-gray-600 font-medium text-xs">Archive (old file)</span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="space-y-2">
                          <div className="flex items-start gap-1">
                            <p className="text-xs text-muted-foreground line-clamp-2 flex-1">{suggestion.reason}</p>
                            <WhyPopover 
                              explanation={suggestion.aiExplanation} 
                              reason={suggestion.reason}
                              confidence={suggestion.confidence}
                              fileName={suggestion.originalFile.name}
                            />
                          </div>
                          <ConfidenceBar score={suggestion.confidenceScore} label={suggestion.confidence} />
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button 
                            onClick={() => handleApprove(suggestion)}
                            className="p-1.5 hover:bg-green-50 text-muted-foreground hover:text-green-600 rounded-md transition-colors"
                            title="Approve"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => rejectSuggestion(suggestion.id)}
                            className="p-1.5 hover:bg-red-50 text-muted-foreground hover:text-red-600 rounded-md transition-colors"
                            title="Reject"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t border-border bg-muted/30 p-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredSuggestions.length)} of {filteredSuggestions.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium px-2">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
