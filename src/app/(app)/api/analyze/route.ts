import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';
import { GEMINI_MODELS } from '@/lib/gemini';

const API_KEY = process.env.GEMINI_API_KEY || '';

const PRIMARY_MODEL = GEMINI_MODELS.PRIMARY;
const FALLBACK_MODEL = GEMINI_MODELS.FALLBACK;
const VISION_MODEL = GEMINI_MODELS.VISION;

// Safe JSON parse with fallback
function safeJsonParse(text: string, fallback: any = null): any {
  try {
    // Try to extract JSON from markdown code blocks
    let jsonStr = text.trim();
    if (text.includes('```')) {
      const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) jsonStr = match[1].trim();
    }
    return JSON.parse(jsonStr);
  } catch (e) {
    console.warn('[safeJsonParse] Failed to parse JSON:', text.substring(0, 100));
    return fallback;
  }
}

const GEMINI_SYSTEM_PROMPT = `You are TidyFiles AI Renamer. Analyze file CONTENT/METADATA strictly:
1. EXTRACT: date (YYYY-MM), type (invoice/report/code/slide/image), topic/subject (1-3 words), status (draft/final/approved), author/client if present.
2. PROPOSE name: {YYYY-MM}_{Type}_{Topic}_{Status}.{ext} - Use underscores, <40 chars, descriptive NOT generic.
3. Examples: "Untitled.pdf" → "2026-01_Budget_Report_Final.pdf" | "image.jpg" → "2026-01_F1_Race_Highlight.png" (if racing image).
4. Confidence: 0.95 if clear content, 0.7 if metadata-only. Explain in 1 sentence.
5. NO changes if already optimal (e.g., already has date/type prefix, well-named).
6. NEVER suggest renaming to the same name or trivially similar names.
Reply JSON only: {"name": "...", "tags": [...], "confidence": 0.95, "reason": "..."}`;

// Special prompt for screenshot content analysis
const SCREENSHOT_VISION_PROMPT = `Analyze this screenshot and identify:
1. **App/Website**: What application or website is visible? (e.g., VS Code, Chrome, YouTube, Discord, WhatsApp, Slack, Excel)
2. **Content Summary**: What is the main content shown? (e.g., code, chat conversation, video, document, error message)
3. **Key Details**: Any visible text, dates, names, or topics that would help identify this screenshot later

Based on your analysis, suggest a descriptive filename following this format:
{YYYY-MM-DD}_{App}_{Topic}.{ext}

Examples:
- Screenshot of VS Code with Python code → "2026-01-18_VSCode_Python_API_Handler.png"
- Screenshot of YouTube video → "2026-01-18_YouTube_Tech_Tutorial.png"
- Screenshot of error message → "2026-01-18_Chrome_404_Error.png"
- Screenshot of chat → "2026-01-18_WhatsApp_Project_Discussion.png"

Return ONLY valid JSON:
{"app": "...", "topic": "...", "suggestedName": "...", "confidence": 0.85, "description": "..."}`;

// Detect if file is a screenshot
function isScreenshot(name: string): boolean {
  const screenshotPatterns = [
    /^Screenshot[_\s-]/i,
    /^Screen Shot /i,
    /^Capture[_\s-]/i,
    /^Snip[_\s-]/i,
    /^CleanShot/i,
    /^Greenshot/i,
    /^Lightshot/i,
    /^ShareX/i,
    /Screenshot_\d+/i,
    /Screen_Shot_\d+/i,
  ];
  return screenshotPatterns.some(p => p.test(name));
}

// Windows system file protection
const WINDOWS_SYSTEM_PATHS = [
  /[A-Z]:\\Windows/i,
  /[A-Z]:\\Program Files/i,
  /[A-Z]:\\Program Files \(x86\)/i,
  /\\AppData\\Local\\Microsoft/i,
  /\\AppData\\Roaming\\Microsoft/i,
  /\\System32/i,
  /\\SysWOW64/i,
  /\\WinSxS/i,
  /\\assembly/i,
];

const CRITICAL_EXTENSIONS = new Set([
  '.dll', '.sys', '.exe', '.scr', '.drv', '.ocx', '.cpl',
  '.msi', '.msp', '.msu', '.cat', '.inf', '.pdb',
]);

const SYSTEM_FILES = new Set([
  'desktop.ini', 'thumbs.db', 'ntuser.dat', 'ntuser.ini',
  'pagefile.sys', 'hiberfil.sys', 'swapfile.sys',
  'bootmgr', 'ntldr', 'boot.ini', 'autoexec.bat', 'config.sys',
]);

interface FileRiskAssessment {
  riskLevel: 'safe' | 'warning' | 'critical';
  reason?: string;
}

function assessFileRisk(filePath: string, fileName: string, ext: string): FileRiskAssessment {
  const lowerPath = filePath.toLowerCase();
  const lowerName = fileName.toLowerCase();
  const lowerExt = ext.toLowerCase();
  
  // Check system files by name
  if (SYSTEM_FILES.has(lowerName)) {
    return { riskLevel: 'critical', reason: 'Windows system file' };
  }
  
  // Check critical extensions
  if (CRITICAL_EXTENSIONS.has(lowerExt)) {
    // DLL/EXE in system paths = critical
    if (WINDOWS_SYSTEM_PATHS.some(p => p.test(lowerPath))) {
      return { riskLevel: 'critical', reason: 'System executable/library' };
    }
    // DLL/EXE elsewhere = warning
    return { riskLevel: 'warning', reason: 'Executable file - verify before changing' };
  }
  
  // Check system paths (non-executables)
  if (WINDOWS_SYSTEM_PATHS.some(p => p.test(lowerPath))) {
    return { riskLevel: 'warning', reason: 'File in system directory' };
  }
  
  return { riskLevel: 'safe' };
}

interface FileInfo {
  id: string;
  name: string;
  path: string;
  size: number;
  lastModified: number;
  extension: string;
  type: string;
  category: string;
}

interface Suggestion {
  id: string;
  fileId: string;
  originalFile: FileInfo;
  action: 'rename' | 'move' | 'delete' | 'merge' | 'archive';
  proposedName?: string;
  proposedPath?: string;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  confidenceScore: number; // 0-1 numeric score
  aiExplanation?: string; // Detailed explanation for "Why?" popover
  status: 'pending' | 'approved' | 'rejected';
  riskLevel?: 'safe' | 'warning' | 'critical'; // Windows system file protection
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

// Levenshtein distance for comparing string similarity
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

// Check if rename is meaningful (not trivial)
function isRenameSignificant(original: string, proposed: string): boolean {
  // Exact same name - definitely not significant
  if (original.toLowerCase() === proposed.toLowerCase()) {
    return false;
  }
  
  const origWithoutExt = original.substring(0, original.lastIndexOf('.')) || original;
  const propWithoutExt = proposed.substring(0, proposed.lastIndexOf('.')) || proposed;
  
  // Same base name - not significant
  if (origWithoutExt.toLowerCase() === propWithoutExt.toLowerCase()) {
    return false;
  }
  
  const distance = levenshteinDistance(origWithoutExt.toLowerCase(), propWithoutExt.toLowerCase());
  const maxLen = Math.max(origWithoutExt.length, propWithoutExt.length);
  const changeRatio = distance / maxLen;
  
  // Less than 10% change AND less than 3 char difference = trivial
  if (changeRatio < 0.10 && Math.abs(origWithoutExt.length - propWithoutExt.length) < 3) {
    return false;
  }
  
  // At least 15% change or 4+ char difference = significant
  return changeRatio >= 0.15 || distance >= 4;
}

// Convert confidence label to numeric score
function confidenceToScore(confidence: 'high' | 'medium' | 'low'): number {
  switch (confidence) {
    case 'high': return 0.95;
    case 'medium': return 0.75;
    case 'low': return 0.55;
  }
}

// Extract text from PDF using pdf-parse
async function extractPdfText(filePath: string): Promise<string | null> {
  try {
    const pdfParse = require('pdf-parse');
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    // Return first 2000 chars for analysis
    return data.text?.substring(0, 2000) || null;
  } catch {
    return null;
  }
}

// Extract metadata from Excel using xlsx
async function extractExcelMetadata(filePath: string): Promise<string | null> {
  try {
    const XLSX = require('xlsx');
    const workbook = XLSX.readFile(filePath, { sheetRows: 5 }); // Only first 5 rows
    const sheetNames = workbook.SheetNames;
    const firstSheet = workbook.Sheets[sheetNames[0]];
    const json = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
    // Get first few rows as context
    const preview = json.slice(0, 3).map((row: unknown[]) => row.join(' | ')).join('\n');
    return `Sheets: ${sheetNames.join(', ')}\nPreview:\n${preview}`.substring(0, 1000);
  } catch {
    return null;
  }
}

// Read image file and convert to base64 (for Vision API)
async function readImageAsBase64(filePath: string, maxBytes: number = 2 * 1024 * 1024): Promise<string | null> {
  try {
    const stats = fs.statSync(filePath);
    const size = Math.min(stats.size, maxBytes);
    
    const buffer = Buffer.alloc(size);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, size, 0);
    fs.closeSync(fd);
    
    return buffer.toString('base64');
  } catch {
    return null;
  }
}

// Get MIME type for image
function getImageMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
  };
  return mimeTypes[ext.toLowerCase()] || 'image/jpeg';
}

// Format date according to user settings
function formatDateForFilename(date: Date, dateFormat: string = 'YYYY-MM-DD'): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  switch (dateFormat) {
    case 'DD-MM-YYYY':
      return `${day}-${month}-${year}`;
    case 'MM-DD-YYYY':
      return `${month}-${day}-${year}`;
    case 'YYYY-MM-DD':
    default:
      return `${year}-${month}-${day}`;
  }
}

// Comprehensive pattern detection
function detectPatterns(files: FileInfo[], settings: { dateFormat?: string; spaceHandling?: string }): { suggestions: Suggestion[]; skippedCritical: number } {
  const suggestions: Suggestion[] = [];
  const filesByName = new Map<string, FileInfo[]>();
  const filesByHash = new Map<string, FileInfo[]>(); // Group by size for potential duplicates
  const skippedCritical: string[] = []; // Track skipped critical files
  
  for (const file of files) {
    // Skip invalid files
    if (!file || !file.name || typeof file.name !== 'string') {
      console.warn('Skipping invalid file:', file);
      continue;
    }
    
    // === WINDOWS SYSTEM FILE PROTECTION ===
    const riskAssessment = assessFileRisk(file.path, file.name, file.extension);
    
    // Skip critical files entirely - don't suggest any changes
    if (riskAssessment.riskLevel === 'critical') {
      skippedCritical.push(file.name);
      continue;
    }
    
    // Group by name for duplicate detection
    const key = file.name.toLowerCase();
    if (!filesByName.has(key)) {
      filesByName.set(key, []);
    }
    filesByName.get(key)!.push(file);
    
    // Group by size for hash-based duplicate detection
    const sizeKey = `${file.size}`;
    if (!filesByHash.has(sizeKey)) {
      filesByHash.set(sizeKey, []);
    }
    filesByHash.get(sizeKey)!.push(file);
    
    const name = file.name;
    const ext = file.extension;
    const nameWithoutExt = name.substring(0, name.lastIndexOf('.')) || name;
    
    // ===== PATTERN: Gemini Generated Images =====
    if (/Gemini_Generated_Image_/i.test(name) || /gemini.*generated/i.test(name)) {
      const date = new Date(file.lastModified);
      const dateStr = formatDateForFilename(date, settings.dateFormat);
      const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-');
      suggestions.push({
        id: generateId(),
        fileId: file.id,
        originalFile: file,
        action: 'rename',
        proposedName: `AI_Generated_${dateStr}_${timeStr}${ext}`,
        reason: 'Rename Gemini-generated image with readable timestamp',
        confidence: 'high',
        confidenceScore: 0.95,
        aiExplanation: 'This file was created by Google Gemini AI image generation. The current name contains a random identifier that provides no context. Renaming to include the creation date and time makes it easier to organize and find AI-generated images chronologically.',
        status: 'pending',
        riskLevel: riskAssessment.riskLevel,
      });
      continue; // Skip other patterns for this file
    }
    
    // ===== PATTERN: Copy of, (1), (2), - Copy, etc. =====
    const copyPatterns = [
      /^copy of /i,
      / - copy$/i,
      / - copy \(\d+\)$/i,
      /\s*\(\d+\)$/,
      / copy$/i,
    ];
    
    for (const pattern of copyPatterns) {
      if (pattern.test(nameWithoutExt)) {
        let cleanName = nameWithoutExt
          .replace(/^copy of /i, '')
          .replace(/ - copy(\s*\(\d+\))?$/i, '')
          .replace(/\s*\(\d+\)$/, '')
          .replace(/ copy$/i, '');
        suggestions.push({
          id: generateId(),
          fileId: file.id,
          originalFile: file,
          action: 'rename',
          proposedName: `${cleanName}${ext}`,
          reason: 'Remove duplicate/copy suffix',
          confidence: 'high',
          confidenceScore: 0.92,
          aiExplanation: `The filename contains a copy indicator (like "(1)" or "Copy of") which typically appears when Windows creates duplicate files. This suggests either: 1) The file is a duplicate of another file, or 2) The original was renamed without updating this copy. We recommend cleaning up the name while you verify if the duplicate is needed.`,
          status: 'pending',
        });
        break;
      }
    }
    
    // ===== PATTERN: Screenshot naming (various formats) =====
    const screenshotPatterns = [
      /^IMG_\d+/i,
      /^Screenshot[_\s-]/i,
      /^Screen Shot /i,
      /^DSC_?\d+/i,
      /^DCIM/i,
      /^Photo_\d+/i,
      /^VID_\d+/i,
      /^WP_\d+/i,
      /^WIN_\d+/i,
    ];
    
    for (const pattern of screenshotPatterns) {
      if (pattern.test(name)) {
        const date = new Date(file.lastModified);
        const dateStr = formatDateForFilename(date, settings.dateFormat);
        const prefix = file.type === 'video' ? 'Video' : file.type === 'image' ? 'Photo' : 'File';
        suggestions.push({
          id: generateId(),
          fileId: file.id,
          originalFile: file,
          action: 'rename',
          proposedName: `${prefix}_${dateStr}${ext}`,
          reason: 'Standardize media file naming with date',
          confidence: 'medium',
          confidenceScore: 0.78,
          aiExplanation: `This file uses a camera/device-generated name (like IMG_xxxx or DSC_xxxx) that doesn't convey what the photo contains. Adding a date prefix makes files sortable chronologically. Consider adding a descriptive suffix after applying this rename to make it even more useful.`,
          status: 'pending',
        });
        break;
      }
    }
    
    // ===== PATTERN: Random/hash-like filenames =====
    if (/^[a-f0-9]{8,}$/i.test(nameWithoutExt) || /^[a-z0-9]{20,}$/i.test(nameWithoutExt)) {
      const date = new Date(file.lastModified);
      const dateStr = formatDateForFilename(date, settings.dateFormat);
      suggestions.push({
        id: generateId(),
        fileId: file.id,
        originalFile: file,
        action: 'rename',
        proposedName: `Downloaded_${dateStr}_${nameWithoutExt.slice(0, 8)}${ext}`,
        reason: 'Random/hash filename - add context',
        confidence: 'medium',
        confidenceScore: 0.72,
        aiExplanation: `This filename appears to be a random hash or identifier, commonly seen in files downloaded from the web or exported from applications. These names provide no context about the file's contents. We suggest adding a date prefix and keeping a shortened version of the hash for uniqueness. You may want to give it a more descriptive name based on its actual content.`,
        status: 'pending',
      });
    }
    
    // ===== PATTERN: Installer/Setup files =====
    if (/setup|installer|install/i.test(name) && /\.(exe|msi)$/i.test(name)) {
      suggestions.push({
        id: generateId(),
        fileId: file.id,
        originalFile: file,
        action: 'archive',
        reason: 'Installer file - consider archiving after installation',
        confidence: 'low',
        confidenceScore: 0.55,
        aiExplanation: `This appears to be a software installer file. Once software is installed, the installer is often no longer needed and takes up disk space. Consider moving it to an archive folder or external storage, or deleting it if you can re-download when needed.`,
        status: 'pending',
      });
    }
    
    // ===== PATTERN: Spaces and special characters =====
    if (/\s{2,}/.test(name) || /[#%&{}<>*?$!'":@+`|=]/.test(name)) {
      let cleanName = name
        .replace(/\s{2,}/g, ' ')
        .replace(/[#%&{}<>*?$!'":@+`|=]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
      if (cleanName !== name) {
        suggestions.push({
          id: generateId(),
          fileId: file.id,
          originalFile: file,
          action: 'rename',
          proposedName: cleanName,
          reason: 'Remove special characters for compatibility',
          confidence: 'high',
          confidenceScore: 0.88,
          aiExplanation: `This filename contains special characters that can cause issues with certain applications, scripts, or when transferring between operating systems. Characters like #, %, &, and spaces can break URLs and command-line operations. Replacing them with underscores ensures maximum compatibility.`,
          status: 'pending',
        });
      }
    }
    
    // ===== PATTERN: Temp/backup files =====
    if (/\.(tmp|temp|bak|old|swp|~|crdownload|partial)$/i.test(name) || /^~/.test(name) || /^\.~/.test(name)) {
      suggestions.push({
        id: generateId(),
        fileId: file.id,
        originalFile: file,
        action: 'delete',
        reason: 'Temporary/backup file - safe to remove',
        confidence: 'high',
        confidenceScore: 0.90,
        aiExplanation: `This is a temporary or backup file created by applications during editing or downloading. Files with extensions like .tmp, .bak, .swp, .crdownload are typically safe to delete as they're created automatically and aren't needed after the original operation completes.`,
        status: 'pending',
      });
    }
    
    // ===== PATTERN: Empty files =====
    if (file.size === 0) {
      suggestions.push({
        id: generateId(),
        fileId: file.id,
        originalFile: file,
        action: 'delete',
        reason: 'Empty file (0 bytes)',
        confidence: 'high',
        confidenceScore: 0.93,
        aiExplanation: `This file is completely empty (0 bytes). Empty files are usually the result of failed saves, interrupted downloads, or placeholder files that were never populated with content. They serve no purpose and can be safely deleted.`,
        status: 'pending',
      });
    }
    
    // ===== PATTERN: Very old files (> 2 years) =====
    const twoYearsAgo = Date.now() - (2 * 365 * 24 * 60 * 60 * 1000);
    if (file.lastModified < twoYearsAgo && file.size > 10 * 1024 * 1024) { // > 10MB and old
      suggestions.push({
        id: generateId(),
        fileId: file.id,
        originalFile: file,
        action: 'archive',
        reason: 'Large file not modified in over 2 years',
        confidence: 'low',
        confidenceScore: 0.52,
        aiExplanation: `This file is larger than 10MB and hasn't been modified in over 2 years. While it might still be important, files that aren't accessed for long periods often can be archived to free up space. Consider moving it to an archive folder or cloud storage for long-term retention.`,
        status: 'pending',
      });
    }
  }
  
  // ===== PATTERN: Exact duplicates by name in different locations =====
  for (const [, filesWithSameName] of filesByName) {
    if (filesWithSameName.length > 1) {
      filesWithSameName.sort((a, b) => b.lastModified - a.lastModified);
      
      for (let i = 1; i < filesWithSameName.length; i++) {
        const file = filesWithSameName[i];
        if (file.size === filesWithSameName[0].size) {
          // Check if we already have a suggestion for this file
          if (!suggestions.some(s => s.fileId === file.id)) {
            suggestions.push({
              id: generateId(),
              fileId: file.id,
              originalFile: file,
              action: 'delete',
              reason: `Duplicate of ${filesWithSameName[0].name} (keeping newer version)`,
              confidence: 'high',
              confidenceScore: 0.88,
              aiExplanation: `This file has the exact same name and size as another file in your folders. The file at "${filesWithSameName[0].path}" was modified more recently and appears to be the primary copy. This older version is likely a duplicate that can be safely removed.`,
              status: 'pending',
            });
          }
        }
      }
    }
  }
  
  // ===== PATTERN: Potential duplicates by size (same size, similar names) =====
  for (const [, filesWithSameSize] of filesByHash) {
    if (filesWithSameSize.length > 1 && filesWithSameSize[0].size > 1024) { // > 1KB
      // Check for similar names
      for (let i = 0; i < filesWithSameSize.length; i++) {
        for (let j = i + 1; j < filesWithSameSize.length; j++) {
          const file1 = filesWithSameSize[i];
          const file2 = filesWithSameSize[j];
          
          // Skip if already suggested
          if (suggestions.some(s => s.fileId === file2.id)) continue;
          
          // Check if names are similar (same extension, similar length)
          if (file1.extension === file2.extension && 
              Math.abs(file1.name.length - file2.name.length) < 10) {
            suggestions.push({
              id: generateId(),
              fileId: file2.id,
              originalFile: file2,
              action: 'delete',
              reason: `Possible duplicate of ${file1.name} (same size: ${Math.round(file1.size / 1024)}KB)`,
              confidence: 'medium',
              confidenceScore: 0.70,
              aiExplanation: `This file has the exact same file size as "${file1.name}" and a similar filename. While not confirmed identical without comparing contents, files with matching sizes and similar names are often duplicates created through copy operations or multiple downloads.`,
              status: 'pending',
            });
          }
        }
      }
    }
  }
  
  // ===== PATTERN: MOVE - Loose files that should be organized =====
  // Build a map of existing folders to suggest targets
  const folderMap = new Map<string, number>(); // folder name -> file count
  const rootFiles: FileInfo[] = []; // Files in root level (no subfolder)
  
  for (const file of files) {
    const riskAssessment = assessFileRisk(file.path, file.name, file.extension);
    if (riskAssessment.riskLevel === 'critical') continue;
    
    const pathParts = file.path.replace(/\//g, '\\').split('\\');
    const fileName = pathParts.pop() || '';
    const parentFolder = pathParts.pop() || '';
    const grandparent = pathParts.pop() || '';
    
    // If file is directly in the scanned root (1 level deep)
    // we consider it a "loose file" candidate for move suggestions
    if (pathParts.length <= 2) { // Near root
      rootFiles.push(file);
    }
    
    // Track folder counts
    if (parentFolder) {
      folderMap.set(parentFolder.toLowerCase(), (folderMap.get(parentFolder.toLowerCase()) || 0) + 1);
    }
  }
  
  // Suggest moves for loose files based on their type
  const categoryToFolder: Record<string, string> = {
    'document': 'Documents',
    'spreadsheet': 'Documents',
    'presentation': 'Documents',
    'image': 'Images',
    'video': 'Videos',
    'audio': 'Music',
    'code': 'Code',
    'archive': 'Archives',
  };
  
  for (const file of rootFiles) {
    // Skip if already suggested
    if (suggestions.some(s => s.fileId === file.id)) continue;
    
    const targetFolder = categoryToFolder[file.category.toLowerCase()];
    if (!targetFolder) continue;
    
    // Check if target folder exists or makes sense
    const targetExists = folderMap.has(targetFolder.toLowerCase());
    
    // Only suggest move if:
    // 1. The file is a loose file (in root)
    // 2. There's a clear target folder based on category
    const pathParts = file.path.replace(/\//g, '\\').split('\\');
    pathParts.pop(); // Remove filename
    const currentDir = pathParts.join('\\');
    
    suggestions.push({
      id: generateId(),
      fileId: file.id,
      originalFile: file,
      action: 'move',
      proposedPath: `${currentDir}\\${targetFolder}\\${file.name}`,
      reason: `Move ${file.category} file to ${targetFolder}/ folder`,
      confidence: targetExists ? 'medium' : 'low',
      confidenceScore: targetExists ? 0.75 : 0.60,
      aiExplanation: `This ${file.category} file is currently in the root of your scanned folder. Moving it to a dedicated "${targetFolder}" folder would improve organization. ${targetExists ? 'This folder already exists in your directory.' : 'This folder will be created if you approve.'}`,
      status: 'pending',
    });
  }
  
  return { suggestions, skippedCritical: skippedCritical.length };
}

export async function POST(request: NextRequest) {
  try {
    const { files, settings } = await request.json();
    
    if (!files || !Array.isArray(files)) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }
    
    // Filter out invalid files
    const validFiles = files.filter((f: any) => f && f.name && typeof f.name === 'string');
    if (validFiles.length === 0) {
      return NextResponse.json({ error: 'No valid files provided' }, { status: 400 });
    }
    
    console.log(`[analyze] Processing ${validFiles.length} valid files (filtered ${files.length - validFiles.length} invalid)`);
    
    // Start with comprehensive rule-based detection
    const { suggestions: ruleSuggestions, skippedCritical } = detectPatterns(validFiles, settings || {});
    const allSuggestions: Suggestion[] = [...ruleSuggestions];
    
    // Get files that haven't been suggested yet for AI analysis
    const suggestedFileIds = new Set(ruleSuggestions.map(s => s.fileId));
    const unsuggestedFiles = validFiles.filter((f: FileInfo) => !suggestedFileIds.has(f.id));
    
    // Separate images for Vision API analysis
    const imageFiles = unsuggestedFiles.filter((f: FileInfo) => f.type === 'image').slice(0, 10);
    const otherFiles = unsuggestedFiles.filter((f: FileInfo) => f.type !== 'image');
    
    // Analyze images with Vision API
    if (imageFiles.length > 0 && API_KEY) {
      try {
        const genAI = new GoogleGenerativeAI(API_KEY);
        const visionModel = genAI.getGenerativeModel({ model: VISION_MODEL });
        
        for (const imageFile of imageFiles) {
          try {
            const base64Data = await readImageAsBase64(imageFile.path);
            if (!base64Data) continue;
            
            const mimeType = getImageMimeType(imageFile.extension);
            const isScreenshotFile = isScreenshot(imageFile.name);
            
            // Use specialized prompt for screenshots
            const prompt = isScreenshotFile ? SCREENSHOT_VISION_PROMPT : `Analyze this image and provide:
1. A brief description (10-20 words) of what the image shows
2. Any visible text, dates, or identifiable information
3. A suggested descriptive filename (without extension)

Format your response EXACTLY as JSON:
{"description": "...", "extractedText": "...", "suggestedName": "..."}`;

            const result = await visionModel.generateContent([
              { text: prompt },
              { inlineData: { mimeType, data: base64Data } }
            ]);
            
            const responseText = result.response.text();
            
            try {
              const visionResult = safeJsonParse(responseText);
              
              // Skip if parse failed
              if (!visionResult) {
                console.warn('[Vision] Failed to parse AI response, skipping');
                continue;
              }
              
              // Handle screenshot-specific response format
              const suggestedName = visionResult.suggestedName;
              const confidence = visionResult.confidence || (isScreenshotFile ? 0.88 : 0.85);
              
              // Only suggest if confidence meets threshold
              if (suggestedName && confidence >= 0.8) {
                // Clean up the suggested name
                const cleanName = suggestedName
                  .replace(/[#%&{}<>*?$!'":@+`|=]/g, '_')
                  .replace(/\s+/g, '_')
                  .replace(/_+/g, '_')
                  .substring(0, 60);
                
                const date = new Date(imageFile.lastModified);
                const dateStr = formatDateForFilename(date, settings?.dateFormat);
                
                // For screenshots, the suggestedName already includes the date format
                const finalName = isScreenshotFile 
                  ? `${cleanName}${imageFile.extension}`
                  : `${dateStr}_${cleanName}${imageFile.extension}`;
                
                const description = isScreenshotFile 
                  ? `Screenshot of ${visionResult.app || 'application'}: ${visionResult.topic || visionResult.description}`
                  : visionResult.description;
                
                // Add risk assessment for image files
                const imageRisk = assessFileRisk(imageFile.path, imageFile.name, imageFile.extension);
                
                allSuggestions.push({
                  id: generateId(),
                  fileId: imageFile.id,
                  originalFile: imageFile,
                  action: 'rename',
                  proposedName: finalName,
                  reason: isScreenshotFile 
                    ? `Screenshot: ${visionResult.app || 'App'} - ${visionResult.topic || 'content'}`
                    : `AI Vision: ${description.substring(0, 50)}`,
                  confidence: confidence >= 0.9 ? 'high' : 'medium',
                  confidenceScore: confidence,
                  aiExplanation: isScreenshotFile 
                    ? `**Screenshot Analysis:**\n\n**Application:** ${visionResult.app || 'Unknown'}\n**Content:** ${visionResult.description || visionResult.topic}\n\nThe suggested name includes the date and identifies the app/website shown, making it easy to find this screenshot later.`
                    : `Based on AI image analysis:\n\n**What I see:** ${description}\n\n**Extracted text:** ${visionResult.extractedText || 'None detected'}\n\nThe suggested name combines the file date with a descriptive name based on the image content, making it easier to find and organize.`,
                  status: 'pending',
                  riskLevel: imageRisk.riskLevel,
                });
              }
            } catch {
              // Skip if can't parse vision result
            }
          } catch {
            // Skip individual image errors
          }
        }
      } catch (visionError) {
        console.warn('Vision API error:', visionError);
      }
    }
    
    // Only call text AI if there are unsuggested non-image files and an API key is configured.
    if (otherFiles.length > 0 && API_KEY) {
      try {
        const genAI = new GoogleGenerativeAI(API_KEY);
        
        // Process files in batches to prevent context token overflow and losing files on large folders
        const chunkSize = 120;
        const batches = [];
        for (let i = 0; i < otherFiles.length; i += chunkSize) {
          batches.push(otherFiles.slice(i, i + chunkSize));
        }

        const processBatch = async (batch: FileInfo[]) => {
          const fileSample = batch.map((f: FileInfo) => ({
            name: f.name,
            path: f.path,
            size: f.size,
            type: f.type,
            category: f.category,
            extension: f.extension,
            lastModified: new Date(f.lastModified).toISOString(),
          }));
          
          const prompt = `You are an expert file organization assistant. Analyze these files and suggest improvements.

FILES TO ANALYZE:
${JSON.stringify(fileSample, null, 2)}

USER PREFERENCES:
- Date format: ${settings?.dateFormat || 'YYYY-MM-DD'}
- Space handling: ${settings?.spaceHandling || 'keep'}

YOUR TASK: Review each file and suggest improvements. Look for:

1. RENAME opportunities:
   - Files with unclear names (random strings, UUIDs, hash-like names)
   - Files with version numbers that should be cleaned (v1, v2, final, FINAL_FINAL)
   - Files with inconsistent naming conventions
   - Files that would benefit from date prefixes

2. DELETE opportunities:
   - Duplicate files
   - Temp/cache files
   - Empty or corrupted files
   - Old downloads no longer needed

3. MOVE opportunities:
   - Files in wrong folders based on type
   - Files that should be grouped together

4. ARCHIVE opportunities:
   - Old files that haven't been accessed in a long time
   - Large files taking up space

For each suggestion, provide:
- fileName: exact original filename (must match exactly)
- action: "rename" | "delete" | "move" | "archive"
- proposedName: new name (for rename only, include extension)
- reason: brief explanation (1 sentence)
- confidence: "high" | "medium" | "low"
- confidenceScore: number between 0 and 1 (e.g., 0.85)
- aiExplanation: detailed 2-3 sentence explanation of why this change is recommended

Return ONLY a valid JSON array. Example:
[{"fileName": "example.pdf", "action": "rename", "proposedName": "2024-01-15_Report.pdf", "reason": "Add date prefix for organization", "confidence": "high", "confidenceScore": 0.92, "aiExplanation": "This file appears to be a report but lacks any date context in its name. Adding the date prefix makes it sortable chronologically and easier to find among other reports."}]

If no suggestions needed, return: []`;

          let responseText = '';

          try {
            const primaryModel = genAI.getGenerativeModel({ model: PRIMARY_MODEL });
            const result = await primaryModel.generateContent(prompt);
            responseText = result.response.text();
          } catch (primaryError) {
            console.warn(`[AI] Primary model ${PRIMARY_MODEL} failed, retrying with ${FALLBACK_MODEL}:`, primaryError);
            const fallbackModel = genAI.getGenerativeModel({ model: FALLBACK_MODEL });
            const fallbackResult = await fallbackModel.generateContent(prompt);
            responseText = fallbackResult.response.text();
          }
          
          // Parse AI response
          try {
            const aiSuggestions = safeJsonParse(responseText, []);
            
            if (!aiSuggestions || !Array.isArray(aiSuggestions)) {
              console.warn('[AI] Failed to parse AI suggestions for batch');
            } else if (aiSuggestions.length > 0) {
              for (const aiSug of aiSuggestions) {
                const originalFile = files.find((f: FileInfo) => f.name === aiSug.fileName);
                if (!originalFile) continue;
                
                // Skip if we already have a suggestion or confidence is too low
                if (allSuggestions.some(s => s.fileId === originalFile.id)) continue;
                if (aiSug.confidenceScore && aiSug.confidenceScore < 0.6) continue;
                
                allSuggestions.push({
                  id: generateId(),
                  fileId: originalFile.id,
                  originalFile,
                  action: aiSug.action,
                  proposedName: aiSug.proposedName,
                  proposedPath: aiSug.proposedPath,
                  reason: `AI: ${aiSug.reason}`,
                  confidence: aiSug.confidence || 'medium',
                  confidenceScore: aiSug.confidenceScore || confidenceToScore(aiSug.confidence || 'medium'),
                  aiExplanation: aiSug.aiExplanation || aiSug.reason,
                  status: 'pending',
                });
              }
            }
          } catch (parseError) {
            console.warn('Could not parse AI response:', parseError);
          }
        };

        // Process batches with limited concurrency
        const CONCURRENCY_LIMIT = 3;
        for (let i = 0; i < batches.length; i += CONCURRENCY_LIMIT) {
          const concurrentBatches = batches.slice(i, i + CONCURRENCY_LIMIT);
          await Promise.all(concurrentBatches.map(b => processBatch(b)));
        }
        
      } catch (aiError) {
        console.warn('AI analysis failed:', aiError);
      }
    }
    
    // Remove any duplicate suggestions, filter low confidence, and filter trivial renames
    const uniqueSuggestions = allSuggestions
      .filter((suggestion, index, self) =>
        index === self.findIndex(s => s.fileId === suggestion.fileId)
      )
      .filter(s => (s.confidenceScore || 0.5) >= 0.5) // Only show confidence >= 50%
      .filter(s => {
        // Filter out trivial renames (same name or minimal change)
        if (s.action === 'rename' && s.proposedName) {
          return isRenameSignificant(s.originalFile.name, s.proposedName);
        }
        return true;
      });
    
    return NextResponse.json({
      suggestions: uniqueSuggestions,
      totalAnalyzed: files.length,
      ruleBasedCount: ruleSuggestions.length,
      aiPowered: true,
      visionAnalyzed: imageFiles.length,
      filteredTrivial: allSuggestions.length - uniqueSuggestions.length,
      systemFilesSkipped: skippedCritical,
    });
    
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json({ error: 'Failed to analyze files' }, { status: 500 });
  }
}
