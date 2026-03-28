'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import lunr from 'lunr';
import type { ScannedFile } from './store-context';

export interface SearchResult {
  file: ScannedFile;
  score: number;
  matchedFields: string[];
}

interface SearchIndex {
  index: lunr.Index | null;
  isBuilding: boolean;
  lastUpdated: string | null;
}

const SEARCH_STORAGE_KEY = 'tidyfiles_search_index';

export function useSearch(files: ScannedFile[]) {
  const [searchState, setSearchState] = useState<SearchIndex>({
    index: null,
    isBuilding: false,
    lastUpdated: null,
  });
  const [query, setQuery] = useState('');

  // Build search index when files change
  useEffect(() => {
    if (files.length === 0) {
      setSearchState({ index: null, isBuilding: false, lastUpdated: null });
      return;
    }

    setSearchState(prev => ({ ...prev, isBuilding: true }));

    // Build index asynchronously to avoid blocking UI
    const buildIndex = async () => {
      try {
        const idx = lunr(function() {
          // Configure pipeline for fuzzy matching
          this.pipeline.remove(lunr.stemmer);
          this.pipeline.remove(lunr.stopWordFilter);
          
          // Define searchable fields
          this.ref('id');
          this.field('name', { boost: 10 });
          this.field('extension', { boost: 5 });
          this.field('path', { boost: 3 });
          this.field('category', { boost: 2 });
          this.field('parentFolder', { boost: 4 });

          // Add documents
          files.forEach(file => {
            const pathParts = file.path.split(/[\\/]/);
            const parentFolder = pathParts.length > 1 
              ? pathParts[pathParts.length - 2] 
              : '';
            
            this.add({
              id: file.id,
              name: file.name.replace(/\.[^.]+$/, ''), // Name without extension
              extension: file.extension.replace('.', ''),
              path: file.path,
              category: file.category,
              parentFolder,
            });
          });
        });

        setSearchState({
          index: idx,
          isBuilding: false,
          lastUpdated: new Date().toISOString(),
        });

        // Cache index metadata to localStorage
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(SEARCH_STORAGE_KEY, JSON.stringify({
              fileCount: files.length,
              lastUpdated: new Date().toISOString(),
            }));
          } catch (e) {
            console.warn('Failed to cache search index:', e);
          }
        }
      } catch (error) {
        console.error('Failed to build search index:', error);
        setSearchState({ index: null, isBuilding: false, lastUpdated: null });
      }
    };

    // Use setTimeout to defer index building
    const timer = setTimeout(buildIndex, 100);
    return () => clearTimeout(timer);
  }, [files]);

  // Create file lookup map for fast access
  const fileMap = useMemo(() => {
    const map = new Map<string, ScannedFile>();
    files.forEach(f => map.set(f.id, f));
    return map;
  }, [files]);

  // Search function with fuzzy matching
  const search = useCallback((searchQuery: string): SearchResult[] => {
    if (!searchState.index || !searchQuery.trim()) {
      return [];
    }

    try {
      // Add wildcards for fuzzy matching
      const terms = searchQuery.trim().split(/\s+/).filter(Boolean);
      const fuzzyQuery = terms.map(term => {
        // Support for special operators
        if (term.includes(':')) {
          // Field-specific search like "ext:pdf" or "cat:Documents"
          const [field, value] = term.split(':');
          const fieldMap: Record<string, string> = {
            'ext': 'extension',
            'extension': 'extension',
            'cat': 'category',
            'category': 'category',
            'folder': 'parentFolder',
            'path': 'path',
            'name': 'name',
          };
          const lunrField = fieldMap[field.toLowerCase()];
          if (lunrField && value) {
            return `${lunrField}:${value}*`;
          }
        }
        // Default fuzzy search with wildcards and edit distance
        return `${term}* ${term}~1`;
      }).join(' ');

      const results = searchState.index.search(fuzzyQuery);

      return results
        .slice(0, 50) // Limit results for performance
        .map(result => {
          const file = fileMap.get(result.ref);
          if (!file) return null;

          return {
            file,
            score: result.score,
            matchedFields: Object.keys(result.matchData.metadata || {}),
          };
        })
        .filter((r): r is SearchResult => r !== null);
    } catch (error) {
      // Fallback to simple string matching if Lunr query fails
      console.warn('Lunr search failed, using fallback:', error);
      const lowerQuery = searchQuery.toLowerCase();
      return files
        .filter(f => 
          f.name.toLowerCase().includes(lowerQuery) ||
          f.path.toLowerCase().includes(lowerQuery) ||
          f.category.toLowerCase().includes(lowerQuery)
        )
        .slice(0, 50)
        .map(file => ({
          file,
          score: 1,
          matchedFields: ['name'],
        }));
    }
  }, [searchState.index, fileMap, files]);

  // Memoized search results
  const results = useMemo(() => search(query), [search, query]);

  return {
    query,
    setQuery,
    results,
    isBuilding: searchState.isBuilding,
    isReady: searchState.index !== null,
    lastUpdated: searchState.lastUpdated,
    totalIndexed: files.length,
  };
}

// Filter utilities for search results
export interface SearchFilters {
  category?: string;
  extension?: string;
  dateRange?: { start: Date; end: Date };
  sizeRange?: { min: number; max: number };
}

export function applyFilters(results: SearchResult[], filters: SearchFilters): SearchResult[] {
  return results.filter(({ file }) => {
    if (filters.category && file.category !== filters.category) {
      return false;
    }
    if (filters.extension && file.extension !== filters.extension) {
      return false;
    }
    if (filters.dateRange) {
      const fileDate = new Date(file.lastModified);
      if (fileDate < filters.dateRange.start || fileDate > filters.dateRange.end) {
        return false;
      }
    }
    if (filters.sizeRange) {
      if (file.size < filters.sizeRange.min || file.size > filters.sizeRange.max) {
        return false;
      }
    }
    return true;
  });
}
