'use client';

import { useApp } from '@/lib/store-context';
import { useState, useEffect, useCallback } from 'react';
import { checkUndoSafetyClientSide, performUndoClientSide, canUndoClientSide } from '@/lib/client-file-ops';
import { 
  History, 
  RotateCcw, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  Clock, 
  ArrowRight, 
  FileText,
  Shield,
  ShieldAlert,
  ShieldX,
  Loader2,
  AlertTriangle,
  Info
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface ActionSafetyResult {
  fileId: string;
  originalPath: string;
  action: string;
  status: 'safe' | 'changed' | 'missing';
  reason?: string;
}

interface UndoCheckResult {
  historyEntryId: string;
  overallSafety: 'safe' | 'partial' | 'unsafe';
  message: string;
  summary: {
    total: number;
    safe: number;
    changed: number;
    missing: number;
  };
  actions: ActionSafetyResult[];
}

// Diff view component for showing file changes
function FileDiff({ 
  originalName, 
  newName, 
  action,
  safetyStatus 
}: { 
  originalName: string; 
  newName?: string; 
  action: string;
  safetyStatus?: 'safe' | 'changed' | 'missing';
}) {
  return (
    <div className={cn(
      "flex items-center gap-2 text-xs font-mono px-3 py-2 rounded border",
      safetyStatus === 'safe' ? 'bg-green-50/50 border-green-200' :
      safetyStatus === 'changed' ? 'bg-amber-50/50 border-amber-200' :
      safetyStatus === 'missing' ? 'bg-red-50/50 border-red-200' :
      'bg-muted/50 border-border/50'
    )}>
      <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <span className={cn(
        "line-through",
        action === 'delete' ? 'text-red-600' : 'text-muted-foreground'
      )}>
        {originalName}
      </span>
      {newName && action !== 'delete' && (
        <>
          <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
          <span className="text-green-600 font-medium">{newName}</span>
        </>
      )}
      {action === 'delete' && (
        <span className="text-red-500 text-[10px] uppercase font-medium ml-2">[Deleted]</span>
      )}
      {safetyStatus && (
        <span className={cn(
          "ml-auto text-[10px] uppercase font-medium px-1.5 py-0.5 rounded",
          safetyStatus === 'safe' ? 'bg-green-100 text-green-700' :
          safetyStatus === 'changed' ? 'bg-amber-100 text-amber-700' :
          'bg-red-100 text-red-700'
        )}>
          {safetyStatus}
        </span>
      )}
    </div>
  );
}

// Safety badge component
function SafetyBadge({ safety }: { safety: 'safe' | 'partial' | 'unsafe' | 'loading' | 'unknown' }) {
  if (safety === 'loading') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-muted text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" />
        Checking...
      </span>
    );
  }

  if (safety === 'safe') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200">
        <Shield className="w-3 h-3" />
        Safe to undo
      </span>
    );
  }

  if (safety === 'partial') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
        <ShieldAlert className="w-3 h-3" />
        Partial undo
      </span>
    );
  }

  if (safety === 'unsafe') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-red-50 text-red-700 border border-red-200">
        <ShieldX className="w-3 h-3" />
        Cannot undo
      </span>
    );
  }

  return null;
}

// Partial undo confirmation modal
function PartialUndoModal({
  isOpen,
  onClose,
  onConfirm,
  checkResult,
  isLoading
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  checkResult: UndoCheckResult | null;
  isLoading: boolean;
}) {
  if (!isOpen || !checkResult) return null;

  const safeActions = checkResult.actions.filter(a => a.status === 'safe');

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-background rounded-xl border border-border shadow-xl max-w-md w-full overflow-hidden"
        >
          <div className="p-4 border-b border-border bg-amber-50">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <div>
                <h3 className="font-semibold text-amber-900">Partial Undo Available</h3>
                <p className="text-sm text-amber-700">{checkResult.message}</p>
              </div>
            </div>
          </div>

          <div className="p-4 space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-green-50 rounded-lg p-2">
                <p className="text-2xl font-bold text-green-700">{checkResult.summary.safe}</p>
                <p className="text-xs text-green-600">Safe</p>
              </div>
              <div className="bg-amber-50 rounded-lg p-2">
                <p className="text-2xl font-bold text-amber-700">{checkResult.summary.changed}</p>
                <p className="text-xs text-amber-600">Changed</p>
              </div>
              <div className="bg-red-50 rounded-lg p-2">
                <p className="text-2xl font-bold text-red-700">{checkResult.summary.missing}</p>
                <p className="text-xs text-red-600">Missing</p>
              </div>
            </div>

            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-sm text-muted-foreground flex items-start gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                Only {safeActions.length} of {checkResult.summary.total} changes can be safely reverted. 
                The folder has been modified since this operation.
              </p>
            </div>
          </div>

          <div className="p-4 border-t border-border bg-muted/30 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading || safeActions.length === 0}
              className="px-4 py-2 text-sm font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Undo {safeActions.length} Changes
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function HistoryPage() {
  const { history, recordUndoResult, clearHistory } = useApp();
  const [safetyChecks, setSafetyChecks] = useState<Record<string, UndoCheckResult>>({});
  const [loadingChecks, setLoadingChecks] = useState<Set<string>>(new Set());
  const [undoingIds, setUndoingIds] = useState<Set<string>>(new Set());
  const [partialUndoModal, setPartialUndoModal] = useState<{ isOpen: boolean; entryId: string | null }>({ isOpen: false, entryId: null });
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return {
      relative: mounted ? formatDistanceToNow(date, { addSuffix: true }) : 'Recently',
      absolute: mounted ? format(date, 'MMM d, yyyy h:mm a') : date.toISOString()
    };
  };

  const checkUndoSafety = useCallback(async (
    entryId: string,
    entryOverride?: typeof history[number]
  ) => {
    const entry = entryOverride ?? history.find(h => h.id === entryId);
    if (!entry) return;

    setLoadingChecks(prev => new Set(prev).add(entryId));

    try {
      // Use client-side check if directory handles are available (browser-based scans)
      if (canUndoClientSide(entry.changes)) {
        const result = await checkUndoSafetyClientSide(entry.changes);
        setSafetyChecks(prev => ({ ...prev, [entryId]: { historyEntryId: entryId, ...result } }));
      } else {
        // Fallback to server API for server-scanned folders
        const response = await fetch('/api/undo-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            historyEntryId: entryId,
            rootFolder: entry.rootFolder,
            snapshotHashAfter: entry.snapshotHashAfter,
            changes: entry.changes,
          }),
        });

        if (response.ok) {
          const result: UndoCheckResult = await response.json();
          setSafetyChecks(prev => ({ ...prev, [entryId]: result }));
        }
      }
    } catch (error) {
      console.error('Failed to check undo safety:', error);
    } finally {
      setLoadingChecks(prev => {
        const next = new Set(prev);
        next.delete(entryId);
        return next;
      });
    }
  }, [history]);

  const performUndo = useCallback(async (entryId: string, partial: boolean = false) => {
    const entry = history.find(h => h.id === entryId);
    const safetyCheck = safetyChecks[entryId];
    
    if (!entry) return;

    // Filter to only safe actions if partial
    let changesToUndo = entry.changes;
    if (partial && safetyCheck) {
      const safeFileIds = new Set(
        safetyCheck.actions.filter(a => a.status === 'safe').map(a => a.fileId)
      );
      changesToUndo = entry.changes.filter(c => safeFileIds.has(c.fileId));
    }

    if (changesToUndo.length === 0) return;

    setUndoingIds(prev => new Set(prev).add(entryId));

    try {
      let undoResult:
        | {
            success: boolean;
            undone: number;
            failed: number;
            results: Array<{ success: boolean; fileId: string; action: string; error?: string }>;
          }
        | undefined;

      if (canUndoClientSide(changesToUndo)) {
        // Client-side undo
        undoResult = await performUndoClientSide(changesToUndo);
      } else {
        // Server-side undo
        const response = await fetch('/api/undo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ changes: changesToUndo, partial }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result?.details || result?.error || 'Failed to undo changes');
        }

        undoResult = result;
      }

      if (!undoResult) {
        return;
      }

      const successfulFileIds = new Set(
        undoResult.results.filter(result => result.success).map(result => result.fileId)
      );
      const remainingChanges = entry.changes.filter(change => !successfulFileIds.has(change.fileId));

      if (successfulFileIds.size > 0) {
        recordUndoResult(entryId, undoResult);
      }

      if (remainingChanges.length > 0) {
        await checkUndoSafety(entryId, { ...entry, changes: remainingChanges });
      } else {
        setSafetyChecks(prev => {
          const next = { ...prev };
          delete next[entryId];
          return next;
        });
      }
    } catch (error) {
      console.error('Failed to undo:', error);
    } finally {
      setUndoingIds(prev => {
        const next = new Set(prev);
        next.delete(entryId);
        return next;
      });
      setPartialUndoModal({ isOpen: false, entryId: null });
    }
  }, [history, safetyChecks, checkUndoSafety, recordUndoResult]);

  const handleUndoClick = (entryId: string) => {
    const safety = safetyChecks[entryId];
    
    if (!safety) {
      // Check safety first
      checkUndoSafety(entryId);
      return;
    }

    if (safety.overallSafety === 'safe') {
      performUndo(entryId, false);
    } else if (safety.overallSafety === 'partial') {
      setPartialUndoModal({ isOpen: true, entryId });
    }
    // unsafe: button should be disabled
  };

  // Check safety for successful entries on mount
  useEffect(() => {
    const successfulEntries = history.filter(h => h.status === 'Success' && !safetyChecks[h.id]);
    successfulEntries.forEach(entry => {
      // Delay checks to avoid overwhelming the API
      setTimeout(() => checkUndoSafety(entry.id), Math.random() * 1000);
    });
  }, [history, safetyChecks, checkUndoSafety]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Operation History</h2>
        <p className="text-muted-foreground">View past actions and undo changes if needed.</p>
      </div>

      {history.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <Clock className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="font-medium text-lg mb-2">No history yet</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            When you apply changes to your files, they'll appear here so you can track and undo them if needed.
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <ul className="divide-y divide-border">
            {history.map((item) => {
              const dateInfo = formatDate(item.date);
              const safety = safetyChecks[item.id];
              const isLoading = loadingChecks.has(item.id);
              const isUndoing = undoingIds.has(item.id);
              const safetyStatus = isLoading ? 'loading' : safety?.overallSafety || 'unknown';
              
              return (
                <li key={item.id} className="p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <div className={`p-2 rounded-full shrink-0 ${
                        item.status === 'Success' ? 'bg-green-50 text-green-600' :
                        item.status === 'Failed' ? 'bg-red-50 text-red-600' :
                        item.status === 'Undone' ? 'bg-gray-50 text-gray-600' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {item.status === 'Success' ? <CheckCircle className="w-4 h-4" /> :
                         item.status === 'Failed' ? <XCircle className="w-4 h-4" /> :
                         item.status === 'Undone' ? <RotateCcw className="w-4 h-4" /> :
                         <History className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">{item.action}</p>
                          {item.status === 'Success' && (
                            <SafetyBadge safety={safetyStatus} />
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <span title={dateInfo.absolute}>{dateInfo.relative}</span>
                          <span>•</span>
                          <span>{item.details}</span>
                        </div>
                        
                        {/* Enhanced diff view for affected files */}
                        {item.changes.length > 0 && (
                          <details className="mt-3">
                            <summary className="text-xs text-primary cursor-pointer hover:underline font-medium">
                              View {item.changes.length} file change{item.changes.length > 1 ? 's' : ''}
                            </summary>
                            <div className="mt-3 space-y-2 max-h-60 overflow-y-auto pr-2">
                              {item.changes.slice(0, 20).map((change, idx) => {
                                const actionSafety = safety?.actions.find(a => a.fileId === change.fileId);
                                return (
                                  <FileDiff
                                    key={idx}
                                    originalName={change.originalName || change.originalPath.split('\\').pop() || ''}
                                    newName={change.newName || (change.newPath ? change.newPath.split('\\').pop() : undefined)}
                                    action={change.action}
                                    safetyStatus={actionSafety?.status}
                                  />
                                );
                              })}
                              {item.changes.length > 20 && (
                                <p className="text-xs text-muted-foreground text-center py-2">
                                  ... and {item.changes.length - 20} more changes
                                </p>
                              )}
                            </div>
                          </details>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      <span className={`text-xs font-medium px-2 py-1 rounded ${
                        item.status === 'Success' ? 'bg-green-50 text-green-700' :
                        item.status === 'Failed' ? 'bg-red-50 text-red-700' :
                        item.status === 'Undone' ? 'bg-gray-50 text-gray-700' :
                        'bg-gray-50 text-gray-700'
                      }`}>
                        {item.status}
                      </span>
                      {item.status === 'Success' && (
                        <button 
                          onClick={() => handleUndoClick(item.id)}
                          disabled={isLoading || isUndoing || safetyStatus === 'unsafe'}
                          className={cn(
                            "text-sm font-medium flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors",
                            safetyStatus === 'unsafe' 
                              ? "text-muted-foreground/50 cursor-not-allowed"
                              : safetyStatus === 'partial'
                              ? "text-amber-700 hover:bg-amber-50"
                              : "text-muted-foreground hover:text-primary hover:bg-muted"
                          )}
                          title={
                            safetyStatus === 'unsafe' ? 'Cannot undo: folder has changed significantly' :
                            safetyStatus === 'partial' ? 'Partial undo available' :
                            isLoading ? 'Checking safety...' :
                            'Undo these changes'
                          }
                        >
                          {isLoading || isUndoing ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3.5 h-3.5" />
                          )}
                          {safetyStatus === 'partial' ? 'Partial Undo...' : 'Undo'}
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {history.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={clearHistory}
            className="text-sm text-muted-foreground hover:text-destructive flex items-center gap-2 px-3 py-1.5 rounded hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Clear History
          </button>
        </div>
      )}

      {/* Partial Undo Modal */}
      <PartialUndoModal
        isOpen={partialUndoModal.isOpen}
        onClose={() => setPartialUndoModal({ isOpen: false, entryId: null })}
        onConfirm={() => partialUndoModal.entryId && performUndo(partialUndoModal.entryId, true)}
        checkResult={partialUndoModal.entryId ? safetyChecks[partialUndoModal.entryId] : null}
        isLoading={partialUndoModal.entryId ? undoingIds.has(partialUndoModal.entryId) : false}
      />
    </div>
  );
}
