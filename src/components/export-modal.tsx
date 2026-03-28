'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download,
  X,
  FileArchive,
  FileText,
  Sparkles,
  Loader2,
  CheckCircle,
  FolderOpen,
  ExternalLink,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApp } from '@/lib/store-context';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ExportType = 'folder-snapshot' | 'cleanup-report';

export function ExportModal({ isOpen, onClose }: ExportModalProps) {
  const { files, stats, history, selectedFolders } = useApp();
  const [mounted, setMounted] = useState(false);
  
  const [exportType, setExportType] = useState<ExportType>('folder-snapshot');
  const [includeAISummary, setIncludeAISummary] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{ success: boolean; filePath?: string; error?: string } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleExport = async () => {
    if (!selectedFolders[0]) return;

    setIsExporting(true);
    setExportResult(null);

    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: exportType,
          rootFolder: selectedFolders[0],
          files: files.map(f => ({
            name: f.name,
            path: f.path,
            size: f.size,
            category: f.category,
            lastModified: f.lastModified,
          })),
          history: history.map(h => ({
            date: h.date,
            action: h.action,
            details: h.details,
            status: h.status,
            changes: h.changes,
          })),
          stats: {
            totalFiles: stats?.totalFiles || 0,
            totalSize: stats?.totalSize || 0,
          },
          includeAISummary,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setExportResult({ success: true, filePath: result.filePath });
      } else {
        setExportResult({ success: false, error: result.error || 'Export failed' });
      }
    } catch (error) {
      setExportResult({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Export failed' 
      });
    } finally {
      setIsExporting(false);
    }
  };

  const resetAndClose = () => {
    setExportResult(null);
    setExportType('folder-snapshot');
    setIncludeAISummary(false);
    onClose();
  };

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999]">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="absolute inset-0 bg-black/25"
        onClick={resetAndClose}
      />

      {/* Modal - centered with top margin */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.15 }}
        className="relative mx-auto mt-[10vh] w-full max-w-lg px-4"
      >
        <div 
          className="bg-background rounded-xl border border-border overflow-hidden"
          style={{ boxShadow: '0 24px 80px rgba(15, 23, 42, 0.25)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <Download className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Export</h3>
            </div>
            <button
              onClick={resetAndClose}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
            {/* Export type selection */}
            {!exportResult && (
              <>
                <div className="space-y-3">
                  <label className="text-sm font-medium">Export Type</label>
                  
                  <button
                    onClick={() => setExportType('folder-snapshot')}
                    className={cn(
                      "w-full p-4 rounded-lg border-2 text-left transition-all",
                      exportType === 'folder-snapshot'
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <FileArchive className={cn(
                        "w-5 h-5 mt-0.5",
                        exportType === 'folder-snapshot' ? "text-primary" : "text-muted-foreground"
                      )} />
                      <div>
                        <p className="font-medium">Organized Folder Snapshot</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Generate an HTML index of your folder with file listings, categories, and statistics.
                          Perfect for documentation or sharing.
                        </p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setExportType('cleanup-report')}
                    className={cn(
                      "w-full p-4 rounded-lg border-2 text-left transition-all",
                      exportType === 'cleanup-report'
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <FileText className={cn(
                        "w-5 h-5 mt-0.5",
                        exportType === 'cleanup-report' ? "text-primary" : "text-muted-foreground"
                      )} />
                      <div>
                        <p className="font-medium">Cleanup Report</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Document all cleanup operations performed, including renames, deletes, and moves.
                          Great for auditing.
                        </p>
                      </div>
                    </div>
                  </button>
                </div>

                {/* AI Summary option (only for folder snapshot) */}
                {exportType === 'folder-snapshot' && (
                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">Include AI Summary</span>
                    </div>
                    <button
                      onClick={() => setIncludeAISummary(!includeAISummary)}
                      className={cn(
                        "w-10 h-6 rounded-full transition-colors relative",
                        includeAISummary ? "bg-primary" : "bg-muted"
                      )}
                    >
                      <div className={cn(
                        "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform",
                        includeAISummary ? "translate-x-5" : "translate-x-1"
                      )} />
                    </button>
                  </div>
                )}

                {/* Folder info */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
                  <FolderOpen className="w-4 h-4" />
                  <span className="truncate">{selectedFolders[0] || 'No folder selected'}</span>
                </div>

                {/* Safety notice */}
                <p className="text-xs text-muted-foreground bg-blue-50 text-blue-700 p-3 rounded-lg">
                  TidyFiles will not modify any files. This export only reads files to generate the report.
                </p>
              </>
            )}

            {/* Exporting state */}
            {isExporting && (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
                <p className="font-medium">Generating {exportType === 'folder-snapshot' ? 'folder index' : 'report'}...</p>
                {includeAISummary && (
                  <p className="text-sm text-muted-foreground mt-1">Including AI summary...</p>
                )}
              </div>
            )}

            {/* Success state */}
            {exportResult?.success && (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <p className="font-medium text-green-800 mb-2">Export Complete!</p>
                <p className="text-sm text-muted-foreground text-center mb-4 break-all px-4">
                  {exportResult.filePath}
                </p>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(exportResult.filePath || '');
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Copy Path
                </button>
              </div>
            )}

            {/* Error state */}
            {exportResult && !exportResult.success && (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
                  <AlertCircle className="w-8 h-8 text-red-600" />
                </div>
                <p className="font-medium text-red-800 mb-2">Export Failed</p>
                <p className="text-sm text-muted-foreground text-center">
                  {exportResult.error}
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          {!exportResult && !isExporting && (
            <div className="px-6 py-4 border-t border-border bg-muted/30 flex justify-end gap-3">
              <button
                onClick={resetAndClose}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleExport}
                disabled={!selectedFolders[0]}
                className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          )}

          {exportResult && (
            <div className="px-6 py-4 border-t border-border bg-muted/30 flex justify-end">
              <button
                onClick={resetAndClose}
                className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );

  return createPortal(
    <AnimatePresence>{modalContent}</AnimatePresence>,
    document.body
  );
}

// Export button to be placed in header or results page
export function ExportButton() {
  const [isOpen, setIsOpen] = useState(false);
  const { scanStatus } = useApp();

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        disabled={scanStatus !== 'complete'}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
          scanStatus === 'complete'
            ? "bg-muted hover:bg-muted/80 text-foreground"
            : "bg-muted/50 text-muted-foreground cursor-not-allowed"
        )}
      >
        <Download className="w-4 h-4" />
        Export
      </button>
      <ExportModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
