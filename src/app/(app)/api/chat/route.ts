import { NextRequest, NextResponse } from 'next/server';
import { geminiChat } from '@/lib/gemini';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface FolderContext {
  rootFolder: string;
  totalFiles: number;
  totalSize: number;
  categories: Record<string, { count: number; size: number }>;
  sampleFiles: Array<{ name: string; path: string; category: string; size: number }>;
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

function getFallbackResponse(query: string, context: FolderContext): { message: string; actions: Array<{ type: string; label: string; data?: Record<string, unknown> }> } {
  const lowerQuery = query.toLowerCase();
  const actions: Array<{ type: string; label: string; data?: Record<string, unknown> }> = [];

  if (lowerQuery.includes('recent') || lowerQuery.includes('latest')) {
    const recentFiles = context.sampleFiles.slice(0, 5);
    if (recentFiles.length > 0) {
      const fileList = recentFiles.map(f => `- ${f.name} (${f.category})`).join('\n');
      return {
        message: `Here are your most recent files:\n\n${fileList}`,
        actions: [{ type: 'navigate', label: 'View in Results', data: { path: '/results' } }],
      };
    }
  }

  if (lowerQuery.includes('summary') || lowerQuery.includes('overview')) {
    const categories = Object.entries(context.categories)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5);
    
    if (categories.length > 0) {
      const categoryList = categories
        .map(([name, data]) => `- ${name}: ${data.count} files (${formatSize(data.size)})`)
        .join('\n');
      
      return {
        message: `Folder Summary:\n\n**${context.rootFolder}**\nTotal: ${context.totalFiles} files (${formatSize(context.totalSize)})\n\nTop categories:\n${categoryList}`,
        actions: [{ type: 'navigate', label: 'View Details', data: { path: '/results' } }],
      };
    }
  }

  if (lowerQuery.includes('large') || lowerQuery.includes('biggest') || lowerQuery.includes('space')) {
    const largeFiles = [...context.sampleFiles]
      .sort((a, b) => b.size - a.size)
      .slice(0, 5);
    
    if (largeFiles.length > 0) {
      const fileList = largeFiles.map(f => `- ${f.name} (${formatSize(f.size)})`).join('\n');
      return {
        message: `Largest files in your folder:\n\n${fileList}\n\nConsider archiving or removing unused large files to free up space.`,
        actions: [{ type: 'navigate', label: 'View Suggestions', data: { path: '/suggestions' } }],
      };
    }
  }

  if (lowerQuery.includes('duplicate')) {
    return {
      message: `To find duplicate files, check the Suggestions page. TidyFiles identifies duplicates using file hashes and will suggest which copies to remove.`,
      actions: [{ type: 'navigate', label: 'View Suggestions', data: { path: '/suggestions' } }],
    };
  }

  if (lowerQuery.includes('clean') || lowerQuery.includes('organize')) {
    return {
      message: `Here's how to clean up your folder:\n\n1. Review AI suggestions for renames and duplicates\n2. Approve changes you want to apply\n3. Use "Review & Approve" to batch apply\n\nTip: Start with high-confidence suggestions first.`,
      actions: [{ type: 'navigate', label: 'View Suggestions', data: { path: '/suggestions' } }],
    };
  }

  return {
    message: `I found ${context.totalFiles} files across ${Object.keys(context.categories).length} categories in your folder.\n\nI can help you:\n- Summarize folder contents\n- Find large files\n- Identify duplicates\n- Suggest cleanup actions\n\nTry asking about specific file types or cleanup tasks!`,
    actions: context.totalFiles > 0 ? [{ type: 'navigate', label: 'View Results', data: { path: '/results' } }] : [],
  };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { messages, context } = await request.json() as {
      messages: ChatMessage[];
      context: FolderContext;
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'No messages provided' }, { status: 400 });
    }

    const lastMessage = messages[messages.length - 1];
    console.log('[Chat API] Query:', lastMessage.content.substring(0, 50));
    console.log('[Chat API] Using Gemini 3.1 Flash-Lite for chat');

    const result = await geminiChat.chat(lastMessage.content, context);
    
    console.log(`[Chat API] Response received in ${Date.now() - startTime}ms, model: ${result.model}`);

    const actions: Array<{ type: string; label: string; data?: Record<string, unknown> }> = [];
    const lowerText = result.response.toLowerCase();

    if (lowerText.includes('suggestion') || lowerText.includes('recommend')) {
      actions.push({ type: 'navigate', label: 'View Suggestions', data: { path: '/suggestions' } });
    }
    if (lowerText.includes('result') || lowerText.includes('overview')) {
      actions.push({ type: 'navigate', label: 'View Results', data: { path: '/results' } });
    }
    if (lowerText.includes('explorer') || lowerText.includes('open folder')) {
      actions.push({ type: 'openFolder', label: 'Open in Explorer', data: { path: context.rootFolder } });
    }

    return NextResponse.json({
      message: result.response,
      actions,
      fallback: !result.success,
      model: result.model,
    });

  } catch (error: any) {
    console.error('[Chat API] Error:', error.message);

    if (error.message.includes('quota') || error.message.includes('rate')) {
      return NextResponse.json({
        message: 'API rate limit reached. Please try again in a moment.',
        actions: [],
        fallback: true,
        error: 'RATE_LIMIT',
        model: 'error',
      });
    }

    return NextResponse.json({ 
      message: 'Sorry, I encountered an error. Please try again.',
      actions: [],
      fallback: true,
      error: error.message,
      model: 'error',
    });
  }
}
