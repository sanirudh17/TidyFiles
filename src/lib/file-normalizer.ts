export interface NormalizedFile {
  path: string;
  relativePath: string;
  name: string;
  extension: string;
  size: number;
  mtime: number;
  parentFolder: string;
  isRootFile: boolean;
  isProtected: boolean;
}

function getExtension(name: string) {
  const idx = name.lastIndexOf(".");
  return idx === -1 ? "" : name.slice(idx + 1).toLowerCase();
}

function getParentFolder(relativePath: string) {
  const parts = relativePath.split(/[\\/]/).filter(Boolean);
  if (parts.length <= 1) return "Root";
  return parts[parts.length - 2];
}

export function normalizeFiles(files: any[], rootPath: string): NormalizedFile[] {
  return files
    .filter(Boolean)
    .map((file) => {
      const fullPath = String(file.path || "");
      const relativePath = fullPath.startsWith(rootPath)
        ? fullPath.slice(rootPath.length).replace(/^[/\\]+/, "")
        : fullPath;

      return {
        path: fullPath,
        relativePath,
        name: String(file.name || ""),
        extension: getExtension(String(file.name || "")),
        size: Number(file.size || 0),
        mtime: new Date(file.mtime || file.modifiedAt || 0).getTime(),
        parentFolder: getParentFolder(relativePath),
        isRootFile: !relativePath.includes("\\") && !relativePath.includes("/"),
        isProtected: Boolean(file.isProtected || false),
      };
    })
    .sort((a, b) =>
      a.relativePath.localeCompare(b.relativePath) ||
      a.name.localeCompare(b.name) ||
      a.extension.localeCompare(b.extension) ||
      a.size - b.size ||
      a.mtime - b.mtime
    );
}
