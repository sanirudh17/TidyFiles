'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  FolderOpen, 
  Scan, 
  ListCheck, 
  History, 
  Settings, 
  Sparkles,
  LayoutDashboard
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlobalSearch } from './global-search';
import { AIChatSidebar } from './ai-chat-sidebar';
import { ExportButton } from './export-modal';

const NAV_ITEMS = [
  { href: '/scan', label: 'Scan Setup', icon: FolderOpen },
  { href: '/results', label: 'Scan Results', icon: LayoutDashboard },
  { href: '/suggestions', label: 'Suggestions', icon: Sparkles },
  { href: '/review', label: 'Review & Approve', icon: ListCheck },
  { href: '/history', label: 'History', icon: History },
  { href: '/settings', label: 'Settings', icon: Settings },
];

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

      <div className="p-4 border-t border-border">
        <div className="bg-primary/5 rounded-lg p-3">
          <p className="text-xs font-medium text-primary mb-1">Last scan</p>
          <p className="text-xs text-muted-foreground">Today at 10:42 AM</p>
          <div className="mt-2 pt-2 border-t border-primary/10 flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">Next: Feb 17</span>
            <span className="text-[10px] font-medium text-primary">Monthly</span>
          </div>
        </div>
      </div>
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
