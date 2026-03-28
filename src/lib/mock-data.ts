import { FileNode, Suggestion, ScanStats } from "@/types";

// Mock data generator
const SAMPLE_FILES: FileNode[] = [
  {
    id: "f1",
    name: "INV_2023_001.pdf",
    path: "/Documents/Invoices/INV_2023_001.pdf",
    size: 1024 * 450,
    lastModified: Date.now() - 10000000,
    type: "document",
    extension: "pdf",
    category: "Finance",
    tags: ["invoice", "2023"],
  },
  {
    id: "f2",
    name: "screenshot_234234.png",
    path: "/Downloads/screenshot_234234.png",
    size: 1024 * 2500,
    lastModified: Date.now() - 500000,
    type: "image",
    extension: "png",
    category: "Screenshots",
    tags: ["screenshot"],
  },
  {
    id: "f3",
    name: "Project Alpha_v2_FINAL.docx",
    path: "/Desktop/Project Alpha_v2_FINAL.docx",
    size: 1024 * 1200,
    lastModified: Date.now() - 2000000,
    type: "document",
    extension: "docx",
    category: "Work",
    tags: ["project", "alpha"],
  },
  {
    id: "f4",
    name: "Project Alpha_v2_FINAL (1).docx",
    path: "/Downloads/Project Alpha_v2_FINAL (1).docx",
    size: 1024 * 1200,
    lastModified: Date.now() - 100000,
    type: "document",
    extension: "docx",
    category: "Work",
    tags: ["project", "alpha", "duplicate"],
  },
  {
    id: "f5",
    name: "img_0023.jpg",
    path: "/Photos/2023/img_0023.jpg",
    size: 1024 * 3200,
    lastModified: Date.now() - 50000000,
    type: "image",
    extension: "jpg",
    category: "Photos",
    tags: ["photo"],
  },
];

const SAMPLE_SUGGESTIONS: Suggestion[] = [
  {
    id: "s1",
    fileId: "f2",
    originalFile: SAMPLE_FILES[1],
    action: "rename",
    proposedName: "2024-01-15_Screenshot_Dashboard.png",
    reason: "Standardized timestamp naming",
    confidence: "high",
    status: "pending",
  },
  {
    id: "s2",
    fileId: "f4",
    originalFile: SAMPLE_FILES[3],
    action: "delete",
    reason: "Exact duplicate of /Desktop/Project Alpha_v2_FINAL.docx",
    confidence: "high",
    status: "pending",
  },
  {
    id: "s3",
    fileId: "f5",
    originalFile: SAMPLE_FILES[4],
    action: "move",
    proposedPath: "/Photos/2023/Vacation/img_0023.jpg",
    reason: "Group by date proximity",
    confidence: "medium",
    status: "pending",
  },
];

export const MOCK_DATA = {
  files: SAMPLE_FILES,
  suggestions: SAMPLE_SUGGESTIONS,
  stats: {
    totalFiles: 1243,
    totalSize: 1024 * 1024 * 1024 * 5.2, // 5.2 GB
    duplicatesFound: 12,
    suggestionsCount: 45,
    lastScanDate: new Date().toISOString(),
  } as ScanStats
};
