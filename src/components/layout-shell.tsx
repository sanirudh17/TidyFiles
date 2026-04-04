'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  FolderOpen, 
  Scan, 
  ListCheck, 
  History, 
  Settings, 
  Sparkles,
  LayoutDashboard,
  Clock,
  CalendarClock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlobalSearch } from './global-search';
import { AIChatSidebar } from './ai-chat-sidebar';
import { ExportButton } from './export-modal';
import { useApp } from '@/lib/store-context';

const NAV_ITEMS = [
  { href: '/scan', label: 'Scan Setup', icon: FolderOpen },
  { href: '/results', label: 'Scan Results', icon: LayoutDashboard },
  { href: '/suggestions', label: 'Suggestions', icon: Sparkles },
  { href: '/review', label: 'Review & Approve', icon: ListCheck },
  { href: '/history', label: 'History', icon: History },
  { href: '/settings', label: 'Settings', icon: Settings },
];

function ScanStatusWidget() {
  const { stats, scanStatus } = useApp();
  const [now, setNow] = useState<Date | null>(null);
  const isMounted = now !== null;

  // Update clock every minute for relative time display
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // Compute relative time from scannedAt
  const getRelativeTime = (isoDate: string): string => {
    if (!now) {
      return 'Recently';
    }

    const scannedDate = new Date(isoDate);
    const diffMs = now.getTime() - scannedDate.getTime();
    const diffMinutes = Math.floor(diffMs / 60_000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return scannedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatTime = (isoDate: string): string => {
    if (!isMounted) {
      return 'Recent scan';
    }

    return new Date(isoDate).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  if (scanStatus === 'scanning' || scanStatus === 'analyzing') {
    return (
      <div className="p-4 border-t border-border">
        <div className="bg-primary/5 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <p className="text-xs font-medium text-primary">
              {scanStatus === 'scanning' ? 'Scanning...' : 'Analyzing...'}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">In progress</p>
        </div>
      </div>
    );
  }

  if (scanStatus !== 'complete' || !stats?.scannedAt) {
    return (
      <div className="p-4 border-t border-border">
        <div className="bg-muted/30 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="text-xs font-medium text-muted-foreground">No scans yet</p>
          </div>
          <p className="text-[10px] text-muted-foreground">Run your first scan to see status here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 border-t border-border">
      <div className="bg-primary/5 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-1">
          <CalendarClock className="w-3.5 h-3.5 text-primary" />
          <p className="text-xs font-medium text-primary">Last scan</p>
        </div>
        <p className="text-xs text-muted-foreground" title={isMounted ? formatTime(stats.scannedAt) : undefined}>
          {formatTime(stats.scannedAt)}
        </p>
        <p className="text-[10px] text-muted-foreground/70 mt-0.5">
          {getRelativeTime(stats.scannedAt)}
        </p>
        <div className="mt-2 pt-2 border-t border-primary/10 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">
            {stats.totalFiles.toLocaleString()} files scanned
          </span>
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-border bg-muted/30 h-screen fixed left-0 top-0 flex flex-col">
      <div className="p-6 border-b border-border">
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <Scan className="w-6 h-6 text-primary" />
          <span>TidyFiles</span>
        </h1>
      </div>
      
      <nav className="flex-1 p-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                isActive 
                  ? "bg-accent text-accent-foreground" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <ScanStatusWidget />
    </aside>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen pl-64">
      <Sidebar />
      {/* Top header with search */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="flex items-center justify-between px-8 py-3 max-w-7xl mx-auto">
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <ExportButton />
            <GlobalSearch />
          </div>
        </div>
      </header>
      <main className="p-8 max-w-7xl mx-auto animate-in fade-in duration-500">
        {children}
      </main>
      {/* AI Chat Sidebar */}
      <AIChatSidebar />
    </div>
  );
}
