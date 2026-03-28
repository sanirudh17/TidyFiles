import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

interface ApplyChange {
  fileId: string;
  originalPath: string;
  action: 'rename' | 'delete' | 'move';
  proposedName?: string;
  proposedPath?: string;
}

interface ApplyResult {
  success: boolean;
  fileId: string;
  originalPath: string;
  newPath?: string;
  action: string;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { changes, createBackups } = await request.json();
    
    if (!changes || !Array.isArray(changes) || changes.length === 0) {
      return NextResponse.json({ error: 'No changes provided' }, { status: 400 });
    }

    const results: ApplyResult[] = [];
    const backupDir = path.join(process.env.TEMP || 'C:\\Temp', 'tidyfiles_backups', Date.now().toString());
    
    // Create backup directory if backups enabled
    if (createBackups) {
      try {
        fs.mkdirSync(backupDir, { recursive: true });
      } catch (e) {
        console.warn('Could not create backup directory:', e);
      }
    }

    for (const change of changes as ApplyChange[]) {
      const result: ApplyResult = {
        success: false,
        fileId: change.fileId,
        originalPath: change.originalPath,
        action: change.action,
      };

      try {
        // Verify file exists
        if (!fs.existsSync(change.originalPath)) {
          result.error = 'File not found';
          results.push(result);
          continue;
        }

        switch (change.action) {
          case 'rename': {
            if (!change.proposedName) {
              result.error = 'No proposed name provided';
              break;
            }
            
            const dir = path.dirname(change.originalPath);
            const newPath = path.join(dir, change.proposedName);
            
            // Check if target already exists
            if (fs.existsSync(newPath)) {
              result.error = 'Target file already exists';
              break;
            }

            // Create backup if enabled
            if (createBackups) {
              try {
                const backupPath = path.join(backupDir, path.basename(change.originalPath));
                fs.copyFileSync(change.originalPath, backupPath);
              } catch (e) {
                console.warn('Backup failed:', e);
              }
            }

            // Perform rename
            fs.renameSync(change.originalPath, newPath);
            result.success = true;
            result.newPath = newPath;
            break;
          }

          case 'delete': {
            // Create backup if enabled
            if (createBackups) {
              try {
                const backupPath = path.join(backupDir, path.basename(change.originalPath));
                fs.copyFileSync(change.originalPath, backupPath);
              } catch (e) {
                console.warn('Backup failed:', e);
              }
            }

            // Move to recycle bin would be ideal, but for now we'll just delete
            // In production, you'd use a library like 'trash' to move to recycle bin
            fs.unlinkSync(change.originalPath);
            result.success = true;
            break;
          }

          case 'move': {
            if (!change.proposedPath) {
              result.error = 'No proposed path provided';
              break;
            }

            // Ensure target directory exists
            const targetDir = path.dirname(change.proposedPath);
            if (!fs.existsSync(targetDir)) {
              fs.mkdirSync(targetDir, { recursive: true });
            }

            // Check if target already exists
            if (fs.existsSync(change.proposedPath)) {
              result.error = 'Target file already exists';
              break;
            }

            // Create backup if enabled
            if (createBackups) {
              try {
                const backupPath = path.join(backupDir, path.basename(change.originalPath));
                fs.copyFileSync(change.originalPath, backupPath);
              } catch (e) {
                console.warn('Backup failed:', e);
              }
            }

            // Perform move
            fs.renameSync(change.originalPath, change.proposedPath);
            result.success = true;
            result.newPath = change.proposedPath;
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
      applied: successCount,
      failed: failedCount,
      results,
      backupLocation: createBackups ? backupDir : null,
    });

  } catch (error) {
    console.error('Apply error:', error);
    return NextResponse.json({ 
      error: 'Failed to apply changes',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
