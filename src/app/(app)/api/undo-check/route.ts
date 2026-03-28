import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

interface ChangeEntry {
  fileId: string;
  originalPath: string;
  originalName: string;
  newPath?: string;
  newName?: string;
  action: string;
  size?: number;
  lastModified?: string;
}

interface ActionSafetyResult {
  fileId: string;
  originalPath: string;
  action: string;
  status: 'safe' | 'changed' | 'missing';
  reason?: string;
}

// Size and time tolerance for considering files "same"
const SIZE_TOLERANCE = 0; // exact match
const TIME_TOLERANCE_MS = 2000; // 2 seconds

async function computeFolderHash(folderPath: string): Promise<string> {
  const hash = crypto.createHash('sha256');
  
  try {
    const entries: string[] = [];
    
    const collectEntries = (dir: string) => {
      try {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        for (const item of items) {
          const fullPath = path.join(dir, item.name);
          if (item.isDirectory()) {
            // Skip common system/hidden directories
            if (!item.name.startsWith('.') && item.name !== 'node_modules') {
              collectEntries(fullPath);
            }
          } else if (item.isFile()) {
            try {
              const stats = fs.statSync(fullPath);
              entries.push(`${fullPath}|${stats.size}|${stats.mtimeMs}`);
            } catch {
              // Skip files we can't stat
            }
          }
        }
      } catch {
        // Skip directories we can't read
      }
    };
    
    collectEntries(folderPath);
    entries.sort();
    
    for (const entry of entries) {
      hash.update(entry);
    }
    
    return hash.digest('hex');
  } catch {
    return '';
  }
}

function checkFileSafety(change: ChangeEntry): ActionSafetyResult {
  const result: ActionSafetyResult = {
    fileId: change.fileId,
    originalPath: change.originalPath,
    action: change.action,
    status: 'safe',
  };

  try {
    switch (change.action) {
      case 'rename': {
        // For undo: toPath should exist, fromPath should not exist
        const fromPath = change.originalPath;
        const toPath = change.newPath;
        
        if (!toPath) {
          result.status = 'missing';
          result.reason = 'No target path recorded';
          break;
        }

        // Check if the renamed file exists at new location
        if (!fs.existsSync(toPath)) {
          result.status = 'missing';
          result.reason = 'File not found at expected location';
          break;
        }

        // Check if original path is now free (for undo to work)
        if (fs.existsSync(fromPath)) {
          result.status = 'changed';
          result.reason = 'A different file exists at original path';
          break;
        }

        // Verify file properties if available
        if (change.size !== undefined) {
          const stats = fs.statSync(toPath);
          if (stats.size !== change.size) {
            result.status = 'changed';
            result.reason = 'File size has changed';
            break;
          }
          
          if (change.lastModified) {
            const expectedTime = new Date(change.lastModified).getTime();
            // mtime will be different after rename, but size should match
          }
        }

        result.status = 'safe';
        break;
      }

      case 'delete': {
        // For undo: file should still be deleted (not exist)
        const fromPath = change.originalPath;
        
        if (fs.existsSync(fromPath)) {
          result.status = 'changed';
          result.reason = 'File has been restored or recreated';
          break;
        }

        // Check if backup exists (we'd need backup path from apply)
        result.status = 'safe'; // Can't actually undo delete without backup
        result.reason = 'File still deleted (cannot restore without backup)';
        break;
      }

      case 'move': {
        const fromPath = change.originalPath;
        const toPath = change.newPath;
        
        if (!toPath) {
          result.status = 'missing';
          result.reason = 'No target path recorded';
          break;
        }

        // Check if file exists at new location
        if (!fs.existsSync(toPath)) {
          result.status = 'missing';
          result.reason = 'File not found at moved location';
          break;
        }

        // Check if original location is free
        if (fs.existsSync(fromPath)) {
          result.status = 'changed';
          result.reason = 'A different file exists at original location';
          break;
        }

        result.status = 'safe';
        break;
      }

      default:
        result.status = 'changed';
        result.reason = `Unknown action type: ${change.action}`;
    }
  } catch (err) {
    result.status = 'changed';
    result.reason = err instanceof Error ? err.message : 'Error checking file';
  }

  return result;
}

export async function POST(request: NextRequest) {
  try {
    const { historyEntryId, rootFolder, snapshotHashAfter, changes } = await request.json();
    
    if (!changes || !Array.isArray(changes)) {
      return NextResponse.json({ error: 'No changes provided' }, { status: 400 });
    }

    // Compute current folder hash if root folder provided
    let currentHash = '';
    let hashMatches = false;
    
    if (rootFolder && fs.existsSync(rootFolder)) {
      currentHash = await computeFolderHash(rootFolder);
      hashMatches = snapshotHashAfter && currentHash === snapshotHashAfter;
    }

    // Check each action individually
    const actionResults: ActionSafetyResult[] = changes.map((change: ChangeEntry) => 
      checkFileSafety(change)
    );

    const safeCount = actionResults.filter(r => r.status === 'safe').length;
    const changedCount = actionResults.filter(r => r.status === 'changed').length;
    const missingCount = actionResults.filter(r => r.status === 'missing').length;
    const totalCount = actionResults.length;

    // Determine overall safety
    let overallSafety: 'safe' | 'partial' | 'unsafe';
    let message: string;

    if (hashMatches && safeCount === totalCount) {
      overallSafety = 'safe';
      message = 'All changes can be safely undone';
    } else if (safeCount > 0 && safeCount < totalCount) {
      overallSafety = 'partial';
      message = `${safeCount} of ${totalCount} changes can be undone`;
    } else if (safeCount === 0) {
      overallSafety = 'unsafe';
      message = 'Folder has changed significantly since this operation';
    } else {
      overallSafety = 'safe';
      message = 'All changes can be safely undone';
    }

    // Special case: if all changes were deletes, we can't really undo without backups
    const allDeletes = changes.every((c: ChangeEntry) => c.action === 'delete');
    if (allDeletes) {
      overallSafety = 'unsafe';
      message = 'Deleted files cannot be restored without backups';
    }

    return NextResponse.json({
      historyEntryId,
      overallSafety,
      message,
      hashMatches,
      currentHash,
      expectedHash: snapshotHashAfter,
      summary: {
        total: totalCount,
        safe: safeCount,
        changed: changedCount,
        missing: missingCount,
      },
      actions: actionResults,
    });

  } catch (error) {
    console.error('Undo check error:', error);
    return NextResponse.json({ 
      error: 'Failed to check undo safety',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
