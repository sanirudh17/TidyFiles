import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = 'AIzaSyBAoC3eK6wX5iyP6vvf9W6O7oTG7MHsveg';
const genAI = new GoogleGenerativeAI(API_KEY);

interface ExportFile {
  name: string;
  path: string;
  size: number;
  category: string;
  lastModified: number;
}

interface HistoryEntry {
  date: string;
  action: string;
  details: string;
  status: string;
  changes: Array<{
    originalName: string;
    newName?: string;
    action: string;
  }>;
}

function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function generateAISummary(files: ExportFile[], rootFolder: string): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite-preview' });
    
    const categories: Record<string, number> = {};
    let totalSize = 0;
    
    files.forEach(f => {
      categories[f.category] = (categories[f.category] || 0) + 1;
      totalSize += f.size;
    });

    const prompt = `Generate a brief 2-3 sentence summary of this folder for documentation purposes:
    
Folder: ${rootFolder}
Total files: ${files.length}
Total size: ${formatSize(totalSize)}
Categories: ${Object.entries(categories).map(([k, v]) => `${k} (${v})`).join(', ')}
Sample files: ${files.slice(0, 5).map(f => f.name).join(', ')}

Write a professional, factual summary suitable for a folder index document.`;

    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error('AI summary error:', error);
    return 'AI summary unavailable.';
  }
}

function generateFolderIndexHTML(
  files: ExportFile[], 
  rootFolder: string, 
  aiSummary?: string
): string {
  const categories: Record<string, ExportFile[]> = {};
  let totalSize = 0;
  
  files.forEach(f => {
    if (!categories[f.category]) categories[f.category] = [];
    categories[f.category].push(f);
    totalSize += f.size;
  });

  const categoryRows = Object.entries(categories)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([cat, catFiles]) => `
      <tr>
        <td>${cat}</td>
        <td>${catFiles.length}</td>
        <td>${formatSize(catFiles.reduce((sum, f) => sum + f.size, 0))}</td>
      </tr>
    `).join('');

  const fileRows = files
    .sort((a, b) => b.lastModified - a.lastModified)
    .slice(0, 100)
    .map(f => `
      <tr>
        <td>${f.name}</td>
        <td>${f.category}</td>
        <td>${formatSize(f.size)}</td>
        <td>${new Date(f.lastModified).toLocaleDateString()}</td>
      </tr>
    `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Folder Index - ${path.basename(rootFolder)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a2e; background: #f8f9fa; padding: 2rem; }
    .container { max-width: 900px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); padding: 2rem; }
    h1 { font-size: 1.5rem; color: #1a1a2e; margin-bottom: 0.5rem; }
    .subtitle { color: #6b7280; font-size: 0.875rem; margin-bottom: 2rem; }
    .summary { background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 1rem; border-radius: 0 8px 8px 0; margin-bottom: 2rem; }
    .summary h3 { color: #1e40af; font-size: 0.875rem; margin-bottom: 0.5rem; }
    .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem; }
    .stat { background: #f8f9fa; padding: 1rem; border-radius: 8px; text-align: center; }
    .stat-value { font-size: 1.5rem; font-weight: 700; color: #1a1a2e; }
    .stat-label { font-size: 0.75rem; color: #6b7280; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f8f9fa; font-weight: 600; color: #374151; }
    tr:hover { background: #f9fafb; }
    h2 { font-size: 1.125rem; margin: 2rem 0 1rem; color: #374151; }
    .footer { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #e5e7eb; font-size: 0.75rem; color: #9ca3af; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Folder Index</h1>
    <p class="subtitle">${rootFolder}</p>
    
    ${aiSummary ? `
    <div class="summary">
      <h3>AI Summary</h3>
      <p>${aiSummary}</p>
    </div>
    ` : ''}
    
    <div class="stats">
      <div class="stat">
        <div class="stat-value">${files.length.toLocaleString()}</div>
        <div class="stat-label">Total Files</div>
      </div>
      <div class="stat">
        <div class="stat-value">${formatSize(totalSize)}</div>
        <div class="stat-label">Total Size</div>
      </div>
      <div class="stat">
        <div class="stat-value">${Object.keys(categories).length}</div>
        <div class="stat-label">Categories</div>
      </div>
    </div>
    
    <h2>By Category</h2>
    <table>
      <thead>
        <tr><th>Category</th><th>Files</th><th>Size</th></tr>
      </thead>
      <tbody>${categoryRows}</tbody>
    </table>
    
    <h2>Files (Most Recent)</h2>
    <table>
      <thead>
        <tr><th>Name</th><th>Category</th><th>Size</th><th>Modified</th></tr>
      </thead>
      <tbody>${fileRows}</tbody>
    </table>
    ${files.length > 100 ? `<p style="text-align:center;color:#6b7280;margin-top:1rem;">Showing 100 of ${files.length} files</p>` : ''}
    
    <div class="footer">
      Generated by TidyFiles on ${formatDate(new Date())}
    </div>
  </div>
</body>
</html>`;
}

function generateCleanupReportHTML(
  history: HistoryEntry[],
  rootFolder: string,
  stats: { totalFiles: number; totalSize: number }
): string {
  const successfulOps = history.filter(h => h.status === 'Success');
  
  const totalRenames = successfulOps.reduce((sum, h) => 
    sum + h.changes.filter(c => c.action === 'rename').length, 0);
  const totalDeletes = successfulOps.reduce((sum, h) => 
    sum + h.changes.filter(c => c.action === 'delete').length, 0);
  const totalMoves = successfulOps.reduce((sum, h) => 
    sum + h.changes.filter(c => c.action === 'move').length, 0);

  const operationRows = successfulOps.map(op => `
    <div class="operation">
      <div class="op-header">
        <span class="op-date">${new Date(op.date).toLocaleDateString()}</span>
        <span class="op-action">${op.action}</span>
      </div>
      <p class="op-details">${op.details}</p>
      ${op.changes.length > 0 ? `
      <details>
        <summary>${op.changes.length} file changes</summary>
        <ul class="changes">
          ${op.changes.slice(0, 10).map(c => `
            <li>
              <span class="old">${c.originalName}</span>
              ${c.newName && c.action !== 'delete' ? `→ <span class="new">${c.newName}</span>` : ''}
              ${c.action === 'delete' ? '<span class="deleted">[Deleted]</span>' : ''}
            </li>
          `).join('')}
          ${op.changes.length > 10 ? `<li>... and ${op.changes.length - 10} more</li>` : ''}
        </ul>
      </details>
      ` : ''}
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cleanup Report - ${path.basename(rootFolder)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a2e; background: #f8f9fa; padding: 2rem; }
    .container { max-width: 900px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); padding: 2rem; }
    h1 { font-size: 1.5rem; color: #1a1a2e; margin-bottom: 0.5rem; }
    .subtitle { color: #6b7280; font-size: 0.875rem; margin-bottom: 2rem; }
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem; }
    .stat { background: #f8f9fa; padding: 1rem; border-radius: 8px; text-align: center; }
    .stat-value { font-size: 1.5rem; font-weight: 700; color: #1a1a2e; }
    .stat-label { font-size: 0.75rem; color: #6b7280; text-transform: uppercase; }
    .stat.green { background: #ecfdf5; }
    .stat.green .stat-value { color: #059669; }
    .operation { border: 1px solid #e5e7eb; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; }
    .op-header { display: flex; justify-content: space-between; margin-bottom: 0.5rem; }
    .op-date { color: #6b7280; font-size: 0.875rem; }
    .op-action { font-weight: 600; }
    .op-details { color: #6b7280; font-size: 0.875rem; }
    details { margin-top: 0.75rem; }
    summary { cursor: pointer; color: #3b82f6; font-size: 0.875rem; }
    .changes { list-style: none; margin-top: 0.5rem; font-size: 0.875rem; font-family: monospace; }
    .changes li { padding: 0.25rem 0; }
    .old { color: #6b7280; text-decoration: line-through; }
    .new { color: #059669; font-weight: 500; }
    .deleted { color: #dc2626; font-size: 0.75rem; }
    h2 { font-size: 1.125rem; margin: 2rem 0 1rem; color: #374151; }
    .footer { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #e5e7eb; font-size: 0.75rem; color: #9ca3af; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Cleanup Report</h1>
    <p class="subtitle">${rootFolder}</p>
    
    <div class="stats">
      <div class="stat">
        <div class="stat-value">${successfulOps.length}</div>
        <div class="stat-label">Operations</div>
      </div>
      <div class="stat green">
        <div class="stat-value">${totalRenames}</div>
        <div class="stat-label">Renames</div>
      </div>
      <div class="stat">
        <div class="stat-value">${totalDeletes}</div>
        <div class="stat-label">Deletes</div>
      </div>
      <div class="stat">
        <div class="stat-value">${totalMoves}</div>
        <div class="stat-label">Moves</div>
      </div>
    </div>
    
    <h2>Operation History</h2>
    ${operationRows || '<p style="color:#6b7280;">No operations recorded yet.</p>'}
    
    <div class="footer">
      Generated by TidyFiles on ${formatDate(new Date())}
    </div>
  </div>
</body>
</html>`;
}

export async function POST(request: NextRequest) {
  try {
    const { type, rootFolder, files, history, stats, includeAISummary, outputPath } = await request.json();

    if (!type || !rootFolder) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    let htmlContent: string;
    let filename: string;

    if (type === 'folder-snapshot') {
      // Export organized folder snapshot
      let aiSummary: string | undefined;
      
      if (includeAISummary) {
        aiSummary = await generateAISummary(files || [], rootFolder);
      }

      htmlContent = generateFolderIndexHTML(files || [], rootFolder, aiSummary);
      filename = `folder-index-${Date.now()}.html`;

    } else if (type === 'cleanup-report') {
      // Export cleanup report
      htmlContent = generateCleanupReportHTML(
        history || [],
        rootFolder,
        stats || { totalFiles: 0, totalSize: 0 }
      );
      filename = `cleanup-report-${Date.now()}.html`;

    } else {
      return NextResponse.json({ error: 'Invalid export type' }, { status: 400 });
    }

    // Write to output path or temp directory
    const outputDir = outputPath || path.join(process.env.TEMP || 'C:\\Temp', 'tidyfiles_exports');
    
    try {
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
    } catch (e) {
      console.warn('Could not create output directory:', e);
    }

    const filePath = path.join(outputDir, filename);
    fs.writeFileSync(filePath, htmlContent, 'utf-8');

    return NextResponse.json({
      success: true,
      filePath,
      filename,
      type,
    });

  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ 
      error: 'Failed to export',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
