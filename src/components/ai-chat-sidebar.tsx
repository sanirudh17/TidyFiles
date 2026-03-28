'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle,
  X,
  Send,
  Loader2,
  Sparkles,
  FolderOpen,
  ExternalLink,
  ArrowRight,
  Bot,
  User,
  RefreshCw,
  AlertCircle,
  Wifi,
  WifiOff
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApp } from '@/lib/store-context';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  actions?: Array<{ type: string; label: string; data?: Record<string, unknown> }>;
  isError?: boolean;
  modelUsed?: string;
}

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

export function AIChatSidebar() {
  const { files, stats, history, selectedFolders, scanStatus } = useApp();
  const router = useRouter();
  
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'error' | 'unknown'>('unknown');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Build rich context for AI
  const buildContext = useCallback(() => {
    // Get top folders by file count
    const folderCounts: Record<string, number> = {};
    files.forEach(f => {
      const parts = f.path.split(/[\\/]/);
      if (parts.length > 1) {
        const parentFolder = parts[parts.length - 2];
        folderCounts[parentFolder] = (folderCounts[parentFolder] || 0) + 1;
      }
    });
    const topFolders = Object.entries(folderCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);

    return {
      rootFolder: selectedFolders[0] || 'No folder selected',
      totalFiles: stats?.totalFiles || 0,
      totalSize: stats?.totalSize || 0,
      totalSizeFormatted: formatSize(stats?.totalSize || 0),
      categories: stats?.byCategory || {},
      categoryCount: Object.keys(stats?.byCategory || {}).length,
      topFolders,
      recentHistory: history.slice(0, 5).map(h => ({
        action: h.action,
        date: h.date,
      })),
      sampleFiles: files.slice(0, 20).map(f => ({
        name: f.name,
        path: f.path,
        category: f.category,
        size: f.size,
      })),
    };
  }, [files, stats, history, selectedFolders]);

  const sendMessage = async (promptOverride?: string) => {
    const messageText = promptOverride || input.trim();
    if (!messageText || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const context = buildContext();
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content,
          })),
          context,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      setConnectionStatus(data.fallback ? 'error' : 'connected');

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message || 'No response received.',
        timestamp: new Date(),
        actions: data.actions || [],
        modelUsed: data.model,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      setConnectionStatus('error');
      
      // Provide a helpful error message with context
      const context = buildContext();
      const fallbackMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I'm having trouble connecting to Gemini. Here's what I know about your folder:\n\n**${context.rootFolder.split('\\').pop()}**\n• ${context.totalFiles.toLocaleString()} files (${context.totalSizeFormatted})\n• ${context.categoryCount} categories\n\nTry asking again, or check your API key in Settings.`,
        timestamp: new Date(),
        actions: [
          { type: 'navigate', label: 'View Results', data: { path: '/results' } },
          { type: 'navigate', label: 'Settings', data: { path: '/settings' } },
        ],
        isError: true,
      };
      setMessages(prev => [...prev, fallbackMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Send quick prompts directly without relying on state
  const sendQuickPrompt = (prompt: string) => {
    sendMessage(prompt);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleAction = (action: { type: string; label: string; data?: Record<string, unknown> }) => {
    if (action.type === 'navigate' && action.data?.path) {
      router.push(action.data.path as string);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setConnectionStatus('unknown');
  };

  // Quick prompts
  const quickPrompts = [
    'What files take up the most space?',
    'Find duplicate files',
    'Summarize this folder',
    'What should I clean up?',
  ];

  const chatContent = (
    <>
      {/* Toggle button - positioned higher to avoid pagination */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-20 right-6 z-40 p-3 rounded-full shadow-lg transition-all",
          "bg-primary text-primary-foreground hover:bg-primary/90",
          "hover:scale-105 active:scale-95",
          isOpen && "hidden"
        )}
        title="Ask AI (Chat)"
      >
        <MessageCircle className="w-5 h-5" />
      </button>

      {/* Sidebar */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-background border-l border-border shadow-xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm">TidyFiles AI</h3>
                    {connectionStatus === 'connected' && (
                      <span className="flex items-center gap-1 text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                        <Wifi className="w-3 h-3" />
                        Gemini 3
                      </span>
                    )}
                    {connectionStatus === 'error' && (
                      <span className="flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                        <WifiOff className="w-3 h-3" />
                        Offline
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                    {selectedFolders[0] ? selectedFolders[0].split('\\').pop() : 'No folder selected'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={clearChat}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                  title="Clear chat"
                >
                  <RefreshCw className="w-4 h-4 text-muted-foreground" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Context bar */}
            {scanStatus === 'complete' && stats && (
              <div className="px-4 py-2 border-b border-border bg-muted/20 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <FolderOpen className="w-3.5 h-3.5" />
                  {stats.totalFiles.toLocaleString()} files
                </span>
                <span>{formatSize(stats.totalSize)}</span>
                <span>{Object.keys(stats.byCategory || {}).length} categories</span>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-4">
                  <Bot className="w-12 h-12 text-muted-foreground/30 mb-4" />
                  <h4 className="font-medium mb-2">Ask about your files</h4>
                  <p className="text-sm text-muted-foreground mb-6">
                    I can help you find files, understand your folder structure, and suggest cleanup actions.
                  </p>
                  <div className="grid grid-cols-1 gap-2 w-full max-w-xs">
                    {quickPrompts.map((prompt, i) => (
                      <button
                        key={i}
                        onClick={() => sendQuickPrompt(prompt)}
                        className="text-left px-3 py-2 text-sm bg-muted hover:bg-muted/80 rounded-lg transition-colors"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex gap-3",
                      msg.role === 'user' ? "justify-end" : "justify-start"
                    )}
                  >
                    {msg.role === 'assistant' && (
                      <div className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
                        msg.isError ? "bg-amber-100" : "bg-primary/10"
                      )}>
                        {msg.isError ? (
                          <AlertCircle className="w-4 h-4 text-amber-600" />
                        ) : (
                          <Bot className="w-4 h-4 text-primary" />
                        )}
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                        msg.role === 'user'
                          ? "bg-primary text-primary-foreground"
                          : msg.isError
                            ? "bg-amber-50 border border-amber-200"
                            : "bg-muted"
                      )}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                      
                      {/* Model indicator */}
                      {msg.modelUsed && msg.role === 'assistant' && !msg.isError && (
                        <p className="text-[10px] text-muted-foreground mt-1 opacity-60">
                          via {msg.modelUsed.includes('3-pro') ? 'Gemini 3 Pro' : msg.modelUsed.includes('3-flash') ? 'Gemini 3 Flash' : msg.modelUsed}
                        </p>
                      )}
                      
                      {/* Action buttons */}
                      {msg.actions && msg.actions.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-border/50">
                          {msg.actions.map((action, i) => (
                            <button
                              key={i}
                              onClick={() => handleAction(action)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-background rounded hover:bg-muted transition-colors"
                            >
                              {action.type === 'navigate' && <ArrowRight className="w-3 h-3" />}
                              {action.type === 'openFolder' && <ExternalLink className="w-3 h-3" />}
                              {action.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {msg.role === 'user' && (
                      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                ))
              )}
              
              {isLoading && (
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <div className="bg-muted rounded-lg px-3 py-2 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">Thinking with Gemini 3...</span>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-border bg-muted/30">
              <div className="flex gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about your files..."
                  rows={1}
                  className="flex-1 px-3 py-2 text-sm bg-background border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                  disabled={isLoading || scanStatus !== 'complete'}
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || isLoading || scanStatus !== 'complete'}
                  className="p-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              {scanStatus !== 'complete' && (
                <p className="text-xs text-muted-foreground mt-2">
                  Run a scan first to enable AI chat
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );

  // Use portal to render at body level to avoid stacking context issues
  if (!mounted) return null;
  
  return createPortal(chatContent, document.body);
}
