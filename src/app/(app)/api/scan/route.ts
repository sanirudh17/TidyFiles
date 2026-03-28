import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface ScannedFile {
  id: string;
  name: string;
  path: string;
  size: number;
  lastModified: number;
  extension: string;
  type: 'document' | 'image' | 'spreadsheet' | 'archive' | 'audio' | 'video' | 'code' | 'unknown';
  category: string;
  hash: string; // SHA-256 hash for caching
}

const FILE_TYPE_MAP: Record<string, { type: ScannedFile['type']; category: string }> = {
  // Documents
  '.pdf': { type: 'document', category: 'Documents' },
  '.doc': { type: 'document', category: 'Documents' },
  '.docx': { type: 'document', category: 'Documents' },
  '.txt': { type: 'document', category: 'Documents' },
  '.rtf': { type: 'document', category: 'Documents' },
  '.odt': { type: 'document', category: 'Documents' },
  
  // Spreadsheets
  '.xls': { type: 'spreadsheet', category: 'Spreadsheets' },
  '.xlsx': { type: 'spreadsheet', category: 'Spreadsheets' },
  '.csv': { type: 'spreadsheet', category: 'Spreadsheets' },
  '.ods': { type: 'spreadsheet', category: 'Spreadsheets' },
  
  // Images
  '.jpg': { type: 'image', category: 'Images' },
  '.jpeg': { type: 'image', category: 'Images' },
  '.png': { type: 'image', category: 'Images' },
  '.gif': { type: 'image', category: 'Images' },
  '.bmp': { type: 'image', category: 'Images' },
  '.svg': { type: 'image', category: 'Images' },
  '.webp': { type: 'image', category: 'Images' },
  '.ico': { type: 'image', category: 'Images' },
  
  // Video
  '.mp4': { type: 'video', category: 'Videos' },
  '.avi': { type: 'video', category: 'Videos' },
  '.mkv': { type: 'video', category: 'Videos' },
  '.mov': { type: 'video', category: 'Videos' },
  '.wmv': { type: 'video', category: 'Videos' },
  '.flv': { type: 'video', category: 'Videos' },
  '.webm': { type: 'video', category: 'Videos' },
  
  // Audio
  '.mp3': { type: 'audio', category: 'Audio' },
  '.wav': { type: 'audio', category: 'Audio' },
  '.flac': { type: 'audio', category: 'Audio' },
  '.aac': { type: 'audio', category: 'Audio' },
  '.ogg': { type: 'audio', category: 'Audio' },
  '.wma': { type: 'audio', category: 'Audio' },
  
  // Archives
  '.zip': { type: 'archive', category: 'Archives' },
  '.rar': { type: 'archive', category: 'Archives' },
  '.7z': { type: 'archive', category: 'Archives' },
  '.tar': { type: 'archive', category: 'Archives' },
  '.gz': { type: 'archive', category: 'Archives' },
  
  // Code
  '.js': { type: 'code', category: 'Code' },
  '.ts': { type: 'code', category: 'Code' },
  '.tsx': { type: 'code', category: 'Code' },
  '.jsx': { type: 'code', category: 'Code' },
  '.py': { type: 'code', category: 'Code' },
  '.java': { type: 'code', category: 'Code' },
  '.cpp': { type: 'code', category: 'Code' },
  '.c': { type: 'code', category: 'Code' },
  '.h': { type: 'code', category: 'Code' },
  '.css': { type: 'code', category: 'Code' },
  '.html': { type: 'code', category: 'Code' },
  '.json': { type: 'code', category: 'Code' },
  '.xml': { type: 'code', category: 'Code' },
  '.yaml': { type: 'code', category: 'Code' },
  '.yml': { type: 'code', category: 'Code' },
  '.md': { type: 'code', category: 'Code' },
  '.sql': { type: 'code', category: 'Code' },
  '.sh': { type: 'code', category: 'Code' },
  '.bat': { type: 'code', category: 'Code' },
  '.ps1': { type: 'code', category: 'Code' },
};

// Folders to exclude from scanning
const EXCLUDED_FOLDERS = [
  'node_modules',
  '.git',
  '.next',
  '__pycache__',
  '.vscode',
  '.idea',
  'vendor',
  'dist',
  'build',
  '.cache',
  'coverage',
];

function getFileTypeInfo(ext: string): { type: ScannedFile['type']; category: string } {
  return FILE_TYPE_MAP[ext.toLowerCase()] || { type: 'unknown', category: 'Other' };
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

// Compute file hash for deterministic caching
function computeFileHash(filePath: string, stats: fs.Stats): string {
  try {
    const hash = crypto.createHash('sha256');
    
    // For small files (< 128KB), hash entire content
    if (stats.size <= 128 * 1024) {
      const content = fs.readFileSync(filePath);
      hash.update(content);
    } else {
      // For large files, sample beginning + end + metadata
      const fd = fs.openSync(filePath, 'r');
      const headBuffer = Buffer.alloc(Math.min(64 * 1024, stats.size));
      const tailSize = Math.min(64 * 1024, stats.size);
      const tailBuffer = Buffer.alloc(tailSize);
      
      fs.readSync(fd, headBuffer, 0, headBuffer.length, 0);
      if (stats.size > 64 * 1024) {
        fs.readSync(fd, tailBuffer, 0, tailSize, stats.size - tailSize);
      }
      fs.closeSync(fd);
      
      hash.update(headBuffer);
      hash.update(tailBuffer);
    }
    
    // Include metadata for change detection
    hash.update(Buffer.from(stats.size.toString()));
    hash.update(Buffer.from(stats.mtimeMs.toString()));
    
    return hash.digest('hex').substring(0, 16); // Use first 16 chars for brevity
  } catch {
    // Fallback to path + size + mtime hash
    const hash = crypto.createHash('sha256');
    hash.update(filePath);
    hash.update(Buffer.from(stats.size.toString()));
    hash.update(Buffer.from(stats.mtimeMs.toString()));
    return hash.digest('hex').substring(0, 16);
  }
}

// Compute folder hash (Merkle-tree style)
function computeFolderHash(files: ScannedFile[]): string {
  const hash = crypto.createHash('sha256');
  
  // Sort by path for consistency
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
  
  for (const file of sorted) {
    hash.update(file.hash);
  }
  
  return hash.digest('hex').substring(0, 16);
}

async function scanDirectory(dirPath: string, files: ScannedFile[], maxDepth: number = 10, currentDepth: number = 0): Promise<void> {
  if (currentDepth > maxDepth) return;
  
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        // Skip excluded folders
        if (EXCLUDED_FOLDERS.includes(entry.name)) continue;
        
        // Recursively scan subdirectories
        await scanDirectory(fullPath, files, maxDepth, currentDepth + 1);
      } else if (entry.isFile()) {
        try {
          const stats = fs.statSync(fullPath);
          const ext = path.extname(entry.name);
          const typeInfo = getFileTypeInfo(ext);
          const fileHash = computeFileHash(fullPath, stats);
          
          files.push({
            id: generateId(),
            name: entry.name,
            path: fullPath,
            size: stats.size,
            lastModified: stats.mtimeMs,
            extension: ext,
            type: typeInfo.type,
            category: typeInfo.category,
            hash: fileHash,
          });
        } catch (err) {
          // Skip files we can't access
          console.warn(`Could not access file: ${fullPath}`);
        }
      }
    }
  } catch (err) {
    console.warn(`Could not access directory: ${dirPath}`, err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { folders, cachedFolderHash, forceRescan } = await request.json();
    
    if (!folders || !Array.isArray(folders) || folders.length === 0) {
      return NextResponse.json({ error: 'No folders provided' }, { status: 400 });
    }
    
    const allFiles: ScannedFile[] = [];
    
    for (const folder of folders) {
      // Validate folder exists
      if (!fs.existsSync(folder)) {
        console.warn(`Folder does not exist: ${folder}`);
        continue;
      }
      
      await scanDirectory(folder, allFiles);
    }
    
    // Compute folder hash for caching
    const folderHash = computeFolderHash(allFiles);
    
    // Check if folder is unchanged (cache hit)
    const isCacheHit = !forceRescan && cachedFolderHash === folderHash;
    
    // Calculate statistics
    const stats = {
      totalFiles: allFiles.length,
      totalSize: allFiles.reduce((sum, f) => sum + f.size, 0),
      byCategory: {} as Record<string, { count: number; size: number }>,
      byType: {} as Record<string, { count: number; size: number }>,
    };
    
    for (const file of allFiles) {
      // By category
      if (!stats.byCategory[file.category]) {
        stats.byCategory[file.category] = { count: 0, size: 0 };
      }
      stats.byCategory[file.category].count++;
      stats.byCategory[file.category].size += file.size;
      
      // By type
      if (!stats.byType[file.type]) {
        stats.byType[file.type] = { count: 0, size: 0 };
      }
      stats.byType[file.type].count++;
      stats.byType[file.type].size += file.size;
    }
    
    return NextResponse.json({
      files: allFiles,
      stats,
      folderHash,
      isCacheHit,
      scannedAt: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('Scan error:', error);
    return NextResponse.json({ error: 'Failed to scan folders' }, { status: 500 });
  }
}
