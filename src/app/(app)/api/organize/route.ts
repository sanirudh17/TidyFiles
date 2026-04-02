import { NextRequest, NextResponse } from 'next/server';
import { geminiFile } from '@/lib/gemini';

interface FileInfo {
  id: string;
  name: string;
  path: string;
  size: number;
  category: string;
  extension: string;
}

interface FolderSuggestion {
  name: string;
  path: string;
  reason: string;
  fileIds: string[];
}

export async function POST(req: NextRequest) {
  try {
    const { files, basePath } = await req.json() as { files: FileInfo[]; basePath: string };

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    console.log(`[organize] Analyzing ${files.length} files with Gemini`);

    // Use Gemini file operations
    const result = await geminiFile.organizeFiles(files, basePath);

    console.log(`[organize] Model used: ${result.model}, fallback: ${result.fallbackUsed || false}`);

    if (!result.success) {
      console.warn('[organize] AI failed, using static fallback');
      const folders = generateFallbackSuggestions(files, basePath);
      return NextResponse.json({ 
        folders, 
        fallback: true,
        model: 'static-fallback'
      });
    }

    try {
      // Parse JSON from response
      const jsonMatch = result.response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]) as { 
        folders: Array<{ name: string; reasoning?: string; reason?: string; fileIds: string[] }>;
        unassigned?: string[];
      };
      
      // Validate and clean up the response
      const validFolders = parsed.folders
        .filter(folder => 
          folder.name && 
          folder.fileIds && 
          Array.isArray(folder.fileIds) &&
          folder.fileIds.length > 0
        )
        .map(folder => ({
          name: folder.name.replace(/[<>:"/\\|?*]/g, '_'), // Sanitize folder name
          path: `${basePath}/${folder.name.replace(/[<>:"/\\|?*]/g, '_')}`,
          reason: folder.reasoning || folder.reason || 'Grouped by AI analysis',
          fileIds: folder.fileIds.filter(id => files.some(f => f.id === id)), // Only include valid IDs
        }))
        .filter(folder => folder.fileIds.length > 0);

      console.log(`[organize] Generated ${validFolders.length} folder suggestions using ${result.model}`);

      return NextResponse.json({ 
        folders: validFolders,
        model: result.model,
        fallbackUsed: result.fallbackUsed || false
      });

    } catch (parseError) {
      console.error('[organize] Parse error:', parseError);
      
      // Fallback: Generate smart suggestions based on file patterns
      const folders = generateFallbackSuggestions(files, basePath);
      return NextResponse.json({ 
        folders, 
        fallback: true,
        model: 'static-fallback'
      });
    }

  } catch (error) {
    console.error('[organize] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate organization suggestions' },
      { status: 500 }
    );
  }
}

// Fallback suggestion generator (static - no AI)
function generateFallbackSuggestions(files: FileInfo[], basePath: string): FolderSuggestion[] {
  const folders: FolderSuggestion[] = [];
  const usedFileIds = new Set<string>();

  // Strategy 1: Group by date patterns in filenames
  const datePatternFiles: Record<string, string[]> = {};
  const dateRegex = /(\d{4})[-_]?(\d{2})[-_]?(\d{2})?/;
  
  files.forEach(f => {
    const match = f.name.match(dateRegex);
    if (match) {
      const yearMonth = `${match[1]}-${match[2]}`;
      if (!datePatternFiles[yearMonth]) datePatternFiles[yearMonth] = [];
      datePatternFiles[yearMonth].push(f.id);
    }
  });

  // Add date-based folders if they have enough files
  Object.entries(datePatternFiles)
    .filter(([_, ids]) => ids.length >= 3)
    .sort((a, b) => b[0].localeCompare(a[0])) // Newest first
    .slice(0, 3) // Max 3 date folders
    .forEach(([yearMonth, ids]) => {
      folders.push({
        name: yearMonth,
        path: `${basePath}/${yearMonth}`,
        reason: `Files from ${yearMonth}`,
        fileIds: ids,
      });
      ids.forEach(id => usedFileIds.add(id));
    });

  // Strategy 2: Group by category
  const categoryGroups: Record<string, string[]> = {};
  
  files.forEach(f => {
    if (!usedFileIds.has(f.id)) {
      if (!categoryGroups[f.category]) categoryGroups[f.category] = [];
      categoryGroups[f.category].push(f.id);
    }
  });

  Object.entries(categoryGroups)
    .filter(([_, ids]) => ids.length > 0)
    .forEach(([category, ids]) => {
      folders.push({
        name: category,
        path: `${basePath}/${category}`,
        reason: `All ${category.toLowerCase()} files`,
        fileIds: ids,
      });
    });

  // Strategy 3: Look for common prefixes
  const prefixGroups: Record<string, string[]> = {};
  const remainingFiles = files.filter(f => !usedFileIds.has(f.id));
  
  remainingFiles.forEach(f => {
    const prefix = f.name.split(/[-_\s.]/)[0];
    if (prefix.length >= 3 && prefix.length <= 20) {
      if (!prefixGroups[prefix]) prefixGroups[prefix] = [];
      prefixGroups[prefix].push(f.id);
    }
  });

  // Add prefix-based folders if they have 3+ files
  Object.entries(prefixGroups)
    .filter(([_, ids]) => ids.length >= 3)
    .slice(0, 3)
    .forEach(([prefix, ids]) => {
      // Check if these files aren't already in a folder
      const newIds = ids.filter(id => !folders.some(f => f.fileIds.includes(id)));
      if (newIds.length >= 3) {
        folders.push({
          name: `${prefix} Files`,
          path: `${basePath}/${prefix}_Files`,
          reason: `Files starting with "${prefix}"`,
          fileIds: newIds,
        });
      }
    });

  return folders;
}
