/**
 * Client-side file scanner using File System Access API.
 * This replaces the server-side fs-based scanning so the app
 * works when deployed to Vercel (serverless can't access user files).
 */

export interface ScannedFile {
  id: string;
  name: string;
  path: string;
  size: number;
  lastModified: number;
  extension: string;
  type: 'document' | 'image' | 'spreadsheet' | 'archive' | 'audio' | 'video' | 'code' | 'unknown';
  category: string;
  hash: string;
}

const FILE_TYPE_MAP: Record<string, { type: ScannedFile['type']; category: string }> = {
  '.pdf': { type: 'document', category: 'Documents' },
  '.doc': { type: 'document', category: 'Documents' },
  '.docx': { type: 'document', category: 'Documents' },
  '.txt': { type: 'document', category: 'Documents' },
  '.rtf': { type: 'document', category: 'Documents' },
  '.odt': { type: 'document', category: 'Documents' },
  '.xls': { type: 'spreadsheet', category: 'Spreadsheets' },
  '.xlsx': { type: 'spreadsheet', category: 'Spreadsheets' },
  '.csv': { type: 'spreadsheet', category: 'Spreadsheets' },
  '.ods': { type: 'spreadsheet', category: 'Spreadsheets' },
  '.jpg': { type: 'image', category: 'Images' },
  '.jpeg': { type: 'image', category: 'Images' },
  '.png': { type: 'image', category: 'Images' },
  '.gif': { type: 'image', category: 'Images' },
  '.bmp': { type: 'image', category: 'Images' },
  '.svg': { type: 'image', category: 'Images' },
  '.webp': { type: 'image', category: 'Images' },
  '.ico': { type: 'image', category: 'Images' },
  '.mp4': { type: 'video', category: 'Videos' },
  '.avi': { type: 'video', category: 'Videos' },
  '.mkv': { type: 'video', category: 'Videos' },
  '.mov': { type: 'video', category: 'Videos' },
  '.wmv': { type: 'video', category: 'Videos' },
  '.flv': { type: 'video', category: 'Videos' },
  '.webm': { type: 'video', category: 'Videos' },
  '.mp3': { type: 'audio', category: 'Audio' },
  '.wav': { type: 'audio', category: 'Audio' },
  '.flac': { type: 'audio', category: 'Audio' },
  '.aac': { type: 'audio', category: 'Audio' },
  '.ogg': { type: 'audio', category: 'Audio' },
  '.wma': { type: 'audio', category: 'Audio' },
  '.zip': { type: 'archive', category: 'Archives' },
  '.rar': { type: 'archive', category: 'Archives' },
  '.7z': { type: 'archive', category: 'Archives' },
  '.tar': { type: 'archive', category: 'Archives' },
  '.gz': { type: 'archive', category: 'Archives' },
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

const EXCLUDED_FOLDERS = new Set([
  'node_modules', '.git', '.next', '__pycache__', '.vscode',
  '.idea', 'vendor', 'dist', 'build', '.cache', 'coverage',
]);

function getFileTypeInfo(ext: string): { type: ScannedFile['type']; category: string } {
  return FILE_TYPE_MAP[ext.toLowerCase()] || { type: 'unknown', category: 'Other' };
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function generateFileHash(name: string, size: number, lastModified: number): string {
  const str = `${name}:${size}:${lastModified}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36).padStart(16, '0').substring(0, 16);
}

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

export type WellKnownDirectory = 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';

export async function pickDirectory(startIn?: WellKnownDirectory): Promise<FileSystemDirectoryHandle | null> {
  try {
    const options: any = { mode: 'read' };
    if (startIn) options.startIn = startIn;
    return await (window as any).showDirectoryPicker(options);
  } catch (err: any) {
    if (err.name === 'AbortError') return null;
    throw err;
  }
}

export async function scanDirectoryHandle(
  dirHandle: FileSystemDirectoryHandle,
  basePath: string = '',
  onProgress?: (count: number) => void,
  maxDepth: number = 10,
  currentDepth: number = 0,
): Promise<ScannedFile[]> {
  if (currentDepth > maxDepth) return [];

  const files: ScannedFile[] = [];
  const currentPath = basePath ? `${basePath}\\${dirHandle.name}` : dirHandle.name;

  try {
    for await (const entry of (dirHandle as any).values()) {
      if (entry.kind === 'directory') {
        if (EXCLUDED_FOLDERS.has(entry.name)) continue;
        const subFiles = await scanDirectoryHandle(entry, currentPath, onProgress, maxDepth, currentDepth + 1);
        files.push(...subFiles);
      } else if (entry.kind === 'file') {
        try {
          const file = await entry.getFile();
          const ext = file.name.includes('.') ? '.' + file.name.split('.').pop()!.toLowerCase() : '';
          const typeInfo = getFileTypeInfo(ext);

          files.push({
            id: generateId(),
            name: file.name,
            path: `${currentPath}\\${file.name}`,
            size: file.size,
            lastModified: file.lastModified,
            extension: ext,
            type: typeInfo.type,
            category: typeInfo.category,
            hash: generateFileHash(file.name, file.size, file.lastModified),
          });

          if (onProgress) onProgress(files.length);
        } catch {
          // Skip inaccessible files
        }
      }
    }
  } catch {
    // Skip inaccessible directories
  }

  return files;
}

export function computeClientStats(files: ScannedFile[]) {
  const stats = {
    totalFiles: files.length,
    totalSize: files.reduce((sum, f) => sum + f.size, 0),
    byCategory: {} as Record<string, { count: number; size: number }>,
    byType: {} as Record<string, { count: number; size: number }>,
    scannedAt: new Date().toISOString(),
  };

  for (const file of files) {
    if (!stats.byCategory[file.category]) {
      stats.byCategory[file.category] = { count: 0, size: 0 };
    }
    stats.byCategory[file.category].count++;
    stats.byCategory[file.category].size += file.size;

    if (!stats.byType[file.type]) {
      stats.byType[file.type] = { count: 0, size: 0 };
    }
    stats.byType[file.type].count++;
    stats.byType[file.type].size += file.size;
  }

  return stats;
}

export function computeClientFolderHash(files: ScannedFile[]): string {
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
  let hash = 0;
  for (const file of sorted) {
    for (let i = 0; i < file.hash.length; i++) {
      hash = ((hash << 5) - hash) + file.hash.charCodeAt(i);
      hash |= 0;
    }
  }
  return Math.abs(hash).toString(36).padStart(16, '0').substring(0, 16);
}
