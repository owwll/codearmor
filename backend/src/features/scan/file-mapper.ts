import fg from 'fast-glob';
import * as path from 'path';
import * as fs from 'fs';
import { FileMap } from '../../types/agent.types';
import { logger } from '../../utils/logger';

/**
 * Scans the project directory and categorizes files into specific security scanning domains.
 */
export async function buildFileMap(projectPath: string): Promise<FileMap> {
  const resolvedRoot = path.resolve(projectPath);

  const options = {
    cwd: resolvedRoot,
    absolute: true,
    ignore: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.git/**',
      '**/coverage/**',
      '**/*.test.{js,ts}',
      '**/*.spec.{js,ts}',
      '**/*.min.js',
    ],
  };

  // 1. Define glob patterns for each category
  const routePatterns = [
    'routes/**/*.{js,ts}',
    'src/routes/**/*.{js,ts}',
    'api/**/*.{js,ts}',
    'src/api/**/*.{js,ts}',
    'controllers/**/*.{js,ts}',
    'src/controllers/**/*.{js,ts}',
    'pages/api/**/*.{js,ts}',
    'app.{js,ts}',
    'server.{js,ts}',
    'index.{js,ts}',
    'src/app.{js,ts}',
    'src/server.{js,ts}',
    'src/index.{js,ts}',
  ];

  const authPatterns = [
    'middleware/auth*.{js,ts}',
    'src/middleware/auth*.{js,ts}',
    'auth/**/*.{js,ts}',
    'src/auth/**/*.{js,ts}',
    'utils/jwt*.{js,ts}',
    'utils/auth*.{js,ts}',
    'services/auth*.{js,ts}',
    'services/user*.{js,ts}',
    'helpers/auth*.{js,ts}',
  ];

  const modelPatterns = [
    'models/**/*.{js,ts}',
    'src/models/**/*.{js,ts}',
    'schemas/**/*.{js,ts}',
    'entities/**/*.{js,ts}',
  ];

  const configPatterns = [
    'package.json', // root package.json only
    'config/**/*.{js,ts,json}',
    '.env.example',
    '.env.production',
    '.env.staging',
    'src/config/**',
    '*.config.{js,ts}',
  ];

  const viewPatterns = [
    'views/**/*.{ejs,pug,hbs,html}',
    'templates/**/*.{html,ejs,pug}',
    'public/**/*.html',
  ];

  const sourcePatterns = ['**/*.{js,ts}'];

  // 2. Execute globs in parallel
  const [
    rawRoutes,
    rawAuth,
    rawModels,
    rawConfigs,
    rawViews,
    rawSources,
  ] = await Promise.all([
    fg(routePatterns, options),
    fg(authPatterns, options),
    fg(modelPatterns, options),
    fg(configPatterns, options),
    fg(viewPatterns, options),
    fg(sourcePatterns, options),
  ]);

  // 3. Look for package.json at root level only
  const packageJsonPath = path.join(resolvedRoot, 'package.json');
  const packageJson = fs.existsSync(packageJsonPath) ? packageJsonPath : undefined;

  // 4. De-duplicate each category
  const routeFiles = Array.from(new Set(rawRoutes)).sort();
  const authFiles = Array.from(new Set(rawAuth)).sort();
  const modelFiles = Array.from(new Set(rawModels)).sort();
  const configFiles = Array.from(new Set(rawConfigs)).sort();
  const viewFiles = Array.from(new Set(rawViews)).sort();
  const sourceFiles = Array.from(new Set(rawSources)).sort();

  // Ensure package.json is in configFiles if found
  if (packageJson && !configFiles.includes(packageJson)) {
    configFiles.push(packageJson);
    configFiles.sort();
  }

  // 5. Build unique union of all matched files
  const allFiles = Array.from(
    new Set([
      ...routeFiles,
      ...authFiles,
      ...modelFiles,
      ...configFiles,
      ...viewFiles,
      ...sourceFiles,
    ])
  ).sort();

  const totalCount = allFiles.length;

  logger.info(
    'FileMapper',
    `Found ${totalCount} files: ${routeFiles.length} route, ${authFiles.length} auth, ${sourceFiles.length} source, ${configFiles.length} config, ${viewFiles.length} view`
  );

  return {
    rootPath: resolvedRoot,
    allFiles,
    routeFiles,
    authFiles,
    sourceFiles,
    configFiles,
    controllerFiles: routeFiles.filter((f) => f.includes('controller')), // helper separation
    modelFiles,
    viewFiles,
    packageJson,
    totalCount,
  };
}

/**
 * Detects the project programming language based on file extensions.
 */
export function detectProjectLanguage(fileMap: FileMap): string {
  let tsCount = 0;
  let jsCount = 0;
  let pyCount = 0;

  for (const file of fileMap.allFiles) {
    const ext = path.extname(file).toLowerCase();
    if (['.ts', '.tsx'].includes(ext)) {
      tsCount++;
    } else if (['.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
      jsCount++;
    } else if (ext === '.py') {
      pyCount++;
    }
  }

  if (pyCount > jsCount && pyCount > tsCount) return 'python';
  if (tsCount > jsCount) return 'typescript';
  return 'javascript';
}

/**
 * Detects the framework of the scanned project based on package.json dependencies.
 */
export function detectFramework(fileMap: FileMap, rootPath: string): string {
  const pkgPath = fileMap.packageJson || path.join(rootPath, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    return 'unknown';
  }

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    if (deps['next']) return 'nextjs';
    if (deps['@nestjs/core']) return 'nestjs';
    if (deps['express']) return 'express';
    if (deps['fastify']) return 'fastify';
    if (deps['koa']) return 'koa';
  } catch (err) {
    logger.error('FileMapper', 'Failed to parse package.json for framework detection', err);
  }

  return 'unknown';
}
