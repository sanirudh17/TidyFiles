'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { applyFileChanges, type ApplyResponse } from '@/lib/client-file-ops';

// Types
export interface ScannedFile {
  id: string;
  name: string;
  path: string;
  size: number;
  lastModified: number;
  extension: string;
  type: 'document' | 'image' | 'spreadsheet' | 'archive' | 'audio' | 'video' | 'code' | 'unknown';
  category: string;
  hash?: string; // SHA-256 hash for caching
}

export interface Suggestion {
  id: string;
  fileId: string;
  originalFile: ScannedFile;
  action: 'rename' | 'move' | 'delete' | 'merge' | 'archive';
  proposedName?: string;
  proposedPath?: string;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  confidenceScore?: number; // 0-1 numeric score for progress bars
  aiExplanation?: string; // Detailed explanation for "Why?" popover
  status: 'pending' | 'approved' | 'rejected';
  riskLevel?: 'safe' | 'warning' | 'critical'; // Windows system file protection
}

export interface ScanStats {
  totalFiles: number;
  totalSize: number;
  byCategory: Record<string, { count: number; size: number }>;
  byType: Record<string, { count: number; size: number }>;
  scannedAt: string;
}

// Cache entry for storing folder scan results with decision tracking
export interface FileDecision {
  originalName: string;
  appliedName?: string; // If renamed
  action: 'applied' | 'rejected' | 'pending';
  appliedAt?: string;
  confidence: number;
}

export interface FolderCacheEntry {
  folderHash: string;
  baselineHash: string; // Hash before any changes
  suggestions: Suggestion[];
  files: ScannedFile[];
  stats: ScanStats;
  cachedAt: string;
  isOptimized: boolean; // User marked as "perfect"
  status: 'clean' | 'dirty' | 'perfect';
  decisions: Record<string, FileDecision>; // keyed by original file path
}

export interface AppSettings {
  dateFormat: 'YYYY-MM-DD' | 'DD-MM-YYYY' | 'MM-DD-YYYY';
  spaceHandling: 'keep' | 'underscore' | 'hyphen';
  createBackups: boolean;
  requireConfirmation: boolean;
  exclusions: string[];
}

// Types for state-aware undo
export interface FileAction {
  type: 'rename' | 'move' | 'delete' | 'restore';
  fromPath: string;
  toPath?: string;
  size: number;
  lastModified: string;
  fileId: string;
}

export interface HistoryEntry {
  id: string;
  date: string;
  action: string;
  details: string;
  status: 'Success' | 'Failed' | 'Undone';
  rootFolder: string; // Root folder for this operation
  snapshotHashBefore: string; // Tree hash before changes
  snapshotHashAfter: string; // Tree hash after changes
  changes: Array<{
    fileId: string;
    originalPath: string;
    originalName: string;
    newPath?: string;
    newName?: string;
    action: string;
    size?: number;
    lastModified?: string;
  }>;
  // Undo safety status (computed on-demand)
  undoSafety?: 'safe' | 'partial' | 'unsafe';
}

interface AppState {
  scanStatus: 'idle' | 'scanning' | 'analyzing' | 'complete' | 'error';
  scanProgress: number;
  selectedFolders: string[];
  files: ScannedFile[];
  suggestions: Suggestion[];
  stats: ScanStats | null;
  settings: AppSettings;
  history: HistoryEntry[];
  error: string | null;
  // Cache-related state
  folderHash: string | null;
  isCacheHit: boolean;
  isOptimized: boolean;
}

interface AppContextType extends AppState {
  addFolder: (path: string) => void;
  removeFolder: (path: string) => void;
  startScan: (forceRescan?: boolean, preScannedData?: { files: ScannedFile[]; stats: ScanStats; folderHash: string }) => Promise<void>;
  approveSuggestion: (id: string) => void;
  rejectSuggestion: (id: string) => void;
  approveAll: () => void;
  rejectAll: () => void;
  applyChanges: (options?: { createBackups?: boolean }) => Promise<ApplyResponse | undefined>;
  recordUndoResult: (entryId: string, result: { undone: number; failed: number; results: Array<{ success: boolean; fileId: string; error?: string }> }) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  resetScan: () => void;
  markAsOptimized: () => void;
  clearCache: () => void;
  clearHistory: () => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  dateFormat: 'YYYY-MM-DD',
  spaceHandling: 'keep',
  createBackups: true,
  requireConfirmation: true,
  exclusions: ['node_modules', '.git', '.DS_Store', 'Thumbs.db', '*.tmp'],
};

const AppContext = createContext<AppContextType | undefined>(undefined);

// LocalStorage keys
const STORAGE_KEYS = {
  settings: 'tidyfiles_settings',
  history: 'tidyfiles_history',
  folders: 'tidyfiles_folders',
  cache: 'tidyfiles_cache', // New: folder cache
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>({
    scanStatus: 'idle',
    scanProgress: 0,
    selectedFolders: [],
    files: [],
    suggestions: [],
    stats: null,
    settings: DEFAULT_SETTINGS,
    history: [],
    error: null,
    folderHash: null,
    isCacheHit: false,
    isOptimized: false,
  });

  // Get cache key for current folder selection
  const getCacheKey = useCallback((folders: string[]): string => {
    return folders.sort().join('|').toLowerCase();
  }, []);

  // Get cached entry for folders
  const getCachedEntry = useCallback((folders: string[]): FolderCacheEntry | null => {
    if (typeof window === 'undefined') return null;
    try {
      const cacheStr = localStorage.getItem(STORAGE_KEYS.cache);
      if (!cacheStr) return null;
      const cache = JSON.parse(cacheStr) as Record<string, FolderCacheEntry>;
      const key = getCacheKey(folders);
      return cache[key] || null;
    } catch {
      return null;
    }
  }, [getCacheKey]);

  // Save cache entry for folders
  const saveCacheEntry = useCallback((folders: string[], entry: FolderCacheEntry) => {
    if (typeof window === 'undefined') return;
    try {
      const cacheStr = localStorage.getItem(STORAGE_KEYS.cache);
      const cache = cacheStr ? JSON.parse(cacheStr) : {};
      const key = getCacheKey(folders);
      cache[key] = entry;
      localStorage.setItem(STORAGE_KEYS.cache, JSON.stringify(cache));
    } catch (e) {
      console.warn('Failed to save cache:', e);
    }
  }, [getCacheKey]);

  // Load settings from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedSettings = localStorage.getItem(STORAGE_KEYS.settings);
        const savedHistory = localStorage.getItem(STORAGE_KEYS.history);
        const savedFolders = localStorage.getItem(STORAGE_KEYS.folders);
        
        setState(prev => ({
          ...prev,
          settings: savedSettings ? { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) } : DEFAULT_SETTINGS,
          history: savedHistory ? JSON.parse(savedHistory) : [],
          selectedFolders: savedFolders ? JSON.parse(savedFolders) : [],
        }));
      } catch (e) {
        console.warn('Failed to load from localStorage:', e);
      }
    }
  }, []);

  // Save settings to localStorage when they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(state.settings));
    }
  }, [state.settings]);

  // Save history to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(state.history));
    }
  }, [state.history]);

  // Save folders to localStorage when they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.folders, JSON.stringify(state.selectedFolders));
    }
  }, [state.selectedFolders]);

  const addFolder = useCallback((path: string) => {
    setState(prev => ({
      ...prev,
      selectedFolders: prev.selectedFolders.includes(path) 
        ? prev.selectedFolders 
        : [...prev.selectedFolders, path]
    }));
  }, []);

  const removeFolder = useCallback((path: string) => {
    // Cascade cleanup: clear all related data for this folder
    if (typeof window !== 'undefined') {
      try {
        // Remove cache entries that include this folder
        const cacheStr = localStorage.getItem(STORAGE_KEYS.cache);
        if (cacheStr) {
          const cache = JSON.parse(cacheStr) as Record<string, FolderCacheEntry>;
          const keysToRemove: string[] = [];
          
          for (const key of Object.keys(cache)) {
            // Check if this cache key includes the removed folder
            if (key.toLowerCase().includes(path.toLowerCase())) {
              keysToRemove.push(key);
            }
          }
          
          for (const key of keysToRemove) {
            delete cache[key];
          }
          
          localStorage.setItem(STORAGE_KEYS.cache, JSON.stringify(cache));
        }
      } catch (e) {
        console.warn('Failed to cascade cleanup cache:', e);
      }
    }
    
    setState(prev => {
      // Filter out files from this folder
      const remainingFiles = prev.files.filter(f => !f.path.toLowerCase().startsWith(path.toLowerCase()));
      const remainingFileIds = new Set(remainingFiles.map(f => f.id));
      
      // Filter out suggestions for files in this folder
      const remainingSuggestions = prev.suggestions.filter(s => remainingFileIds.has(s.fileId));
      
      // Mark history entries from this folder (we keep them but could add a marker)
      // For now, we'll keep history intact for audit purposes
      
      return {
        ...prev,
        selectedFolders: prev.selectedFolders.filter(f => f !== path),
        files: remainingFiles,
        suggestions: remainingSuggestions,
        // Reset scan state if we removed all folders
        ...(prev.selectedFolders.length === 1 && prev.selectedFolders[0] === path ? {
          scanStatus: 'idle' as const,
          scanProgress: 0,
          stats: null,
          folderHash: null,
          isCacheHit: false,
          isOptimized: false,
        } : {}),
      };
    });
  }, []);

  const startScan = useCallback(async (forceRescan: boolean = false, preScannedData?: { files: ScannedFile[]; stats: ScanStats; folderHash: string }) => {
    setState(prev => ({ 
      ...prev, 
      scanStatus: 'scanning', 
      scanProgress: 0,
      error: null,
      files: [],
      suggestions: [],
      stats: null,
      isCacheHit: false,
      isOptimized: false,
    }));

    try {
      // Check for cached entry
      const cachedEntry = getCachedEntry(state.selectedFolders);
      const cachedFolderHash = cachedEntry?.folderHash || null;
      
      // Step 1: Get file data (client-side or server-side)
      setState(prev => ({ ...prev, scanProgress: 10 }));

      let scanData: { files: ScannedFile[]; stats: ScanStats; folderHash: string; isCacheHit: boolean };

      if (preScannedData) {
        // Client-side scan already completed (for Vercel deployment)
        const isCacheHit = !forceRescan && cachedFolderHash === preScannedData.folderHash;
        scanData = { ...preScannedData, isCacheHit };
      } else {
        const browserCanAccessFoldersDirectly =
          typeof window !== 'undefined' && 'showDirectoryPicker' in window;

        if (browserCanAccessFoldersDirectly && state.selectedFolders.length > 0) {
          throw new Error('Please re-select your folder from the Scan page before scanning. Saved folder paths alone are not accessible in the deployed web app.');
        }

        // Server-side scan fallback (for local development)
        const scanResponse = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            folders: state.selectedFolders,
            cachedFolderHash: forceRescan ? null : cachedFolderHash,
            forceRescan,
          }),
        });

        if (!scanResponse.ok) {
          throw new Error('Failed to scan folders');
        }

        scanData = await scanResponse.json();
      }

      if (!scanData.files || scanData.files.length === 0) {
        throw new Error('No files were found to analyze. If you are using the deployed app, re-pick the folder with the browser folder picker first.');
      }

      const { folderHash, isCacheHit } = scanData;
      
      // If cache hit and folder is optimized, skip analysis
      if (isCacheHit && cachedEntry && !forceRescan) {
        setState(prev => ({
          ...prev,
          scanStatus: 'complete',
          scanProgress: 100,
          files: cachedEntry.files,
          suggestions: cachedEntry.suggestions,
          stats: cachedEntry.stats,
          folderHash,
          isCacheHit: true,
          isOptimized: cachedEntry.isOptimized,
        }));
        return;
      }
      
      setState(prev => ({ 
        ...prev, 
        scanStatus: 'analyzing',
        scanProgress: 50,
        files: scanData.files,
        stats: scanData.stats,
        folderHash,
      }));

      // Step 2: Analyze with AI
      const analyzeResponse = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          files: scanData.files,
          settings: state.settings,
        }),
      });

      if (!analyzeResponse.ok) {
        throw new Error('Failed to analyze files');
      }

      const analyzeData = await analyzeResponse.json();

      // Save to cache with decision tracking
      const cacheEntry: FolderCacheEntry = {
        folderHash,
        baselineHash: folderHash,
        suggestions: analyzeData.suggestions,
        files: scanData.files,
        stats: scanData.stats,
        cachedAt: new Date().toISOString(),
        isOptimized: false,
        status: analyzeData.suggestions.length === 0 ? 'clean' : 'dirty',
        decisions: {},
      };
      saveCacheEntry(state.selectedFolders, cacheEntry);

      setState(prev => ({
        ...prev,
        scanStatus: 'complete',
        scanProgress: 100,
        suggestions: analyzeData.suggestions,
        folderHash,
        isCacheHit: false,
        isOptimized: false,
        stats: {
          ...prev.stats!,
          ...scanData.stats,
        },
      }));

    } catch (error) {
      console.error('Scan error:', error);
      setState(prev => ({
        ...prev,
        scanStatus: 'error',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }));
    }
  }, [state.selectedFolders, state.settings, getCachedEntry, saveCacheEntry]);

  const approveSuggestion = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      suggestions: prev.suggestions.map(s =>
        s.id === id ? { ...s, status: 'approved' as const } : s
      )
    }));
  }, []);

  const rejectSuggestion = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      suggestions: prev.suggestions.map(s =>
        s.id === id ? { ...s, status: 'rejected' as const } : s
      )
    }));
  }, []);

  const approveAll = useCallback(() => {
    setState(prev => ({
      ...prev,
      suggestions: prev.suggestions.map(s =>
        s.status === 'pending' ? { ...s, status: 'approved' as const } : s
      )
    }));
  }, []);

  const rejectAll = useCallback(() => {
    setState(prev => ({
      ...prev,
      suggestions: prev.suggestions.map(s =>
        s.status === 'pending' ? { ...s, status: 'rejected' as const } : s
      )
    }));
  }, []);

  const applyChanges = useCallback(async (options?: { createBackups?: boolean }) => {
    const approvedSuggestions = state.suggestions.filter(s => s.status === 'approved');
    const rejectedSuggestions = state.suggestions.filter(s => s.status === 'rejected');
    const suggestionKey = (suggestion: Suggestion) => `${suggestion.fileId}:${suggestion.action}:${suggestion.originalFile.path}`;
    
    if (approvedSuggestions.length === 0) return;

    // Prepare changes for API
    const changes = approvedSuggestions.map(s => ({
      fileId: s.fileId,
      originalPath: s.originalFile.path,
      originalName: s.originalFile.name,
      action: s.action,
      proposedName: s.proposedName,
      proposedPath: s.proposedPath,
    }));

    try {
      const result = await applyFileChanges(changes, {
        createBackups: options?.createBackups ?? state.settings.createBackups,
      });
      const successfulResults = result.results.filter(item => item.success);
      const succeededKeys = new Set(
        successfulResults.map((item) => `${item.fileId}:${item.action}:${item.originalPath}`)
      );
      const appliedSuggestions = approvedSuggestions.filter((suggestion) => succeededKeys.has(suggestionKey(suggestion)));
      const failedApprovedSuggestions = approvedSuggestions.filter((suggestion) => !succeededKeys.has(suggestionKey(suggestion)));
      const appliedCounts = {
        rename: appliedSuggestions.filter(s => s.action === 'rename').length,
        delete: appliedSuggestions.filter(s => s.action === 'delete').length,
        move: appliedSuggestions.filter(s => s.action === 'move').length,
        archive: appliedSuggestions.filter(s => s.action === 'archive').length,
      };

      // Create history entry with actual results including original/new names for diff
      const historyEntry: HistoryEntry = {
        id: Math.random().toString(36).substring(2, 15),
        date: new Date().toISOString(),
        action: result.failed > 0 && appliedSuggestions.length > 0
          ? `Applied ${appliedSuggestions.length} of ${approvedSuggestions.length} changes`
          : appliedSuggestions.length > 0
          ? `Applied ${appliedSuggestions.length} changes`
          : `Failed to apply ${approvedSuggestions.length} changes`,
        details: `${appliedCounts.rename} renames, ${appliedCounts.delete} deletes, ${appliedCounts.move} moves, ${appliedCounts.archive} archives`,
        status: appliedSuggestions.length > 0 ? 'Success' : 'Failed',
        rootFolder: state.selectedFolders[0] || '',
        snapshotHashBefore: state.folderHash || '',
        snapshotHashAfter: result.newFolderHash || state.folderHash || '', // Will be computed by apply API
        changes: appliedSuggestions.map(s => {
          const applyRes = result.results.find(r => r.fileId === s.fileId);
          return {
            fileId: s.fileId,
            originalPath: s.originalFile.path,
            originalName: s.originalFile.name,
            newPath: applyRes?.newPath,
            newName: applyRes?.newPath ? applyRes.newPath.split(/[\\/]/).pop() : s.proposedName,
            action: s.action,
            size: s.originalFile.size,
            lastModified: new Date(s.originalFile.lastModified).toISOString(),
          };
        }),
      };

      // Update cache with decisions - mark applied and rejected
      const cachedEntry = getCachedEntry(state.selectedFolders);

      if (cachedEntry) {
        const updatedDecisions = { ...cachedEntry.decisions };
        
        // Mark approved suggestions as applied
        for (const s of approvedSuggestions) {
          if (!succeededKeys.has(suggestionKey(s))) {
            continue;
          }

          updatedDecisions[s.originalFile.path] = {
            originalName: s.originalFile.name,
            appliedName: s.proposedName,
            action: 'applied',
            appliedAt: new Date().toISOString(),
            confidence: s.confidenceScore || 0.8,
          };
        }
        
        // Mark rejected suggestions as rejected
        for (const s of rejectedSuggestions) {
          updatedDecisions[s.originalFile.path] = {
            originalName: s.originalFile.name,
            action: 'rejected',
            appliedAt: new Date().toISOString(),
            confidence: s.confidenceScore || 0.8,
          };
        }
        
        // Check if all suggestions are handled
        const remainingSuggestions = [
          ...state.suggestions.filter(s => s.status === 'pending'),
          ...failedApprovedSuggestions,
        ];
        const allHandled = remainingSuggestions.length === 0;
        
        const updatedCache: FolderCacheEntry = {
          ...cachedEntry,
          decisions: updatedDecisions,
          status: allHandled ? 'perfect' : 'dirty',
          isOptimized: allHandled,
        };
        saveCacheEntry(state.selectedFolders, updatedCache);
        
        // Update state to reflect optimized status
        if (allHandled) {
          setState(prev => ({
            ...prev,
            isOptimized: true,
          }));
        }
      }

      setState(prev => ({
        ...prev,
        history: historyEntry.changes.length > 0 || historyEntry.status === 'Failed'
          ? [historyEntry, ...prev.history]
          : prev.history,
        suggestions: prev.suggestions.filter((suggestion) =>
          suggestion.status === 'pending' ||
          (suggestion.status === 'approved' && failedApprovedSuggestions.some((failed) => suggestionKey(failed) === suggestionKey(suggestion)))
        ),
      }));

      return result;
    } catch (error) {
      console.error('Failed to apply changes:', error);
      
      // Still log to history as failed
      const historyEntry: HistoryEntry = {
        id: Math.random().toString(36).substring(2, 15),
        date: new Date().toISOString(),
        action: `Failed to apply ${approvedSuggestions.length} changes`,
        details: error instanceof Error ? error.message : 'Unknown error',
        status: 'Failed',
        rootFolder: state.selectedFolders[0] || '',
        snapshotHashBefore: state.folderHash || '',
        snapshotHashAfter: state.folderHash || '',
        changes: [],
      };

      setState(prev => ({
        ...prev,
        history: [historyEntry, ...prev.history],
      }));

      throw error;
    }
  }, [state.suggestions, state.settings.createBackups, state.selectedFolders, state.folderHash, getCachedEntry, saveCacheEntry]);

  const updateSettings = useCallback((newSettings: Partial<AppSettings>) => {
    setState(prev => ({
      ...prev,
      settings: { ...prev.settings, ...newSettings }
    }));
  }, []);

  const recordUndoResult = useCallback((
    entryId: string,
    result: { undone: number; failed: number; results: Array<{ success: boolean; fileId: string; error?: string }> }
  ) => {
    const successfulFileIds = new Set(
      result.results.filter((item) => item.success).map((item) => item.fileId)
    );

    if (successfulFileIds.size === 0) {
      return;
    }

    setState(prev => ({
      ...prev,
      history: prev.history.map(entry => {
        if (entry.id !== entryId) {
          return entry;
        }

        const totalChanges = entry.changes.length;
        const remainingChanges = entry.changes.filter(change => !successfulFileIds.has(change.fileId));
        const revertedCount = totalChanges - remainingChanges.length;

        if (revertedCount === 0) {
          return entry;
        }

        return {
          ...entry,
          status: remainingChanges.length === 0 ? 'Undone' : 'Success',
          action: remainingChanges.length === 0
            ? `Undid ${revertedCount} change${revertedCount === 1 ? '' : 's'}`
            : `Undid ${revertedCount} of ${totalChanges} changes`,
          details: remainingChanges.length === 0
            ? result.failed > 0
              ? `${result.failed} change${result.failed === 1 ? '' : 's'} could not be undone`
              : 'All applied changes were restored'
            : `${remainingChanges.length} change${remainingChanges.length === 1 ? '' : 's'} still applied`,
          changes: remainingChanges,
        };
      }),
    }));
  }, []);

  const resetScan = useCallback(() => {
    setState(prev => ({
      ...prev,
      scanStatus: 'idle',
      scanProgress: 0,
      files: [],
      suggestions: [],
      stats: null,
      error: null,
      folderHash: null,
      isCacheHit: false,
      isOptimized: false,
    }));
  }, []);

  const markAsOptimized = useCallback(() => {
    if (!state.folderHash) return;
    
    const cachedEntry = getCachedEntry(state.selectedFolders);
    if (cachedEntry) {
      cachedEntry.isOptimized = true;
      saveCacheEntry(state.selectedFolders, cachedEntry);
    }
    
    setState(prev => ({
      ...prev,
      isOptimized: true,
    }));
  }, [state.folderHash, state.selectedFolders, getCachedEntry, saveCacheEntry]);

  const clearCache = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        const cacheStr = localStorage.getItem(STORAGE_KEYS.cache);
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const key = getCacheKey(state.selectedFolders);
          delete cache[key];
          localStorage.setItem(STORAGE_KEYS.cache, JSON.stringify(cache));
        }
      } catch (e) {
        console.warn('Failed to clear cache:', e);
      }
    }
    
    setState(prev => ({
      ...prev,
      isCacheHit: false,
      isOptimized: false,
    }));
  }, [getCacheKey, state.selectedFolders]);

  const clearHistory = useCallback(() => {
    setState(prev => ({
      ...prev,
      history: [],
    }));
  }, []);

  return (
    <AppContext.Provider value={{
      ...state,
      addFolder,
      removeFolder,
      startScan,
      approveSuggestion,
      rejectSuggestion,
      approveAll,
      rejectAll,
      applyChanges,
      recordUndoResult,
      updateSettings,
      resetScan,
      markAsOptimized,
      clearCache,
      clearHistory,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
