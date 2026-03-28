import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

interface UndoChange {
  fileId: string;
  originalPath: string;
  originalName: string;
  newPath?: string;
  newName?: string;
  action: string;
}

interface UndoResult {
  success: boolean;
  fileId: string;
  action: string;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { changes, partial } = await request.json();
    
    if (!changes || !Array.isArray(changes) || changes.length === 0) {
      return NextResponse.json({ error: 'No changes to undo' }, { status: 400 });
    }

    const results: UndoResult[] = [];

    for (const change of changes as UndoChange[]) {
      const result: UndoResult = {
        success: false,
        fileId: change.fileId,
        action: change.action,
      };

      try {
        switch (change.action) {
          case 'rename': {
            // Undo rename: move from newPath back to originalPath
            const fromPath = change.newPath;
            const toPath = change.originalPath;
            
            if (!fromPath || !toPath) {
              result.error = 'Missing path information';
              break;
            }

            if (!fs.existsSync(fromPath)) {
              result.error = 'File not found at current location';
              break;
            }

            if (fs.existsSync(toPath)) {
              result.error = 'Cannot restore: original path is occupied';
              break;
            }

            fs.renameSync(fromPath, toPath);
            result.success = true;
            break;
          }

          case 'move': {
            // Undo move: move from newPath back to originalPath
            const fromPath = change.newPath;
            const toPath = change.originalPath;
            
            if (!fromPath || !toPath) {
              result.error = 'Missing path information';
              break;
            }

            if (!fs.existsSync(fromPath)) {
              result.error = 'File not found at moved location';
              break;
            }

            if (fs.existsSync(toPath)) {
              result.error = 'Cannot restore: original location is occupied';
              break;
            }

            // Ensure parent directory exists
            const parentDir = path.dirname(toPath);
            if (!fs.existsSync(parentDir)) {
              fs.mkdirSync(parentDir, { recursive: true });
            }

            fs.renameSync(fromPath, toPath);
            result.success = true;
            break;
          }

          case 'delete': {
            // Cannot undo delete without backup
            result.error = 'Deleted files cannot be restored without backup';
            break;
          }

          default:
            result.error = `Unknown action: ${change.action}`;
        }
      } catch (err) {
        result.error = err instanceof Error ? err.message : 'Unknown error';
      }

      results.push(result);
    }

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: failedCount === 0,
      undone: successCount,
      failed: failedCount,
      results,
    });

  } catch (error) {
    console.error('Undo error:', error);
    return NextResponse.json({ 
      error: 'Failed to undo changes',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
