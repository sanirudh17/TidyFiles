// Caching utilities for deterministic scan results
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface FileHash {
  path: string;
  hash: string;
  size: number;
  mtime: number;
}

export interface FolderCache {
  folderPath: string;
  folderHash: string;
  fileHashes: Record<string, FileHash>;
  suggestions: CachedSuggestion[];
  scannedAt: string;
  isOptimized: boolean; // True if user marked as "perfect"
}

export interface CachedSuggestion {
  fileHash: string;
  suggestion: {
    action: string;
    proposedName?: string;
    proposedPath?: string;
    reason: string;
    confidence: number;
    aiExplanation?: string;
  };
}

// Compute SHA-256 hash of a file (first 64KB + last 64KB + size for speed)
export function computeFileHash(filePath: string): string {
  try {
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;
    
    // For small files, hash entire content
    if (fileSize <= 128 * 1024) {
      const content = fs.readFileSync(filePath);
      const hash = crypto.createHash('sha256');
      hash.update(content);
      hash.update(Buffer.from(fileSize.toString()));
      hash.update(Buffer.from(stats.mtimeMs.toString()));
      return hash.digest('hex');
    }
    
    // For large files, sample beginning + end + metadata
    const fd = fs.openSync(filePath, 'r');
    const headBuffer = Buffer.alloc(64 * 1024);
    const tailBuffer = Buffer.alloc(64 * 1024);
    
    fs.readSync(fd, headBuffer, 0, 64 * 1024, 0);
    fs.readSync(fd, tailBuffer, 0, 64 * 1024, fileSize - 64 * 1024);
    fs.closeSync(fd);
    
    const hash = crypto.createHash('sha256');
    hash.update(headBuffer);
    hash.update(tailBuffer);
    hash.update(Buffer.from(fileSize.toString()));
    hash.update(Buffer.from(stats.mtimeMs.toString()));
    return hash.digest('hex');
  } catch (error) {
    // Fallback to path + size + mtime
    const stats = fs.statSync(filePath);
    const hash = crypto.createHash('sha256');
    hash.update(filePath);
    hash.update(Buffer.from(stats.size.toString()));
    hash.update(Buffer.from(stats.mtimeMs.toString()));
    return hash.digest('hex');
  }
}

// Compute folder hash (Merkle-tree style hash of all file hashes)
export function computeFolderHash(fileHashes: FileHash[]): string {
  const hash = crypto.createHash('sha256');
  
  // Sort by path for consistency
  const sorted = [...fileHashes].sort((a, b) => a.path.localeCompare(b.path));
  
  for (const file of sorted) {
    hash.update(file.hash);
    hash.update(file.path);
  }
  
  return hash.digest('hex');
}

// Compare folder states to find changes
export interface FolderDiff {
  added: string[];
  removed: string[];
  modified: string[];
  unchanged: string[];
}

export function compareFolderStates(
  oldHashes: Record<string, FileHash>,
  newHashes: Record<string, FileHash>
): FolderDiff {
  const diff: FolderDiff = {
    added: [],
    removed: [],
    modified: [],
    unchanged: [],
  };
  
  const oldPaths = new Set(Object.keys(oldHashes));
  const newPaths = new Set(Object.keys(newHashes));
  
  // Find added files
  for (const path of newPaths) {
    if (!oldPaths.has(path)) {
      diff.added.push(path);
    }
  }
  
  // Find removed files
  for (const path of oldPaths) {
    if (!newPaths.has(path)) {
      diff.removed.push(path);
    }
  }
  
  // Find modified and unchanged
  for (const path of newPaths) {
    if (oldPaths.has(path)) {
      if (oldHashes[path].hash !== newHashes[path].hash) {
        diff.modified.push(path);
      } else {
        diff.unchanged.push(path);
      }
    }
  }
  
  return diff;
}
