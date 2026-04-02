/**
 * TidyFiles Gemini client.
 *
 * Uses currently supported Gemini model IDs so deployed analysis keeps working.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = process.env.GEMINI_API_KEY || '';

export const GEMINI_MODELS = {
  PRIMARY: 'gemini-3-pro-preview',
  FALLBACK: 'gemini-3-flash-preview',
  VISION: 'gemini-3-flash-preview',
};

const MODELS = {
  FILE_PRO: GEMINI_MODELS.PRIMARY,
  CHAT_FLASH_LITE: GEMINI_MODELS.FALLBACK,
};

interface GeminiResponse {
  success: boolean;
  model: string;
  response: string;
  fallbackUsed?: boolean;
}

interface FileInfo {
  id: string;
  name: string;
  path: string;
  size: number;
  category: string;
  extension?: string;
}

interface FolderContext {
  rootFolder: string;
  totalFiles: number;
  totalSize: number;
  categories: Record<string, { count: number; size: number }>;
  sampleFiles: Array<{ name: string; category: string; size: number }>;
}

export class TidyFilesGemini {
  private client: GoogleGenerativeAI;

  constructor() {
    this.client = new GoogleGenerativeAI(API_KEY);
  }

  async chat(query: string, context: FolderContext): Promise<GeminiResponse> {
    const formatSize = (bytes: number): string => {
      const units = ['B', 'KB', 'MB', 'GB'];
      let size = bytes;
      let unitIndex = 0;
      while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
      }
      return `${size.toFixed(1)} ${units[unitIndex]}`;
    };

    const prompt = `TidyFiles AI Chat Assistant (${MODELS.CHAT_FLASH_LITE})

FOLDER: ${context.rootFolder}
STATS: ${context.totalFiles} files, ${formatSize(context.totalSize)}
CATEGORIES: ${Object.entries(context.categories || {})
  .map(([k, v]) => `${k}: ${v.count}`)
  .join(', ')}

RECENT FILES: ${context.sampleFiles?.slice(0, 8).map(f => f.name).join(', ') || 'None'}

USER: ${query}

Answer helpfully about these files. Mention specific filenames when relevant. Be concise.`;

    try {
      const model = this.client.getGenerativeModel({
        model: MODELS.CHAT_FLASH_LITE,
        generationConfig: {
          temperature: 0.3,
          topK: 32,
          topP: 0.95,
          maxOutputTokens: 1024
        }
      });
      
      console.log(`[Gemini Chat] Using ${MODELS.CHAT_FLASH_LITE}`);
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      
      console.log('[Gemini Chat] Success');
      return { success: true, model: MODELS.CHAT_FLASH_LITE, response: text };
    } catch (error: any) {
      console.error('Chat Error:', error.message);
      return { 
        success: false, 
        model: MODELS.CHAT_FLASH_LITE, 
        response: `Chat unavailable: ${error.message}. Try "list PDFs" or "large files".` 
      };
    }
  }

  async exportSummary(scanData: any): Promise<string> {
    const formatSize = (bytes: number): string => {
      const units = ['B', 'KB', 'MB', 'GB'];
      let size = bytes;
      let unitIndex = 0;
      while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
      }
      return `${size.toFixed(1)} ${units[unitIndex]}`;
    };

    const prompt = `TidyFiles Export Summary Report (${MODELS.CHAT_FLASH_LITE})

SCAN RESULTS:
- ${scanData.totalFiles || 0} files
- ${formatSize(scanData.totalSize || 0)}
- Categories: ${Object.entries(scanData.categories || {})
  .map(([k, v]) => `${k} (${v})`)
  .join(', ')}

SUGGESTIONS: ${scanData.suggestions?.length || 0}

Generate a concise 3-paragraph professional summary for the user. Include key stats and 1-2 actionable recommendations.`;

    try {
      const model = this.client.getGenerativeModel({
        model: MODELS.CHAT_FLASH_LITE,
        generationConfig: { 
          temperature: 0.1,
          maxOutputTokens: 512 
        }
      });
      
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error: any) {
      return `Summary unavailable. Scan: ${scanData.totalFiles} files.`;
    }
  }

  async organizeFiles(files: FileInfo[], basePath: string): Promise<GeminiResponse> {
    const fileSummary = files.slice(0, 500).map(f => ({
      id: f.id,
      name: f.name,
      ext: f.extension || f.name.split('.').pop() || '',
      size: f.size,
      category: f.category,
    }));

    const categoryStats: Record<string, number> = {};
    files.forEach(f => {
      categoryStats[f.category] = (categoryStats[f.category] || 0) + 1;
    });

    const prompt = `Analyze ${files.length} Windows files for optimal file organization into grouped folders.

FILES TO ORGANIZE:
${JSON.stringify(fileSummary, null, 2)}
${files.length > 500 ? `\n... and ${files.length - 500} more files` : ''}

CATEGORY BREAKDOWN:
${Object.entries(categoryStats).map(([cat, count]) => `- ${cat}: ${count} files`).join('\n')}

BASE PATH: ${basePath}

CRITICAL RULES FOR FOLDER NAMES:
- Be EXTREMELY SPECIFIC. Do NOT use generic names like "Documents", "Images", "Code", or "Other".
- Deduce the actual topics, projects, subjects, contexts, or clients from the filenames.
- e.g., Instead of "2026-01-Assignments", use "Physics-Mechanics-Assignments" if files are physics assignments.
- e.g., Instead of "React Code", use "NextJS-Auth-Components".
- You can create from 3 to 20 highly specific folders if needed to accurately group the files.
- Each file must go into exactly ONE folder.

RESPOND WITH ONLY VALID JSON:
{
  "folders": [
    {
      "name": "FolderName",
      "reasoning": "Why these files belong together",
      "fileIds": ["id1", "id2"]
    }
  ],
  "unassigned": ["id3", "id4"]
}`;

    const generationConfig = {
      temperature: 0.1,
      topK: 32,
      topP: 0.95,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json' as const,
    };

    try {
      const model = this.client.getGenerativeModel({
        model: MODELS.FILE_PRO,
        generationConfig,
      });

      console.log(`[Gemini Organize] Using ${MODELS.FILE_PRO}`);
      const result = await model.generateContent(prompt);
      const text = result.response.text();

      console.log('[Gemini Organize] Success');
      return { success: true, model: MODELS.FILE_PRO, response: text };
    } catch (error: any) {
      console.warn(`[Gemini Organize] ${MODELS.FILE_PRO} failed: ${error.message}`);

      try {
        const fallbackModel = this.client.getGenerativeModel({
          model: MODELS.CHAT_FLASH_LITE,
          generationConfig,
        });

        console.log(`[Gemini Organize] Falling back to ${MODELS.CHAT_FLASH_LITE}`);
        const fallbackResult = await fallbackModel.generateContent(prompt);
        const fallbackText = fallbackResult.response.text();

        console.log('[Gemini Organize] Fallback success');
        return {
          success: true,
          model: MODELS.CHAT_FLASH_LITE,
          response: fallbackText,
          fallbackUsed: true,
        };
      } catch (fallbackError: any) {
        console.error('Organize Error:', fallbackError.message);
        return { 
          success: false, 
          model: MODELS.FILE_PRO, 
          response: JSON.stringify({
            folders: [
              { name: 'Documents', reasoning: 'General documents', fileIds: [] },
              { name: 'Code', reasoning: 'Source code', fileIds: [] },
            ],
            unassigned: [],
          }),
          fallbackUsed: true,
        };
      }
    }
  }

  async analyzeFiles(files: FileInfo[], settings: object): Promise<GeminiResponse> {
    const fileList = files.slice(0, 50).map(f => ({
      id: f.id,
      name: f.name,
      category: f.category,
      size: f.size,
    }));

    const prompt = `Analyze these files and suggest improvements.

FILES:
${JSON.stringify(fileList, null, 2)}

SETTINGS:
${JSON.stringify(settings, null, 2)}

For each file that needs action, suggest:
- rename: if name is messy/unclear
- delete: if appears to be duplicate or temp file
- move: if in wrong location

JSON response:
{
  "suggestions": [
    {
      "fileId": "...",
      "action": "rename|delete|move",
      "newName": "...",
      "reason": "...",
      "confidence": 0.0-1.0
    }
  ]
}`;

    const generationConfig = {
      temperature: 0.1,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json' as const,
    };

    try {
      const model = this.client.getGenerativeModel({
        model: MODELS.FILE_PRO,
        generationConfig,
      });

      console.log(`[Gemini Analyze] Using ${MODELS.FILE_PRO}`);
      const result = await model.generateContent(prompt);
      const text = result.response.text();

      return { success: true, model: MODELS.FILE_PRO, response: text };
    } catch (error: any) {
      console.warn(`[Gemini Analyze] ${MODELS.FILE_PRO} failed: ${error.message}`);

      try {
        const fallbackModel = this.client.getGenerativeModel({
          model: MODELS.CHAT_FLASH_LITE,
          generationConfig,
        });

        console.log(`[Gemini Analyze] Falling back to ${MODELS.CHAT_FLASH_LITE}`);
        const fallbackResult = await fallbackModel.generateContent(prompt);
        const fallbackText = fallbackResult.response.text();

        return {
          success: true,
          model: MODELS.CHAT_FLASH_LITE,
          response: fallbackText,
          fallbackUsed: true,
        };
      } catch (fallbackError: any) {
        console.error('Analyze Error:', fallbackError.message);
        return { 
          success: false, 
          model: MODELS.FILE_PRO, 
          response: JSON.stringify({ suggestions: [] }),
          fallbackUsed: true,
        };
      }
    }
  }
}

export const geminiChat = new TidyFilesGemini();
export const geminiFile = new TidyFilesGemini();

// Deterministic analysis exports
export const ANALYSIS_MODEL = GEMINI_MODELS.PRIMARY;
export const VISION_MODEL = GEMINI_MODELS.VISION;

export const ANALYSIS_CONFIG = {
  temperature: 0,
  topP: 1,
  topK: 1,
  maxOutputTokens: 2048,
};

export function buildDeterministicAnalysisPrompt(files: any[], settings: any) {
  return `
You are TidyFiles deterministic analysis engine.

Return STRICT JSON only.
No markdown.
No commentary.
No prose outside JSON.

Rules:
1. Use only the given files.
2. Do not invent filenames.
3. preserve ordering based on input order.
4. Be conservative and repeatable.
5. If unsure, leave item unchanged.

Settings:
${JSON.stringify(settings)}

Output schema:
{
  "renames": [
    {
      "originalPath": "string",
      "proposedName": "string",
      "reason": "string"
    }
  ],
  "moves": [
    {
      "originalPath": "string",
      "targetFolder": "string",
      "reason": "string"
    }
  ],
  "deletes": [
    {
      "originalPath": "string",
      "reason": "string"
    }
  ],
  "protected": [
    {
      "originalPath": "string",
      "reason": "string"
    }
  ]
}

Files:
${JSON.stringify(files)}
`;
}

export function safeParseAnalysis(text: string) {
  try {
    const parsed = JSON.parse(text);
    return {
      renames: Array.isArray(parsed.renames) ? parsed.renames : [],
      moves: Array.isArray(parsed.moves) ? parsed.moves : [],
      deletes: Array.isArray(parsed.deletes) ? parsed.deletes : [],
      protected: Array.isArray(parsed.protected) ? parsed.protected : [],
    };
  } catch {
    return { renames: [], moves: [], deletes: [], protected: [] };
  }
}
