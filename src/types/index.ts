export type FileType = 'document' | 'image' | 'spreadsheet' | 'archive' | 'audio' | 'video' | 'unknown';
export type ConfidenceLevel = 'high' | 'medium' | 'low';
export type ActionType = 'rename' | 'move' | 'merge' | 'delete' | 'archive';

export interface FileNode {
  id: string;
  name: string;
  path: string;
  size: number;
  lastModified: number;
  type: FileType;
  extension: string;
  category: string;
  tags: string[];
}

export interface Suggestion {
  id: string;
  fileId: string;
  originalFile: FileNode;
  action: ActionType;
  proposedName?: string;
  proposedPath?: string;
  reason: string;
  confidence: ConfidenceLevel;
  status: 'pending' | 'approved' | 'rejected';
  diff?: {
    before: string;
    after: string;
  };
}

export interface ScanStats {
  totalFiles: number;
  totalSize: number;
  duplicatesFound: number;
  suggestionsCount: number;
  lastScanDate: string;
}
