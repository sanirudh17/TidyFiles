'use client';

import { useState, useMemo } from 'react';
import { useApp } from '@/lib/store-context';
import { Shield, Ban, FileCode, Check, Plus, X, Eye, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';

// Sample files for preview
const SAMPLE_FILES = [
  { name: 'Screenshot_2026-01-15_123456.png', date: new Date(2026, 0, 15), type: 'screenshot' },
  { name: 'IMG_9999.jpg', date: new Date(2026, 0, 18), type: 'photo' },
  { name: 'document.pdf', date: new Date(2026, 0, 10), type: 'document' },
  { name: 'report_final_v2.docx', date: new Date(2026, 0, 12), type: 'document' },
  { name: 'a8f3b2c1d4e5.zip', date: new Date(2026, 0, 8), type: 'archive' },
];

function formatDateForFilename(date: Date, dateFormat: string): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  switch (dateFormat) {
    case 'DD-MM-YYYY':
      return `${day}-${month}-${year}`;
    case 'MM-DD-YYYY':
      return `${month}-${day}-${year}`;
    case 'YYYY-MM-DD':
    default:
      return `${year}-${month}-${day}`;
  }
}

function generatePreviewName(file: typeof SAMPLE_FILES[0], settings: { dateFormat: string; spaceHandling: string }): string {
  const dateStr = formatDateForFilename(file.date, settings.dateFormat);
  const ext = file.name.substring(file.name.lastIndexOf('.'));
  
  let newName = '';
  
  if (file.type === 'screenshot') {
    newName = `Screenshot_${dateStr}${ext}`;
  } else if (file.type === 'photo') {
    newName = `Photo_${dateStr}${ext}`;
  } else if (file.name.match(/^[a-f0-9]{8,}/i)) {
    newName = `Downloaded_${dateStr}_${file.name.slice(0, 8)}${ext}`;
  } else {
    newName = `${dateStr}_${file.name.replace(ext, '')}${ext}`;
  }
  
  // Apply space handling
  if (settings.spaceHandling === 'underscore') {
    newName = newName.replace(/\s+/g, '_');
  } else if (settings.spaceHandling === 'hyphen') {
    newName = newName.replace(/\s+/g, '-');
  }
  
  return newName;
}

export default function SettingsPage() {
  const { settings, updateSettings } = useApp();
  const [newExclusion, setNewExclusion] = useState('');
  const [saved, setSaved] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const addExclusion = () => {
    if (newExclusion.trim() && !settings.exclusions.includes(newExclusion.trim())) {
      updateSettings({
        exclusions: [...settings.exclusions, newExclusion.trim()]
      });
      setNewExclusion('');
    }
  };

  const removeExclusion = (item: string) => {
    updateSettings({
      exclusions: settings.exclusions.filter(e => e !== item)
    });
  };

  // Generate preview names based on current settings
  const previewNames = useMemo(() => {
    return SAMPLE_FILES.map(file => ({
      original: file.name,
      proposed: generatePreviewName(file, settings),
    }));
  }, [settings.dateFormat, settings.spaceHandling]);

  return (
    <div className="space-y-8 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
          <p className="text-muted-foreground">Configure scanning rules and preferences.</p>
        </div>
        {saved && (
          <div className="flex items-center gap-2 text-green-600 text-sm font-medium animate-in fade-in">
            <Check className="w-4 h-4" />
            Settings saved
          </div>
        )}
      </div>

      <div className="space-y-6">
        {/* Naming Rules */}
        <section className="space-y-4">
          <h3 className="text-lg font-medium flex items-center gap-2">
            <FileCode className="w-5 h-5 text-primary" />
            Naming Conventions
          </h3>
          <div className="bg-card border border-border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Date Format</p>
                <p className="text-xs text-muted-foreground">Used when appending dates to filenames</p>
              </div>
              <select 
                value={settings.dateFormat}
                onChange={(e) => {
                  updateSettings({ dateFormat: e.target.value as typeof settings.dateFormat });
                  handleSave();
                }}
                className="bg-muted border border-input rounded text-sm px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                <option value="DD-MM-YYYY">DD-MM-YYYY</option>
                <option value="MM-DD-YYYY">MM-DD-YYYY</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Space Handling</p>
                <p className="text-xs text-muted-foreground">How to handle spaces in filenames</p>
              </div>
              <select 
                value={settings.spaceHandling}
                onChange={(e) => {
                  updateSettings({ spaceHandling: e.target.value as typeof settings.spaceHandling });
                  handleSave();
                }}
                className="bg-muted border border-input rounded text-sm px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="keep">Keep spaces</option>
                <option value="underscore">Replace with underscores (_)</option>
                <option value="hyphen">Replace with hyphens (-)</option>
              </select>
            </div>
            
            {/* Preview Toggle */}
            <div className="pt-2 border-t border-border">
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
              >
                <Eye className="w-4 h-4" />
                {showPreview ? 'Hide' : 'Show'} Rename Preview
              </button>
            </div>
            
            {/* Live Preview Table */}
            {showPreview && (
              <div className="bg-muted/50 border border-border rounded-lg overflow-hidden mt-3">
                <div className="px-3 py-2 bg-muted border-b border-border">
                  <p className="text-xs font-medium text-muted-foreground">Preview: How files will be renamed</p>
                </div>
                <div className="divide-y divide-border">
                  {previewNames.map((item, index) => (
                    <div key={index} className="px-3 py-2 flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground flex-1 truncate font-mono">{item.original}</span>
                      <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-foreground flex-1 truncate font-mono font-medium">{item.proposed}</span>
                    </div>
                  ))}
                </div>
                <div className="px-3 py-2 bg-blue-50 border-t border-blue-100">
                  <p className="text-xs text-blue-700">
                    Dates shown as <strong>{settings.dateFormat}</strong>. Changes apply to new scans.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Privacy & Safety */}
        <section className="space-y-4">
          <h3 className="text-lg font-medium flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Privacy & Safety
          </h3>
          <div className="bg-card border border-border rounded-lg divide-y divide-border">
            <div className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Create Backups</p>
                <p className="text-xs text-muted-foreground">Backup files before modifying</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={settings.createBackups}
                  onChange={(e) => {
                    updateSettings({ createBackups: e.target.checked });
                    handleSave();
                  }}
                  className="sr-only peer" 
                />
                <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
              </label>
            </div>
            <div className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Require Confirmation</p>
                <p className="text-xs text-muted-foreground">Always ask before applying changes</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={settings.requireConfirmation}
                  onChange={(e) => {
                    updateSettings({ requireConfirmation: e.target.checked });
                    handleSave();
                  }}
                  className="sr-only peer" 
                />
                <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
              </label>
            </div>
          </div>
        </section>

        {/* Exclusions */}
        <section className="space-y-4">
          <h3 className="text-lg font-medium flex items-center gap-2">
            <Ban className="w-5 h-5 text-primary" />
            Exclusions
          </h3>
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground mb-3">
              Folders and patterns to ignore during scans:
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              {settings.exclusions.map(tag => (
                <span key={tag} className="bg-muted px-2 py-1 rounded text-xs font-mono border border-border flex items-center gap-1.5 group">
                  {tag}
                  <button 
                    onClick={() => removeExclusion(tag)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newExclusion}
                onChange={(e) => setNewExclusion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addExclusion()}
                placeholder="Add pattern (e.g. *.log)"
                className="flex-1 bg-muted border border-input rounded text-sm px-3 py-1.5 font-mono focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button 
                onClick={addExclusion}
                disabled={!newExclusion.trim()}
                className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
          </div>
        </section>

        {/* Gemini API Status */}
        <section className="space-y-4">
          <h3 className="text-lg font-medium flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Gemini API
          </h3>
          <div className="bg-card border border-border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Status</p>
                <p className="text-xs text-muted-foreground">AI-powered file analysis</p>
              </div>
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-sm font-medium">Connected</span>
              </div>
            </div>
            <div className="pt-3 border-t border-border space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">File Operations</span>
                <code className="bg-muted px-2 py-0.5 rounded text-xs font-mono">gemini-2.5-pro</code>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Chat</span>
                <code className="bg-muted px-2 py-0.5 rounded text-xs font-mono">gemini-2.5-flash-lite</code>
              </div>
            </div>
            <p className="text-xs text-muted-foreground pt-2 border-t border-border">
              Gemini 2.5 models: Pro for file operations (complex reasoning), Flash-Lite for chat (fast and efficient).
            </p>
          </div>
        </section>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
          <p className="font-medium mb-1">Settings are saved automatically</p>
          <p className="text-blue-600">
            All changes are persisted to your browser's local storage and will be remembered across sessions.
          </p>
        </div>
      </div>
    </div>
  );
}
