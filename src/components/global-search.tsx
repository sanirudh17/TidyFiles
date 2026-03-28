'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  X, 
  FileText, 
  Image as ImageIcon, 
  Film, 
  Music, 
  Archive, 
  Code, 
  FileSpreadsheet, 
  LayoutGrid,
  Loader2,
  ArrowRight,
  Sparkles,
  Folder
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApp } from '@/lib/store-context';
import { useSearch, type SearchResult } from '@/lib/use-search';

const CATEGORY_ICONS: Record<string, typeof FileText> = {
  'Documents': FileText,
  'Images': ImageIcon,
  'Videos': Film,
  'Audio': Music,
  'Archives': Archive,
  'Code': Code,
  'Spreadsheets': FileSpreadsheet,
  'Other': LayoutGrid,
};

function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  
  const terms = query.trim().split(/\s+/).filter(t => !t.includes(':'));
  if (terms.length === 0) return text;
  
  const pattern = new RegExp(`(${terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  const parts = text.split(pattern);
  
  return parts.map((part, i) => 
    terms.some(t => part.toLowerCase() === t.toLowerCase()) 
      ? <mark key={i} className="bg-yellow-200 text-yellow-900 rounded px-0.5">{part}</mark>
      : part
  );
}

export function GlobalSearch() {
  const { files, suggestions, scanStatus } = useApp();
  const { query, setQuery, results, isBuilding, isReady, totalIndexed } = useSearch(files);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

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

  // Open search with keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setQuery('');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, setQuery]);

  // Keyboard navigation in results
  useEffect(() => {
    if (!isOpen || results.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        e.preventDefault();
        handleSelectResult(results[selectedIndex]);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  // Scroll selected item into view
  useEffect(() => {
    if (resultsRef.current && results.length > 0) {
      const selectedEl = resultsRef.current.children[selectedIndex] as HTMLElement;
      selectedEl?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, results.length]);

  const handleSelectResult = (result: SearchResult) => {
    const hasSuggestion = suggestions.some(s => s.fileId === result.file.id);
    
    if (hasSuggestion) {
      router.push(`/suggestions?fileId=${result.file.id}`);
    } else {
      router.push('/results');
    }
    
    setIsOpen(false);
    setQuery('');
  };

  const suggestedFileIds = new Set(suggestions.map(s => s.fileId));

  const quickFilters = [
    { label: 'Documents', query: 'cat:Documents' },
    { label: 'Images', query: 'cat:Images' },
    { label: 'PDFs', query: 'ext:pdf' },
    { label: 'With suggestions', query: '', filterSuggestions: true },
  ];

  const searchModal = isOpen && mounted ? createPortal(
    <AnimatePresence>
      {/* Full-screen overlay container */}
      <div className="fixed inset-0 z-[9999]">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={() => {
            setIsOpen(false);
            setQuery('');
          }}
          className="absolute inset-0 bg-black/25"
          style={{ backdropFilter: 'none' }}
        />

        {/* Search panel - centered with top margin */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          transition={{ duration: 0.15 }}
          className="relative mx-auto mt-[10vh] w-full max-w-2xl px-4"
        >
          <div 
            className="bg-background rounded-xl border border-border overflow-hidden"
            style={{ boxShadow: '0 24px 80px rgba(15, 23, 42, 0.35)' }}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <Search className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search files by name, type, or folder..."
                className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="p-1 hover:bg-muted rounded-md transition-colors"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
              {isBuilding && (
                <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
              )}
            </div>

            {/* Quick filters (show when empty) */}
            {!query && (
              <div className="px-4 py-3 border-b border-border">
                <p className="text-xs text-muted-foreground mb-2">Quick filters</p>
                <div className="flex flex-wrap gap-2">
                  {quickFilters.map((filter) => (
                    <button
                      key={filter.label}
                      onClick={() => setQuery(filter.query)}
                      className="px-2.5 py-1 text-xs font-medium bg-muted hover:bg-muted/80 rounded-md transition-colors"
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Search tips */}
            {!query && (
              <div className="px-4 py-3 border-b border-border bg-muted/30">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">Tips:</span>{' '}
                  Use <code className="px-1 bg-muted rounded">ext:pdf</code> for extensions,{' '}
                  <code className="px-1 bg-muted rounded">cat:Documents</code> for categories,{' '}
                  <code className="px-1 bg-muted rounded">folder:Downloads</code> for parent folders
                </p>
              </div>
            )}

            {/* Results */}
            <div 
              ref={resultsRef}
              className="max-h-[400px] overflow-y-auto"
            >
              {scanStatus !== 'complete' ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Search className="w-10 h-10 mb-3 opacity-30" />
                  <p className="text-sm">Run a scan to search files</p>
                </div>
              ) : !isReady ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="w-8 h-8 mb-3 animate-spin opacity-50" />
                  <p className="text-sm">Building search index...</p>
                </div>
              ) : query && results.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Search className="w-10 h-10 mb-3 opacity-30" />
                  <p className="text-sm">No files match "{query}"</p>
                  <p className="text-xs mt-1">Try different keywords or filters</p>
                </div>
              ) : query && results.length > 0 ? (
                <div className="py-2">
                  <div className="px-4 py-1.5">
                    <p className="text-xs text-muted-foreground">
                      {results.length} result{results.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  {results.map((result, index) => {
                    const Icon = CATEGORY_ICONS[result.file.category] || LayoutGrid;
                    const hasSuggestion = suggestedFileIds.has(result.file.id);
                    const pathParts = result.file.path.split(/[\\/]/);
                    const parentFolder = pathParts.length > 1 
                      ? pathParts[pathParts.length - 2] 
                      : '';

                    return (
                      <button
                        key={result.file.id}
                        onClick={() => handleSelectResult(result)}
                        className={cn(
                          "w-full px-4 py-2.5 flex items-start gap-3 text-left transition-colors",
                          selectedIndex === index 
                            ? "bg-accent" 
                            : "hover:bg-muted/50"
                        )}
                      >
                        <div className={cn(
                          "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
                          "bg-muted text-muted-foreground"
                        )}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm truncate">
                              {highlightMatch(result.file.name, query)}
                            </p>
                            {hasSuggestion && (
                              <span className="flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-medium">
                                <Sparkles className="w-2.5 h-2.5" />
                                Suggestion
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                            {parentFolder && (
                              <span className="flex items-center gap-1 truncate">
                                <Folder className="w-3 h-3" />
                                {highlightMatch(parentFolder, query)}
                              </span>
                            )}
                            <span className="text-muted-foreground/50">|</span>
                            <span>{result.file.category}</span>
                            <span className="text-muted-foreground/50">|</span>
                            <span>{formatSize(result.file.size)}</span>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-2" />
                      </button>
                    );
                  })}
                </div>
              ) : !query ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Search className="w-10 h-10 mb-3 opacity-30" />
                  <p className="text-sm">Search {totalIndexed.toLocaleString()} indexed files</p>
                  <p className="text-xs mt-1">Start typing to search</p>
                </div>
              ) : null}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-border bg-muted/30 flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-background rounded border border-border">↑</kbd>
                  <kbd className="px-1.5 py-0.5 bg-background rounded border border-border">↓</kbd>
                  to navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-background rounded border border-border">Enter</kbd>
                  to select
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-background rounded border border-border">Esc</kbd>
                  to close
                </span>
              </div>
              {isReady && (
                <span>{totalIndexed} files indexed</span>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  ) : null;

  return (
    <>
      {/* Search trigger button */}
      <button
        onClick={() => {
          setIsOpen(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm",
          "bg-muted/50 border border-border/50 hover:bg-muted hover:border-border",
          "text-muted-foreground transition-colors",
          "min-w-[200px] justify-between"
        )}
      >
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4" />
          <span>Search files...</span>
        </div>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium bg-background rounded border border-border">
          Ctrl+K
        </kbd>
      </button>

      {searchModal}
    </>
  );
}
