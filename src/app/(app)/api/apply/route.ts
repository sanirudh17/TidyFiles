import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

interface ApplyChange {
  fileId: string;
  originalPath: string;
  action: 'rename' | 'delete' | 'move' | 'archive' | 'merge';
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
            let newPath = path.join(dir, change.proposedName);
            
            let counter = 1;
            while (fs.existsSync(newPath)) {
              if (counter > 100) {
                result.error = 'Target file already exists and could not fix name collision';
                break;
              }
              const parsed = path.parse(change.proposedName!);
              newPath = path.join(dir, `${parsed.name} (${counter})${parsed.ext}`);
              counter++;
            }
            if (result.error) break;

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
            let movePath = change.proposedPath;
            if (!movePath) {
              // Fallback: move into an 'Organized' subfolder
              movePath = path.join(path.dirname(change.originalPath), 'Organized', path.basename(change.originalPath));
            }

            // Ensure target directory exists
            const targetDir = path.dirname(movePath);
            if (!fs.existsSync(targetDir)) {
              fs.mkdirSync(targetDir, { recursive: true });
            }

            // Handle target existing by appending (1), (2), etc.
            let finalTargetPath = movePath;
            let moveCounter = 1;
            while (fs.existsSync(finalTargetPath)) {
              if (moveCounter > 100) {
                result.error = 'Target file already exists and could not fix name collision';
                break;
              }
              const parsed = path.parse(movePath);
              finalTargetPath = path.join(parsed.dir, `${parsed.name} (${moveCounter})${parsed.ext}`);
              moveCounter++;
            }
            if (result.error) break;

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
            fs.renameSync(change.originalPath, finalTargetPath);
            result.success = true;
            result.newPath = finalTargetPath;
            break;
          }

          case 'archive': {
            const archivePath = change.proposedPath || path.join(path.dirname(change.originalPath), 'Archives', path.basename(change.originalPath));

            const targetDir = path.dirname(archivePath);
            if (!fs.existsSync(targetDir)) {
              fs.mkdirSync(targetDir, { recursive: true });
            }

            if (fs.existsSync(archivePath)) {
              result.error = 'Target file already exists';
              break;
            }

            if (createBackups) {
              try {
                const backupPath = path.join(backupDir, path.basename(change.originalPath));
                fs.copyFileSync(change.originalPath, backupPath);
              } catch (e) {
                console.warn('Backup failed:', e);
              }
            }

            fs.renameSync(change.originalPath, archivePath);
            result.success = true;
            result.newPath = archivePath;
            break;
          }

          case 'merge': {
            result.error = 'Merge suggestions are not supported yet';
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
