const fs = require('fs');
const path = require('path');
const { defaultRegistry } = require('../../languages/LanguageAdapterRegistry');

// Default directory and file patterns to ignore
const DEFAULT_IGNORES = [
  '.git',
  'node_modules',
  'dist',
  'build',
  'out',
  'target',
  'bin',
  'obj',
  '.next',
  '.nuxt',
  'coverage',
  '.idea',
  '.vscode',
  'vendor',
  '__pycache__',
  '.pytest_cache',
  '.venv',
  'venv',
  'env',
  '.tox',
  '.eggs',
  '*.egg-info',
  '.retrospect',
  '.gemini',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml'
];

class RepoDiscoverer {
  constructor(options = {}) {
    this.registry = options.registry || defaultRegistry;
    this.maxFileSize = options.maxFileSize || 1024 * 1024; // 1MB default
    this.maxFiles = options.maxFiles || 10000;
    this.extraIgnores = Array.isArray(options.excludePatterns) ? options.excludePatterns : [];
    this.supportedExtensions = options.supportedExtensions || null; // null = use registry
  }

  /**
   * Discover all supported source files in the given repository path.
   * @param {string} repoPath 
   * @returns {Promise<{ files: Array<object>, stats: object }>}
   */
  async discover(repoPath) {
    if (!repoPath) {
      throw new Error('RepoDiscoverer: repoPath is required');
    }

    const resolvedRoot = path.resolve(repoPath);
    if (!fs.existsSync(resolvedRoot)) {
      throw new Error(`RepoDiscoverer: repository path does not exist: '${resolvedRoot}'`);
    }

    const rootStat = fs.statSync(resolvedRoot);
    if (!rootStat.isDirectory()) {
      throw new Error(`RepoDiscoverer: repository path must be a directory: '${resolvedRoot}'`);
    }

    const stats = {
      totalScanned: 0,
      totalDiscovered: 0,
      skippedIgnored: 0,
      skippedSize: 0,
      skippedUnreadable: 0
    };

    const discoveredFiles = [];
    const gitignoreMatchers = this._loadGitignoreMatchers(resolvedRoot);

    // Breadth-first or stack-based traversal avoiding symlink loops
    const stack = [resolvedRoot];
    const visitedRealPaths = new Set([fs.realpathSync(resolvedRoot)]);

    while (stack.length > 0) {
      if (discoveredFiles.length >= this.maxFiles) {
        break;
      }

      const currentDir = stack.pop();

      let entries;
      try {
        entries = fs.readdirSync(currentDir, { withFileTypes: true });
      } catch (err) {
        stats.skippedUnreadable++;
        continue;
      }

      // Check if current directory has its own .gitignore to append
      const localGitignore = path.join(currentDir, '.gitignore');
      if (currentDir !== resolvedRoot && fs.existsSync(localGitignore)) {
        try {
          const content = fs.readFileSync(localGitignore, 'utf-8');
          const localMatchers = this._parseGitignoreContent(content, currentDir, resolvedRoot);
          gitignoreMatchers.push(...localMatchers);
        } catch (e) {
          // ignore
        }
      }

      for (const entry of entries) {
        stats.totalScanned++;
        const fullPath = path.join(currentDir, entry.name);
        const relPath = path.relative(resolvedRoot, fullPath).replace(/\\/g, '/');

        // Check symlinks to prevent loops
        if (entry.isSymbolicLink()) {
          try {
            const real = fs.realpathSync(fullPath);
            if (visitedRealPaths.has(real) || !real.startsWith(resolvedRoot)) {
              // Avoid symlinks pointing outside repo or back to visited dirs
              stats.skippedIgnored++;
              continue;
            }
          } catch (e) {
            stats.skippedIgnored++;
            continue;
          }
        }

        // Check if directory / file matches ignore patterns
        if (this._isIgnored(entry.name, relPath, entry.isDirectory(), gitignoreMatchers)) {
          stats.skippedIgnored++;
          continue;
        }

        if (entry.isDirectory()) {
          try {
            const real = fs.realpathSync(fullPath);
            if (!visitedRealPaths.has(real)) {
              visitedRealPaths.add(real);
              stack.push(fullPath);
            }
          } catch (e) {
            stats.skippedUnreadable++;
          }
        } else if (entry.isFile()) {
          // Check extension
          const adapter = this.registry.getAdapterForFile(entry.name);
          if (!adapter) {
            continue;
          }

          if (this.supportedExtensions && !this.supportedExtensions.some(ext => entry.name.endsWith(ext))) {
            continue;
          }

          // Check file size
          let fileStat;
          try {
            fileStat = fs.statSync(fullPath);
          } catch (e) {
            stats.skippedUnreadable++;
            continue;
          }

          if (fileStat.size > this.maxFileSize) {
            stats.skippedSize++;
            continue;
          }

          discoveredFiles.push({
            filePath: fullPath,
            relativePath: relPath,
            fileName: entry.name,
            size: fileStat.size,
            mtimeMs: fileStat.mtimeMs,
            language: adapter.getLanguageId()
          });

          stats.totalDiscovered++;
          if (discoveredFiles.length >= this.maxFiles) {
            break;
          }
        }
      }
    }

    return {
      files: discoveredFiles,
      stats
    };
  }

  _isIgnored(name, relPath, isDir, gitignoreMatchers) {
    // Check built-in and extra ignores
    const allIgnores = [...DEFAULT_IGNORES, ...this.extraIgnores];
    for (const pat of allIgnores) {
      if (pat.startsWith('*.')) {
        const ext = pat.slice(1);
        if (name.endsWith(ext)) return true;
      } else if (name === pat || relPath === pat || relPath.startsWith(`${pat}/`)) {
        return true;
      }
    }

    // Check gitignore matchers
    for (const matcher of gitignoreMatchers) {
      if (matcher(relPath, isDir)) {
        return true;
      }
    }

    return false;
  }

  _loadGitignoreMatchers(rootPath) {
    const matchers = [];
    const rootGitignore = path.join(rootPath, '.gitignore');
    if (fs.existsSync(rootGitignore)) {
      try {
        const content = fs.readFileSync(rootGitignore, 'utf-8');
        matchers.push(...this._parseGitignoreContent(content, rootPath, rootPath));
      } catch (e) {
        // ignore
      }
    }
    return matchers;
  }

  _parseGitignoreContent(content, baseDir, repoRoot) {
    const matchers = [];
    const lines = content.split(/\r?\n/);
    const relBase = path.relative(repoRoot, baseDir).replace(/\\/g, '/');

    for (let rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      const isDirOnly = line.endsWith('/');
      const cleanPattern = isDirOnly ? line.slice(0, -1) : line;

      // Convert simple glob pattern to regex
      let regexStr = cleanPattern
        .replace(/\./g, '\\.')
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '[^/]');

      if (cleanPattern.startsWith('/')) {
        // Root relative
        const prefix = relBase ? `^${relBase}/` : '^';
        regexStr = `${prefix}${regexStr.slice(1)}($|/)`;
      } else {
        // Can match in any subdirectory
        regexStr = `(^|/)${regexStr}($|/)`;
      }

      try {
        const regex = new RegExp(regexStr);
        matchers.push((relPath, isDir) => {
          if (isDirOnly && !isDir) return false;
          return regex.test(relPath);
        });
      } catch (e) {
        // Skip invalid regex
      }
    }
    return matchers;
  }
}

module.exports = RepoDiscoverer;
