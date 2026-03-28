'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  FileText,
  X,
  TrendingUp,
  Folder
} from 'lucide-react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  getDay,
  parseISO
} from 'date-fns';
import { cn } from '@/lib/utils';
import type { ScannedFile } from '@/lib/store-context';

interface TimelineProps {
  files: ScannedFile[];
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

export function VisualTimeline({ files }: TimelineProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Group files by date
  const filesByDate = useMemo(() => {
    const grouped = new Map<string, ScannedFile[]>();
    
    files.forEach(file => {
      const dateKey = format(new Date(file.lastModified), 'yyyy-MM-dd');
      const existing = grouped.get(dateKey) || [];
      grouped.set(dateKey, [...existing, file]);
    });
    
    return grouped;
  }, [files]);

  // Get date range for calendar grid
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  // Calculate min/max files for dynamic heat intensity
  const { minFilesPerDay, maxFilesPerDay } = useMemo(() => {
    let min = Infinity;
    let max = 0;
    filesByDate.forEach(files => {
      if (files.length > 0) {
        if (files.length < min) min = files.length;
        if (files.length > max) max = files.length;
      }
    });
    return { 
      minFilesPerDay: min === Infinity ? 0 : min, 
      maxFilesPerDay: max || 1 
    };
  }, [filesByDate]);

  // Get heat color based on file count using dynamic min-max normalization
  // Enhanced with better contrast and HSL-based colors
  const getHeatColor = (count: number): string => {
    if (count === 0) return 'bg-gray-100';
    
    // Use log scale for better distribution when there's high variance
    const logMin = minFilesPerDay > 0 ? Math.log(minFilesPerDay) : 0;
    const logMax = maxFilesPerDay > 0 ? Math.log(maxFilesPerDay) : 0;
    const logCount = count > 0 ? Math.log(count) : 0;
    
    // Normalize using log scale for better contrast
    const range = logMax - logMin;
    const intensity = range > 0 ? (logCount - logMin) / range : 0.5;
    
    // Use 5-level discrete scale for clear visual distinction
    if (intensity >= 0.85) return 'bg-blue-700'; // Darkest
    if (intensity >= 0.65) return 'bg-blue-500'; 
    if (intensity >= 0.40) return 'bg-blue-400';
    if (intensity >= 0.20) return 'bg-blue-300';
    return 'bg-blue-200'; // Lightest (but still blue, not gray)
  };

  // Get text color based on background intensity
  const getTextColor = (count: number): string => {
    if (count === 0) return 'text-gray-400';
    
    // Use same log scale calculation
    const logMin = minFilesPerDay > 0 ? Math.log(minFilesPerDay) : 0;
    const logMax = maxFilesPerDay > 0 ? Math.log(maxFilesPerDay) : 0;
    const logCount = count > 0 ? Math.log(count) : 0;
    const range = logMax - logMin;
    const intensity = range > 0 ? (logCount - logMin) / range : 0.5;
    
    // White text on darker backgrounds
    return intensity >= 0.40 ? 'text-white' : 'text-gray-700';
  };

  // Get files for selected date
  const selectedFiles = useMemo(() => {
    if (!selectedDate) return [];
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    return filesByDate.get(dateKey) || [];
  }, [selectedDate, filesByDate]);

  // Stats for current month
  const monthStats = useMemo((): { 
    totalFiles: number; 
    totalSize: number; 
    peakDay: { date: string; count: number } | null;
    topCategory: [string, number] | undefined;
  } => {
    let totalFiles = 0;
    let totalSize = 0;
    let peakDay: { date: string; count: number } | null = null;
    const categoryCount: Record<string, number> = {};

    calendarDays.forEach(day => {
      if (!isSameMonth(day, currentMonth)) return;
      
      const dateKey = format(day, 'yyyy-MM-dd');
      const dayFiles = filesByDate.get(dateKey) || [];
      
      totalFiles += dayFiles.length;
      dayFiles.forEach(f => {
        totalSize += f.size;
        categoryCount[f.category] = (categoryCount[f.category] || 0) + 1;
      });

      if (!peakDay || dayFiles.length > peakDay.count) {
        peakDay = { date: dateKey, count: dayFiles.length };
      }
    });

    const topCategory = Object.entries(categoryCount)
      .sort((a, b) => b[1] - a[1])[0];

    return { totalFiles, totalSize, peakDay, topCategory };
  }, [calendarDays, currentMonth, filesByDate]);

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-6">
      {/* Header with month navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">
            {format(currentMonth, 'MMMM yyyy')}
          </h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCurrentMonth(new Date())}
            className="px-3 py-1.5 text-sm font-medium hover:bg-muted rounded-lg transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Month stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-muted/30 rounded-lg p-3">
          <p className="text-xs text-muted-foreground">Files this month</p>
          <p className="text-xl font-bold">{monthStats.totalFiles.toLocaleString()}</p>
        </div>
        <div className="bg-muted/30 rounded-lg p-3">
          <p className="text-xs text-muted-foreground">Total size</p>
          <p className="text-xl font-bold">{formatSize(monthStats.totalSize)}</p>
        </div>
        <div className="bg-muted/30 rounded-lg p-3">
          <p className="text-xs text-muted-foreground">Peak day</p>
          <p className="text-xl font-bold">
            {monthStats.peakDay?.count || 0} files
          </p>
          {monthStats.peakDay && (
            <p className="text-xs text-muted-foreground">
              {format(parseISO(monthStats.peakDay.date), 'MMM d')}
            </p>
          )}
        </div>
        <div className="bg-muted/30 rounded-lg p-3">
          <p className="text-xs text-muted-foreground">Top category</p>
          <p className="text-xl font-bold">
            {monthStats.topCategory?.[0] || 'N/A'}
          </p>
          {monthStats.topCategory && (
            <p className="text-xs text-muted-foreground">
              {monthStats.topCategory[1]} files
            </p>
          )}
        </div>
      </div>

      {/* Calendar grid */}
      <div className="bg-card border border-border rounded-xl p-4">
        {/* Week day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map(day => (
            <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, index) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayFiles = filesByDate.get(dateKey) || [];
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const isToday = isSameDay(day, new Date());

            return (
              <motion.button
                key={dateKey}
                whileHover={{ scale: dayFiles.length > 0 ? 1.05 : 1 }}
                onClick={() => {
                  if (dayFiles.length > 0) {
                    setSelectedDate(isSelected ? null : day);
                  }
                }}
                className={cn(
                  "relative aspect-square rounded-lg flex flex-col items-center justify-center transition-all",
                  isCurrentMonth ? 'opacity-100' : 'opacity-30',
                  dayFiles.length > 0 && 'cursor-pointer hover:ring-2 hover:ring-blue-300',
                  isSelected && 'ring-2 ring-primary',
                  getHeatColor(dayFiles.length)
                )}
              >
                <span className={cn(
                  "text-sm font-medium",
                  getTextColor(dayFiles.length),
                  isToday && 'underline underline-offset-2'
                )}>
                  {format(day, 'd')}
                </span>
                {dayFiles.length > 0 && (
                  <span className={cn(
                    "text-[10px]",
                    getTextColor(dayFiles.length),
                    "opacity-80"
                  )}
                  title={`${dayFiles.length} files on ${format(day, 'MMM d, yyyy')}`}
                  >
                    {dayFiles.length}
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Legend with file count info */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
          <span className="text-xs text-muted-foreground">
            File count: {minFilesPerDay === 0 ? 1 : minFilesPerDay} – {maxFilesPerDay} per day
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Less</span>
            <div className="w-3 h-3 rounded bg-gray-100" title="0 files" />
            <div className="w-3 h-3 rounded bg-blue-200" title={`~${minFilesPerDay} files`} />
            <div className="w-3 h-3 rounded bg-blue-300" />
            <div className="w-3 h-3 rounded bg-blue-400" />
            <div className="w-3 h-3 rounded bg-blue-500" />
            <div className="w-3 h-3 rounded bg-blue-700" title={`${maxFilesPerDay} files`} />
            <span className="text-xs text-muted-foreground">More</span>
          </div>
        </div>
      </div>

      {/* Selected date file list */}
      <AnimatePresence>
        {selectedDate && selectedFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-card border border-border rounded-xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                <h4 className="font-medium">
                  {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                </h4>
                <span className="text-sm text-muted-foreground">
                  ({selectedFiles.length} files)
                </span>
              </div>
              <button
                onClick={() => setSelectedDate(null)}
                className="p-1.5 hover:bg-muted rounded-md transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-[300px] overflow-y-auto divide-y divide-border">
              {selectedFiles.map((file) => {
                const pathParts = file.path.split(/[\\/]/);
                const parentFolder = pathParts.length > 1 
                  ? pathParts[pathParts.length - 2] 
                  : '';

                return (
                  <div key={file.id} className="px-4 py-2.5 flex items-center gap-3 hover:bg-muted/50">
                    <div className="w-8 h-8 rounded bg-muted flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Folder className="w-3 h-3" />
                          {parentFolder}
                        </span>
                        <span>|</span>
                        <span>{file.category}</span>
                        <span>|</span>
                        <span>{formatSize(file.size)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Activity trends hint */}
      {files.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
          <TrendingUp className="w-4 h-4" />
          <span>
            Click on any day with files to see details. Days with more activity appear darker.
          </span>
        </div>
      )}
    </div>
  );
}
