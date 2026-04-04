'use client';

import { useApp } from '@/lib/store-context';
import { useRouter } from 'next/navigation';
import { useState, useMemo, useEffect } from 'react';
import { 
  FileText, 
  Image as ImageIcon, 
  Film, 
  Music, 
  Archive, 
  LayoutGrid,
  ArrowRight,
  PieChart,
  Copy,
  AlertCircle,
  Code,
  FileSpreadsheet,
  Sparkles,
  Shield,
  RefreshCw,
  CheckCircle2,
  X,
  Search,
  CheckCircle,
  Filter,
  Calendar,
  FolderTree
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { VisualTimeline } from '@/components/visual-timeline';
import { OrganizeTree } from '@/components/organize-tree';

// Softer, muted pastel colors for categories (shadcn-inspired)
const CATEGORY_ICONS: Record<string, { icon: typeof FileText; color: string; bg: string; gradient: string }> = {
  'Documents': { icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50', gradient: 'from-blue-50 to-indigo-50' },
  'Images': { icon: ImageIcon, color: 'text-violet-600', bg: 'bg-violet-50', gradient: 'from-violet-50 to-purple-50' },
  'Videos': { icon: Film, color: 'text-rose-600', bg: 'bg-rose-50', gradient: 'from-rose-50 to-pink-50' },
  'Audio': { icon: Music, color: 'text-amber-600', bg: 'bg-amber-50', gradient: 'from-amber-50 to-yellow-50' },
  'Archives': { icon: Archive, color: 'text-slate-600', bg: 'bg-slate-50', gradient: 'from-slate-50 to-gray-50' },
  'Code': { icon: Code, color: 'text-emerald-600', bg: 'bg-emerald-50', gradient: 'from-emerald-50 to-teal-50' },
  'Spreadsheets': { icon: FileSpreadsheet, color: 'text-teal-600', bg: 'bg-teal-50', gradient: 'from-teal-50 to-cyan-50' },
  'Other': { icon: LayoutGrid, color: 'text-gray-500', bg: 'bg-gray-50', gradient: 'from-gray-50 to-slate-50' },
};

// File drawer component for displaying files in a category
function FileDrawer({ 
  category, 
  files, 
  suggestions,
  onClose 
}: { 
  category: { name: string; icon: typeof FileText; color: string; bg: string; gradient: string; count: number; size: number } | null;
  files: Array<{ id: string; name: string; path: string; size: number; lastModified: number; category: string }>;
  suggestions: Array<{ fileId: string }>;
  onClose: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyWithSuggestions, setShowOnlyWithSuggestions] = useState(false);

  if (!category) return null;

  const categoryFiles = files.filter(f => f.category === category.name);
  const suggestedFileIds = new Set(suggestions.map(s => s.fileId));
  
  const filteredFiles = categoryFiles.filter(f => {
    const matchesSearch = searchQuery === '' || 
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.path.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSuggestionFilter = !showOnlyWithSuggestions || suggestedFileIds.has(f.id);
    return matchesSearch && matchesSuggestionFilter;
  });

  const filesWithSuggestions = categoryFiles.filter(f => suggestedFileIds.has(f.id)).length;

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

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const Icon = category.icon;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-background border-l border-border shadow-xl z-50 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", category.bg, category.color)}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold">{category.name}</h3>
              <p className="text-sm text-muted-foreground">
                {categoryFiles.length} files ({formatSize(category.size)})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search and Filter */}
        <div className="p-4 border-b border-border space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <button
            onClick={() => setShowOnlyWithSuggestions(!showOnlyWithSuggestions)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
              showOnlyWithSuggestions 
                ? "bg-primary text-primary-foreground" 
                : "bg-muted hover:bg-muted/80"
            )}
          >
            <Filter className="w-3.5 h-3.5" />
            Only with suggestions ({filesWithSuggestions})
          </button>
        </div>

        {/* File List */}
        <div className="flex-1 overflow-y-auto">
          {filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Search className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">No files match your search</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredFiles.map((file) => {
                const hasSuggestion = suggestedFileIds.has(file.id);
                return (
                  <div
                    key={file.id}
                    className={cn(
                      "p-3 hover:bg-muted/50 transition-colors",
                      hasSuggestion && "bg-amber-50/50"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">{file.name}</p>
                          {hasSuggestion && (
                            <span className="flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">
                              <Sparkles className="w-3 h-3" />
                              Suggestion
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5" title={file.path}>
                          {file.path}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>{formatSize(file.size)}</span>
                      <span>{formatDate(file.lastModified)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/30">
          <p className="text-xs text-muted-foreground text-center">
            Showing {filteredFiles.length} of {categoryFiles.length} files
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function ResultsPage() {
  const { stats, scanStatus, suggestions, files, resetScan, isCacheHit, isOptimized, markAsOptimized, startScan, clearCache, selectedFolders, settings } = useApp();
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<{ name: string; icon: typeof FileText; color: string; bg: string; gradient: string; count: number; size: number } | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'organize'>('overview');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Show a friendly message if no scan data, but don't redirect
  if (scanStatus !== 'complete' || !stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <PieChart className="w-16 h-16 text-muted-foreground/30" />
        <div className="text-center">
          <h3 className="text-lg font-medium mb-2">No scan data available</h3>
          <p className="text-muted-foreground text-sm mb-4">Run a scan to see your file analysis here.</p>
          <button 
            onClick={() => router.push('/scan')} 
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
          >
            Go to Scan Setup
          </button>
        </div>
      </div>
    );
  }

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

  // Build categories from real stats
  const categories = Object.entries(stats.byCategory || {}).map(([name, data]) => {
    const iconInfo = CATEGORY_ICONS[name] || CATEGORY_ICONS['Other'];
    return {
      name,
      count: data.count,
      size: data.size,
      ...iconInfo,
    };
  });

  // Calculate metrics from real data
  const duplicateSuggestions = suggestions.filter(s => s.action === 'delete' && s.reason.toLowerCase().includes('duplicate'));
  const messyFilenames = suggestions.filter(s => s.action === 'rename');
  
  // Calculate cleanup score based on suggestions vs total files
  const issueRatio = files.length > 0 ? suggestions.length / files.length : 0;
  let cleanupScore = 'A';
  let scoreColor = 'text-green-600';
  if (issueRatio > 0.5) { cleanupScore = 'F'; scoreColor = 'text-red-600'; }
  else if (issueRatio > 0.3) { cleanupScore = 'D'; scoreColor = 'text-orange-600'; }
  else if (issueRatio > 0.2) { cleanupScore = 'C'; scoreColor = 'text-amber-600'; }
  else if (issueRatio > 0.1) { cleanupScore = 'B'; scoreColor = 'text-yellow-600'; }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Scan Results</h2>
          <p className="text-muted-foreground mt-1">
            Found <span className="font-semibold text-foreground">{stats.totalFiles.toLocaleString()}</span> files 
            totaling <span className="font-semibold text-foreground">{formatSize(stats.totalSize)}</span>
          </p>
        </div>
        <button
          onClick={() => router.push('/suggestions')}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2.5 rounded-lg font-medium shadow-sm transition-all flex items-center gap-2"
        >
          View {suggestions.length} Suggestions
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* AI Badge */}
      <div className="bg-gradient-to-r from-primary/5 to-accent/30 border border-primary/20 rounded-lg p-4 flex items-center gap-3">
        <Sparkles className="w-5 h-5 text-primary" />
        <p className="text-sm flex-1">
          <span className="font-medium">AI-powered analysis complete.</span>{' '}
          <span className="text-muted-foreground">
            Using settings: <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{settings.dateFormat}</span> | <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{settings.spaceHandling}</span>
          </span>
        </p>
      </div>

      {/* Cache Status & Actions */}
      <div className={cn(
        "border rounded-lg p-4 flex items-center justify-between",
        isOptimized 
          ? "bg-green-50 border-green-200" 
          : isCacheHit 
            ? "bg-blue-50 border-blue-200"
            : "bg-muted/30 border-border"
      )}>
        <div className="flex items-center gap-3">
          {isOptimized ? (
            <>
              <Shield className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-green-800">Folder Optimized</p>
                <p className="text-xs text-green-600">Marked as perfect. No further suggestions needed.</p>
              </div>
            </>
          ) : isCacheHit ? (
            <>
              <CheckCircle2 className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-blue-800">Cached Results</p>
                <p className="text-xs text-blue-600">Folder unchanged since last scan. Using cached analysis.</p>
              </div>
            </>
          ) : (
            <>
              <RefreshCw className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Fresh Scan</p>
                <p className="text-xs text-muted-foreground">New analysis completed. Results cached for future scans.</p>
              </div>
            </>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {!isOptimized && suggestions.length === 0 && (
            <button
              onClick={markAsOptimized}
              className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center gap-1.5"
            >
              <Shield className="w-3.5 h-3.5" />
              Mark as Perfect
            </button>
          )}
          {isCacheHit && (
            <button
              onClick={() => { clearCache(); startScan(true); }}
              className="px-3 py-1.5 text-xs font-medium bg-white border border-border rounded hover:bg-muted transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Force Re-scan
            </button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('overview')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
            activeTab === 'overview' 
              ? "bg-background text-foreground shadow-sm" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <PieChart className="w-4 h-4" />
          Overview
        </button>
        <button
          onClick={() => setActiveTab('timeline')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
            activeTab === 'timeline' 
              ? "bg-background text-foreground shadow-sm" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Calendar className="w-4 h-4" />
          Timeline
        </button>
        <button
          onClick={() => setActiveTab('organize')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
            activeTab === 'organize' 
              ? "bg-background text-foreground shadow-sm" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <FolderTree className="w-4 h-4" />
          Organize
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'timeline' ? (
        <VisualTimeline files={files} />
      ) : activeTab === 'organize' ? (
<OrganizeTree 
          files={files.map(f => ({
            ...f,
            extension: f.name.split('.').pop() || '',
          }))}
          basePath={selectedFolders[0] || ''}
          onApplyComplete={(result) => {
            console.log('Organization applied:', result);
          }}
        />
      ) : (
        <>
          {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border p-6 rounded-xl shadow-sm"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
              <Copy className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Duplicates Found</p>
              <h3 className="text-2xl font-bold">{duplicateSuggestions.length}</h3>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3 pl-16">
            {duplicateSuggestions.length > 0 
              ? `~${formatSize(duplicateSuggestions.reduce((sum, s) => sum + s.originalFile.size, 0))} potential savings`
              : 'No duplicates detected'
            }
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card border border-border p-6 rounded-xl shadow-sm"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Naming Issues</p>
              <h3 className="text-2xl font-bold">{messyFilenames.length}</h3>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3 pl-16">
            Files with inconsistent naming patterns
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card border border-border p-6 rounded-xl shadow-sm"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-50 text-green-600 rounded-lg">
              <PieChart className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Cleanup Score</p>
              <h3 className={`text-2xl font-bold ${scoreColor}`}>{cleanupScore}</h3>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3 pl-16">
            {issueRatio < 0.1 ? 'Your folders are well organized!' : 
             issueRatio < 0.2 ? 'Minor improvements suggested' :
             'Several improvements available'}
          </p>
        </motion.div>
      </div>

      {/* Categories Grid - File Composition */}
      <div>
        <h3 className="text-lg font-semibold mb-2">File Composition</h3>
        <p className="text-sm text-muted-foreground mb-4">Click a category to view files</p>
        {categories.length === 0 ? (
          <p className="text-muted-foreground text-sm">No files found in scanned folders.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {categories.map((cat, i) => {
              const filesInCategory = files.filter(f => f.category === cat.name);
              const suggestionsInCategory = suggestions.filter(s => 
                filesInCategory.some(f => f.id === s.fileId)
              ).length;
              
              return (
                <motion.button
                  key={cat.name}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 + (i * 0.05) }}
                  onClick={() => setSelectedCategory({ ...cat, gradient: cat.gradient || 'from-gray-50 to-slate-50' })}
                  className={cn(
                    "relative p-4 rounded-xl text-left group cursor-pointer",
                    "bg-gradient-to-br border border-border/50",
                    cat.gradient,
                    "hover:scale-[1.02] hover:shadow-md hover:ring-2 hover:ring-offset-1",
                    "hover:ring-blue-200 transition-all duration-200 ease-out"
                  )}
                >
                  {suggestionsInCategory > 0 && (
                    <span className="absolute -top-2 -right-2 w-5 h-5 bg-amber-500 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-sm">
                      {suggestionsInCategory}
                    </span>
                  )}
                  <div className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center mb-3",
                    cat.bg, cat.color
                  )}>
                    <cat.icon className="w-4.5 h-4.5" />
                  </div>
                  <h4 className="font-medium text-sm text-foreground/90 group-hover:text-foreground transition-colors">{cat.name}</h4>
                  <p className="text-2xl font-bold mt-1 font-mono tabular-nums text-foreground/80">{cat.count.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground font-mono mt-1">{formatSize(cat.size)}</p>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>
      </>
      )}

      {/* File Drawer */}
      {selectedCategory && (
        <FileDrawer
          category={selectedCategory}
          files={files}
          suggestions={suggestions}
          onClose={() => setSelectedCategory(null)}
        />
      )}

      {/* Scanned At */}
      {stats.scannedAt && (
        <p className="text-xs text-muted-foreground text-center">
          Scanned at {mounted ? new Date(stats.scannedAt).toLocaleString() : 'recently'}
        </p>
      )}
    </div>
  );
}
