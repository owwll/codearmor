import * as fs from 'fs';
import * as path from 'path';

export interface SafeFileReadResult {
  content: string;
  lineCount: number;
  sizeKb: number;
}

export interface ChunkedContentResult {
  chunks: string[];
  isChunked: boolean;
  totalChars: number;
}

/**
 * Reads a file safely, preventing path traversal and checking file limits.
 */
export function readFileSafe(filePath: string, projectRootPath: string): SafeFileReadResult {
  const resolvedRoot = path.resolve(projectRootPath);
  const resolvedPath = path.resolve(filePath);

  // 1. Path traversal prevention: ensure the path is within the project root
  if (!resolvedPath.startsWith(resolvedRoot)) {
    throw new Error('Access denied: Path is outside the project root directory.');
  }

  // Check if file exists
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const stat = fs.statSync(resolvedPath);
  if (!stat.isFile()) {
    throw new Error(`Path is not a file: ${filePath}`);
  }

  // 2. Size limit validation
  const maxFileSizeKb = parseInt(process.env.MAX_FILE_SIZE_KB || '500', 10);
  const sizeKb = stat.size / 1024;
  if (sizeKb > maxFileSizeKb) {
    throw new Error(`File exceeds maximum size limit of ${maxFileSizeKb}KB (size: ${sizeKb.toFixed(2)}KB).`);
  }

  // 3. Binary detection (check first 1000 bytes for null bytes)
  const fd = fs.openSync(resolvedPath, 'r');
  const buffer = Buffer.alloc(1000);
  const bytesRead = fs.readSync(fd, buffer, 0, Math.min(1000, stat.size), 0);
  fs.closeSync(fd);

  for (let i = 0; i < bytesRead; i++) {
    if (buffer[i] === 0) {
      throw new Error('Access denied: Binary files are not supported.');
    }
  }

  // 4. Read file content
  const content = fs.readFileSync(resolvedPath, 'utf8');
  const lineCount = content.split(/\r?\n/).length;

  return {
    content,
    lineCount,
    sizeKb,
  };
}

/**
 * Chunks text content into overlapping segments if it exceeds a certain threshold.
 */
export function chunkContent(
  content: string,
  chunkSize: number = 2500,
  overlap: number = 500
): ChunkedContentResult {
  const totalChars = content.length;

  // Only chunk if content exceeds 3000 characters
  if (totalChars <= 3000) {
    return {
      chunks: [content],
      isChunked: false,
      totalChars,
    };
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < totalChars) {
    const end = Math.min(start + chunkSize, totalChars);
    chunks.push(content.substring(start, end));
    
    if (end === totalChars) {
      break;
    }
    
    start += (chunkSize - overlap);
  }

  return {
    chunks,
    isChunked: true,
    totalChars,
  };
}
