import crypto from "crypto";
import type { NormalizedFile } from "./file-normalizer";
import type { NamingSettings } from "./settings";

export interface AnalysisCacheMeta {
  rootPath: string;
  filesHash: string;
  settingsHash: string;
  model: string;
  promptVersion: string;
  analysisVersion: string;
}

export function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function computeFilesHash(files: NormalizedFile[]) {
  return sha256(JSON.stringify(
    files.map(f => ({
      relativePath: f.relativePath,
      size: f.size,
      mtime: f.mtime,
      extension: f.extension
    }))
  ));
}

export function computeSettingsHash(settings: NamingSettings) {
  return sha256(JSON.stringify(settings));
}

export function buildAnalysisCacheKey(meta: AnalysisCacheMeta) {
  return sha256(JSON.stringify(meta));
}
