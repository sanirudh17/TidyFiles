export interface ApplyChange {
  fileId: string;
  originalPath: string;
  action: 'rename' | 'delete' | 'move' | 'archive' | 'merge';
  proposedName?: string;
  proposedPath?: string;
}

export interface ApplyResult {
  success: boolean;
  fileId: string;
  originalPath: string;
  newPath?: string;
  action: string;
  error?: string;
}

export interface ApplyResponse {
  success: boolean;
  applied: number;
  failed: number;
  results: ApplyResult[];
  backupLocation: string | null;
  newFolderHash?: string;
}

const directoryHandleRegistry = new Map<string, FileSystemDirectoryHandle>();

type PermissionCapableHandle = FileSystemHandle & {
  queryPermission?: (descriptor: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (descriptor: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
};

function splitPathSegments(filePath: string): string[] {
  return filePath.split(/[\\/]/).filter(Boolean);
}

function isAbsoluteFilesystemPath(filePath: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(filePath) || filePath.startsWith('/');
}

function rootNameFromPath(filePath: string): string {
  return splitPathSegments(filePath)[0] || '';
}

function requiresBrowserHandle(filePath: string): boolean {
  return !isAbsoluteFilesystemPath(filePath);
}

async function ensurePermission(handle: PermissionCapableHandle, mode: 'read' | 'readwrite'): Promise<boolean> {
  if (typeof handle.queryPermission !== 'function') {
    return true;
  }

  const current = await handle.queryPermission({ mode });
  if (current === 'granted') {
    return true;
  }

  if (current === 'prompt') {
    if (typeof handle.requestPermission !== 'function') {
      return false;
    }

    const next = await handle.requestPermission({ mode });
    return next === 'granted';
  }

  return false;
}

async function resolveDirectory(rootName: string, segments: string[], create: boolean): Promise<FileSystemDirectoryHandle> {
  const rootHandle = directoryHandleRegistry.get(rootName);
  if (!rootHandle) {
    throw new Error(`Folder access is no longer available for "${rootName}". Please re-pick that folder from Scan Setup.`);
  }

  const hasPermission = await ensurePermission(rootHandle, create ? 'readwrite' : 'read');
  if (!hasPermission) {
    throw new Error(`Permission was denied for "${rootName}". Please allow folder access and try again.`);
  }

  let current = rootHandle;
  for (const segment of segments) {
    current = await current.getDirectoryHandle(segment, { create });
  }

  return current;
}

async function fileExists(directoryHandle: FileSystemDirectoryHandle, fileName: string): Promise<boolean> {
  try {
    await directoryHandle.getFileHandle(fileName);
    return true;
  } catch {
    return false;
  }
}

async function writeFile(targetHandle: FileSystemFileHandle, file: File): Promise<void> {
  const writable = await targetHandle.createWritable();
  try {
    await writable.write(file);
  } finally {
    await writable.close();
  }
}

async function backupOriginalFile(filePath: string, file: File, backupSessionId: string): Promise<string> {
  const parts = splitPathSegments(filePath);
  const [rootName] = parts;
  const fileName = parts[parts.length - 1];
  // Flat backup: all files go directly into TidyFiles Backups/{session}/
  const backupDir = await resolveDirectory(rootName, ['TidyFiles Backups', backupSessionId], true);
  
  // Handle duplicate filenames with counter
  let finalName = fileName;
  let counter = 1;
  while (await fileExists(backupDir, finalName)) {
    const dotIdx = fileName.lastIndexOf('.');
    const base = dotIdx !== -1 ? fileName.substring(0, dotIdx) : fileName;
    const ext = dotIdx !== -1 ? fileName.substring(dotIdx) : '';
    finalName = `${base} (${counter})${ext}`;
    counter++;
  }
  
  const backupHandle = await backupDir.getFileHandle(finalName, { create: true });
  await writeFile(backupHandle, file);
  return `${rootName}\\TidyFiles Backups\\${backupSessionId}`;
}

function buildTargetPath(change: ApplyChange): string | undefined {
  if (change.action === 'rename') {
    if (!change.proposedName) {
      return undefined;
    }

    const parts = splitPathSegments(change.originalPath);
    return [...parts.slice(0, -1), change.proposedName].join('\\');
  }

  if (change.action === 'move') {
    if (change.proposedPath) {
      return change.proposedPath;
    }
    // Fallback: move into an 'Organized' subfolder under the same directory
    const parts = splitPathSegments(change.originalPath);
    const fileName = parts[parts.length - 1];
    return [...parts.slice(0, -1), 'Organized', fileName].join('\\');
  }

  if (change.action === 'archive') {
    if (change.proposedPath) {
      return change.proposedPath;
    }

    const parts = splitPathSegments(change.originalPath);
    const [rootName, ...relativeParts] = parts;
    const fileName = relativeParts[relativeParts.length - 1];
    return [rootName, 'Archives', fileName].join('\\');
  }

  return undefined;
}

async function applyChangeInBrowser(change: ApplyChange, createBackups: boolean, backupSessionId: string): Promise<ApplyResult> {
  const result: ApplyResult = {
    success: false,
    fileId: change.fileId,
    originalPath: change.originalPath,
    action: change.action,
  };

  if (change.action === 'merge') {
    result.error = 'Merge suggestions are not supported yet';
    return result;
  }

  const sourceParts = splitPathSegments(change.originalPath);
  const [sourceRoot, ...sourceRelativeParts] = sourceParts;
  if (sourceRelativeParts.length === 0) {
    result.error = 'Invalid source path';
    return result;
  }

  try {
    const sourceDir = await resolveDirectory(sourceRoot, sourceRelativeParts.slice(0, -1), false);
    const sourceName = sourceRelativeParts[sourceRelativeParts.length - 1];
    const sourceFileHandle = await sourceDir.getFileHandle(sourceName);
    const sourceFile = await sourceFileHandle.getFile();

    if (createBackups) {
      await backupOriginalFile(change.originalPath, sourceFile, backupSessionId);
    }

    if (change.action === 'delete') {
      await sourceDir.removeEntry(sourceName);
      result.success = true;
      return result;
    }

    const targetPath = buildTargetPath(change);
    if (!targetPath) {
      result.error = change.action === 'rename' ? 'No proposed name provided' : 'No target path provided';
      return result;
    }

    if (targetPath === change.originalPath) {
      result.success = true;
      result.newPath = targetPath;
      return result;
    }

    const targetParts = splitPathSegments(targetPath);
    const [targetRoot, ...targetRelativeParts] = targetParts;
    if (targetRelativeParts.length === 0) {
      result.error = 'Invalid target path';
      return result;
    }

    const targetDir = await resolveDirectory(targetRoot, targetRelativeParts.slice(0, -1), true);
    const targetName = targetRelativeParts[targetRelativeParts.length - 1];

    let finalTargetName = targetName;
    const nameDotIndex = targetName.lastIndexOf('.');
    const baseName = nameDotIndex !== -1 ? targetName.substring(0, nameDotIndex) : targetName;
    const extension = nameDotIndex !== -1 ? targetName.substring(nameDotIndex) : '';
    
    let counter = 1;
    while (await fileExists(targetDir, finalTargetName)) {
      if (counter > 100) {
        result.error = 'Target file already exists and unable to generate a unique name';
        return result;
      }
      finalTargetName = `${baseName} (${counter})${extension}`;
      counter++;
    }

    const targetFileHandle = await targetDir.getFileHandle(finalTargetName, { create: true });
    await writeFile(targetFileHandle, sourceFile);
    await sourceDir.removeEntry(sourceName);

    result.success = true;
    const finalTargetPathParts = [...targetRelativeParts];
    finalTargetPathParts[finalTargetPathParts.length - 1] = finalTargetName;
    result.newPath = [targetRoot, ...finalTargetPathParts].join('\\');
    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error';
    return result;
  }
}

export function registerDirectoryHandle(rootName: string, handle: FileSystemDirectoryHandle): void {
  directoryHandleRegistry.set(rootName, handle);
}

export function unregisterDirectoryHandle(rootName: string): void {
  directoryHandleRegistry.delete(rootName);
}

export function hasDirectoryHandle(rootName: string): boolean {
  return directoryHandleRegistry.has(rootName);
}

export function canApplyClientSideChanges(changes: ApplyChange[]): boolean {
  if (typeof window === 'undefined' || changes.length === 0) {
    return false;
  }

  return changes.every((change) => {
    const paths = [change.originalPath, change.proposedPath].filter(Boolean) as string[];
    return paths.every((filePath) => {
      if (isAbsoluteFilesystemPath(filePath)) {
        return false;
      }

      return hasDirectoryHandle(rootNameFromPath(filePath));
    });
  });
}

export function needsBrowserFileAccess(changes: ApplyChange[]): boolean {
  return changes.some((change) => {
    const paths = [change.originalPath, change.proposedPath].filter(Boolean) as string[];
    return paths.some(requiresBrowserHandle);
  });
}

export async function applyClientSideChanges(
  changes: ApplyChange[],
  options: { createBackups?: boolean } = {},
): Promise<ApplyResponse> {
  const createBackups = options.createBackups ?? true;
  const backupSessionId = new Date().toISOString().replace(/[:.]/g, '-');
  const results: ApplyResult[] = [];

  // File system handle operations are safer when processed in order.
  // Concurrent renames in the same directory can race on existence checks.
  for (const change of changes) {
    results.push(await applyChangeInBrowser(change, createBackups, backupSessionId));
  }

  const applied = results.filter((result) => result?.success).length;
  const failed = results.length - applied;

  return {
    success: failed === 0,
    applied,
    failed,
    results,
    backupLocation: createBackups ? `TidyFiles Backups\\${backupSessionId}` : null,
  };
}

export async function applyFileChanges(
  changes: ApplyChange[],
  options: { createBackups?: boolean } = {},
): Promise<ApplyResponse> {
  if (canApplyClientSideChanges(changes)) {
    return applyClientSideChanges(changes, options);
  }

  if (needsBrowserFileAccess(changes)) {
    throw new Error('Folder access has expired. Please go back to Scan Setup and re-select the folder before applying changes.');
  }

  // Chunking API requests to avoid Vercel Serverless Function timeouts on large batches
  const CHUNK_SIZE = 50;
  const allResults: ApplyResult[] = [];
  let combinedBackupLocation: string | null = null;
  
  for (let i = 0; i < changes.length; i += CHUNK_SIZE) {
    const chunk = changes.slice(i, i + CHUNK_SIZE);

    const response = await fetch('/api/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        changes: chunk,
        createBackups: options.createBackups ?? true,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result?.details || result?.error || 'Failed to apply changes chunk');
    }
    
    if (result.results) {
      allResults.push(...result.results);
    }
    if (result.backupLocation) {
      combinedBackupLocation = result.backupLocation; // Grab whichever backup location comes back
    }
  }

  const applied = allResults.filter(r => r.success).length;
  const failed = allResults.length - applied;

  return {
    success: failed === 0,
    applied,
    failed,
    results: allResults,
    backupLocation: combinedBackupLocation
  };
}

// --- Client-side undo safety check & execution ---

interface HistoryChange {
  fileId: string;
  originalPath: string;
  originalName: string;
  newPath?: string;
  newName?: string;
  action: string;
  size?: number;
}

interface ActionSafetyResult {
  fileId: string;
  originalPath: string;
  action: string;
  status: 'safe' | 'changed' | 'missing';
  reason?: string;
}

async function checkFileExistsByPath(filePath: string): Promise<boolean> {
  const parts = splitPathSegments(filePath);
  if (parts.length < 2) return false;
  const [rootName, ...relParts] = parts;
  const fileName = relParts.pop();
  if (!fileName) return false;
  try {
    const dir = await resolveDirectory(rootName, relParts, false);
    return await fileExists(dir, fileName);
  } catch {
    return false;
  }
}

export function hasDirectoryHandles(): boolean {
  return directoryHandleRegistry.size > 0;
}

export function canUndoClientSide(changes: HistoryChange[]): boolean {
  if (typeof window === 'undefined' || changes.length === 0) {
    return false;
  }

  return changes.every((change) => {
    const paths = [change.originalPath, change.newPath].filter(Boolean) as string[];
    return paths.every((filePath) => {
      if (isAbsoluteFilesystemPath(filePath)) {
        return false;
      }

      return hasDirectoryHandle(rootNameFromPath(filePath));
    });
  });
}

export async function checkUndoSafetyClientSide(
  changes: HistoryChange[]
): Promise<{
  overallSafety: 'safe' | 'partial' | 'unsafe';
  message: string;
  summary: { total: number; safe: number; changed: number; missing: number };
  actions: ActionSafetyResult[];
}> {
  if (directoryHandleRegistry.size === 0) {
    return {
      overallSafety: 'unsafe',
      message: 'Folder access has expired. Re-scan to enable undo.',
      summary: { total: changes.length, safe: 0, changed: 0, missing: changes.length },
      actions: changes.map(c => ({
        fileId: c.fileId, originalPath: c.originalPath, action: c.action,
        status: 'missing' as const, reason: 'No folder access',
      })),
    };
  }

  const actionResults: ActionSafetyResult[] = [];

  for (const change of changes) {
    const result: ActionSafetyResult = {
      fileId: change.fileId, originalPath: change.originalPath,
      action: change.action, status: 'safe',
    };

    try {
      if (change.action === 'rename' && change.newPath) {
        const renamedExists = await checkFileExistsByPath(change.newPath);
        if (!renamedExists) {
          result.status = 'missing';
          result.reason = 'Renamed file not found';
        } else {
          const origExists = await checkFileExistsByPath(change.originalPath);
          if (origExists) {
            result.status = 'changed';
            result.reason = 'A file already exists at original path';
          }
        }
      } else if ((change.action === 'move' || change.action === 'archive') && change.newPath) {
        const movedExists = await checkFileExistsByPath(change.newPath);
        if (!movedExists) {
          result.status = 'missing';
          result.reason = change.action === 'archive' ? 'Archived file not found' : 'Moved file not found';
        } else {
          const origExists = await checkFileExistsByPath(change.originalPath);
          if (origExists) {
            result.status = 'changed';
            result.reason = 'A file already exists at the original location';
          }
        }
      } else if (change.action === 'delete') {
        result.status = 'missing';
        result.reason = 'This change cannot be restored automatically from history';
      } else {
        result.status = 'missing';
        result.reason = 'Cannot determine undo path';
      }
    } catch {
      result.status = 'missing';
      result.reason = 'Error checking file';
    }

    actionResults.push(result);
  }

  const safeCount = actionResults.filter(r => r.status === 'safe').length;
  const changedCount = actionResults.filter(r => r.status === 'changed').length;
  const missingCount = actionResults.filter(r => r.status === 'missing').length;

  let overallSafety: 'safe' | 'partial' | 'unsafe';
  let message: string;

  if (safeCount === changes.length) {
    overallSafety = 'safe';
    message = 'All changes can be safely undone';
  } else if (safeCount > 0) {
    overallSafety = 'partial';
    message = `${safeCount} of ${changes.length} changes can be undone`;
  } else {
    overallSafety = 'unsafe';
    message = 'No changes can be undone';
  }

  return { overallSafety, message, summary: { total: changes.length, safe: safeCount, changed: changedCount, missing: missingCount }, actions: actionResults };
}

export async function performUndoClientSide(
  changes: HistoryChange[]
): Promise<{
  success: boolean;
  undone: number;
  failed: number;
  results: Array<{ success: boolean; fileId: string; action: string; error?: string }>;
}> {
  let undone = 0;
  let failed = 0;
  const results: Array<{ success: boolean; fileId: string; action: string; error?: string }> = [];

  for (const change of changes) {
    const result = {
      success: false,
      fileId: change.fileId,
      action: change.action,
      error: undefined as string | undefined,
    };

    try {
      if (change.action === 'rename' && change.newPath) {
        const newParts = splitPathSegments(change.newPath);
        const [rootName, ...newRelParts] = newParts;
        const newFileName = newRelParts.pop();
        if (!newFileName) {
          result.error = 'Missing renamed file name';
          failed++;
          results.push(result);
          continue;
        }

        const dir = await resolveDirectory(rootName, newRelParts, false);
        const fileHandle = await dir.getFileHandle(newFileName);
        const file = await fileHandle.getFile();

        const origFileName = change.originalName || splitPathSegments(change.originalPath).pop();
        if (!origFileName) {
          result.error = 'Missing original file name';
          failed++;
          results.push(result);
          continue;
        }

        if (await fileExists(dir, origFileName)) {
          result.error = 'Cannot restore because the original name is already in use';
          failed++;
          results.push(result);
          continue;
        }

        const newHandle = await dir.getFileHandle(origFileName, { create: true });
        await writeFile(newHandle, file);
        await dir.removeEntry(newFileName);
        undone++;
        result.success = true;
      } else if ((change.action === 'move' || change.action === 'archive') && change.newPath) {
        const newParts = splitPathSegments(change.newPath);
        const [newRoot, ...newRelParts] = newParts;
        const newFileName = newRelParts.pop();
        if (!newFileName) {
          result.error = 'Missing moved file name';
          failed++;
          results.push(result);
          continue;
        }

        const srcDir = await resolveDirectory(newRoot, newRelParts, false);
        const fh = await srcDir.getFileHandle(newFileName);
        const file = await fh.getFile();

        const origParts = splitPathSegments(change.originalPath);
        const [origRoot, ...origRelParts] = origParts;
        const origFileName = origRelParts.pop();
        if (!origFileName) {
          result.error = 'Missing original destination file name';
          failed++;
          results.push(result);
          continue;
        }

        const destDir = await resolveDirectory(origRoot, origRelParts, true);
        if (await fileExists(destDir, origFileName)) {
          result.error = 'Cannot restore because the original location is already occupied';
          failed++;
          results.push(result);
          continue;
        }
        const destHandle = await destDir.getFileHandle(origFileName, { create: true });
        await writeFile(destHandle, file);
        await srcDir.removeEntry(newFileName);
        undone++;
        result.success = true;
      } else {
        failed++;
        result.error = 'This change type cannot be undone from the browser';
      }
    } catch (err) {
      console.error('Undo failed for', change.originalPath, err);
      failed++;
      result.error = err instanceof Error ? err.message : 'Unknown error';
    }

    results.push(result);
  }

  return { success: failed === 0, undone, failed, results };
}
