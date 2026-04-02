'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/store-context';
import {
  FolderPlus, Trash2, Play, Folder, Search, AlertCircle, Loader2,
  FolderOpen, Download, Monitor, FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  isFileSystemAccessSupported, pickDirectory, scanDirectoryHandle,
  computeClientStats, computeClientFolderHash,
  type ScannedFile,
  type WellKnownDirectory
} from '@/lib/client-scanner';
import { registerDirectoryHandle, unregisterDirectoryHandle } from '@/lib/client-file-ops';

export default function Home() {
  const { selectedFolders, addFolder, removeFolder, startScan, scanStatus, scanProgress, error } = useApp();
  const [folderInput, setFolderInput] = useState('');
  const router = useRouter();
  const browserSupported = isFileSystemAccessSupported();

  // Store directory handles for client-side scanning
  const dirHandlesRef = useRef<Map<string, FileSystemDirectoryHandle>>(new Map());
  const [scanFileCount, setScanFileCount] = useState(0);

  const handleAddFolder = () => {
    if (folderInput.trim()) {
      addFolder(folderInput.trim());
      setFolderInput('');
    }
  };

  const handleBrowseFolder = async (startIn?: WellKnownDirectory) => {
    try {
      const handle = await pickDirectory(startIn);
      if (handle) {
        const displayName = handle.name;
        // Avoid adding the same folder twice
        if (!selectedFolders.includes(displayName)) {
          addFolder(displayName);
          dirHandlesRef.current.set(displayName, handle);
          registerDirectoryHandle(displayName, handle);
        }
      }
    } catch (err) {
      console.error('Failed to open folder picker:', err);
    }
  };

  const handleRemoveFolder = (folder: string) => {
    removeFolder(folder);
    dirHandlesRef.current.delete(folder);
    unregisterDirectoryHandle(folder);
  };

  const [justScanned, setJustScanned] = useState(false);

  const handleScan = async () => {
    setJustScanned(true);
    setScanFileCount(0);

    // If we have directory handles, scan client-side
    if (dirHandlesRef.current.size > 0) {
      try {
        const allFiles: ScannedFile[] = [];

        for (const [, handle] of dirHandlesRef.current) {
          const files = await scanDirectoryHandle(handle, '', (count) => {
            setScanFileCount(prev => prev + count);
          });
          allFiles.push(...files);
        }

        if (allFiles.length === 0) {
          throw new Error('No files found in the selected folders. The folders may be empty.');
        }

        const stats = computeClientStats(allFiles);
        const folderHash = computeClientFolderHash(allFiles);

        await startScan(false, { files: allFiles, stats, folderHash });
      } catch (err) {
        console.error('Client-side scan error:', err);
        // The store-context will handle the error state
        await startScan(false, { files: [], stats: { totalFiles: 0, totalSize: 0, byCategory: {}, byType: {}, scannedAt: new Date().toISOString() }, folderHash: '' });
      }
    } else {
      // Fallback: server-side scan (only works locally with npm run dev)
      await startScan();
    }
  };

  // Only redirect after a new scan completes
  useEffect(() => {
    if (scanStatus === 'complete' && justScanned) {
      setJustScanned(false);
      router.push('/results');
    }
  }, [scanStatus, router, justScanned]);

  const isScanning = scanStatus === 'scanning' || scanStatus === 'analyzing';

  // Quick folder suggestions — use folder picker with startIn hint
  const quickFolders = [
    { name: 'Downloads', icon: Download, startIn: 'downloads' as WellKnownDirectory, desc: 'Your Downloads folder' },
    { name: 'Desktop', icon: Monitor, startIn: 'desktop' as WellKnownDirectory, desc: 'Your Desktop folder' },
    { name: 'Documents', icon: FileText, startIn: 'documents' as WellKnownDirectory, desc: 'Your Documents folder' },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-8 pt-10">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Scan Folders</h2>
        <p className="text-muted-foreground">
          Select the folders you want to organize. We&apos;ll analyze them without changing anything yet.
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3 text-red-800">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Scan failed</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Browser Compatibility Notice */}
      {!browserSupported && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3 text-amber-800">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Limited browser support</p>
            <p className="text-sm">
              Your browser doesn&apos;t support the Folder Access API. Please use <strong>Google Chrome</strong> or <strong>Microsoft Edge</strong> for the best experience.
            </p>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 space-y-6">
          {/* Folder Input */}
          <div className="flex gap-3">
            {browserSupported ? (
              <button
                onClick={() => handleBrowseFolder()}
                className="flex-1 flex items-center gap-3 px-4 py-3 bg-muted/30 border-2 border-dashed border-input rounded-lg hover:border-primary/50 hover:bg-accent/30 transition-all text-left group"
              >
                <FolderOpen className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                  Click to browse and select a folder...
                </span>
              </button>
            ) : (
              <>
                <div className="relative flex-1">
                  <Folder className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
                  <input
                    type="text"
                    value={folderInput}
                    onChange={(e) => setFolderInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddFolder()}
                    placeholder="Enter folder path (e.g. C:\Users\name\Downloads)..."
                    className="w-full pl-10 pr-4 py-2 bg-muted/30 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring font-mono text-sm"
                  />
                </div>
                <button
                  onClick={handleAddFolder}
                  disabled={!folderInput.trim()}
                  className="bg-muted hover:bg-muted/80 text-foreground px-4 py-2 rounded-md font-medium text-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <FolderPlus className="w-4 h-4" />
                  Add
                </button>
              </>
            )}
          </div>

          {/* Selected Folders List */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Selected Folders ({selectedFolders.length})
            </h3>
            {selectedFolders.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed border-border rounded-lg bg-muted/10">
                <Search className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No folders selected yet.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {browserSupported
                    ? 'Browse for folders like Downloads or Desktop below.'
                    : 'Add typical messy folders like Downloads or Desktop.'}
                </p>
              </div>
            ) : (
              <ul className="space-y-2 max-h-64 overflow-y-auto">
                <AnimatePresence>
                  {selectedFolders.map((folder) => (
                    <motion.li
                      key={folder}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-center justify-between p-3 bg-muted/20 border border-border rounded-lg group"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Folder className="w-5 h-5 text-primary/70 shrink-0" />
                        <span className="font-mono text-sm truncate">{folder}</span>
                        {dirHandlesRef.current.has(folder) && (
                          <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded shrink-0">
                            Ready
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleRemoveFolder(folder)}
                        className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity p-1 shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        {isScanning && (
          <div className="px-6 pb-4">
            <div className="bg-muted rounded-full h-2 overflow-hidden">
              <motion.div
                className="bg-primary h-full"
                initial={{ width: 0 }}
                animate={{ width: `${scanProgress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              {scanStatus === 'scanning'
                ? `Scanning files${scanFileCount > 0 ? ` (${scanFileCount} found)` : ''}...`
                : 'Analyzing with AI...'}
            </p>
          </div>
        )}

        {/* Footer Actions */}
        <div className="p-6 bg-muted/30 border-t border-border flex justify-between items-center">
          <p className="text-xs text-muted-foreground">
            Nothing changes until you approve suggestions.
          </p>
          <button
            onClick={handleScan}
            disabled={selectedFolders.length === 0 || isScanning}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2.5 rounded-lg font-medium shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isScanning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {scanStatus === 'scanning' ? 'Scanning...' : 'Analyzing...'}
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                Start Scan
              </>
            )}
          </button>
        </div>
      </div>
      
      {/* Quick Start — dynamic per user via folder picker */}
      {selectedFolders.length === 0 && browserSupported && (
        <div>
          <p className="text-sm text-muted-foreground mb-3">Quick add:</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {quickFolders.map((item) => (
              <button
                key={item.name}
                onClick={() => handleBrowseFolder(item.startIn)}
                className="p-4 border border-border rounded-lg hover:border-primary/50 hover:bg-accent/50 transition-colors text-left group"
              >
                <div className="flex items-center gap-2 mb-1">
                  <item.icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  <h4 className="font-medium">{item.name}</h4>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
