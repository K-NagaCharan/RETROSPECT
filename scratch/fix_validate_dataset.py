import os

val_path = r"D:\base papers considered\Test creation\datasets\retrospect_historical_rescue_v1\validation\validate_dataset.js"
with open(val_path, "r", encoding="utf-8") as f:
    content = f.read()

old_resolve = """function resolveRepoPath(repoSlug) {
  if (!repoSlug) return null;
  const parts = repoSlug.split('/');
  const shortName = parts[parts.length - 1];
  const directPath = path.join(CLONES_DIR, shortName);
  if (fs.existsSync(directPath)) return directPath;
  const hyphenPath = path.join(CLONES_DIR, repoSlug.replace(/\\//g, '-'));
  if (fs.existsSync(hyphenPath)) return hyphenPath;
  return null;
}"""

new_resolve = """const KNOWN_MAP = {
  'vuejs/core': 'vue',
  'datastax/java-driver': 'datastax-java-driver',
  'undertow-io/undertow': 'undertow',
  'ReactiveX/rxjs': 'rxjs',
  'mochajs/mocha': 'mocha',
  'encode/httpx': 'httpx',
  'psf/requests': 'requests',
  'colinhacks/zod': 'zod',
  'google/guava': 'guava',
  'pytest-dev/pytest': 'pytest',
  'checkstyle/checkstyle': 'checkstyle',
  'graphhopper/graphhopper': 'graphhopper',
  'moment/moment': 'moment',
  'marshmallow-code/marshmallow': 'marshmallow'
};

function resolveRepoPath(repoSlug) {
  if (!repoSlug) return null;
  if (KNOWN_MAP[repoSlug]) {
    const p = path.join(CLONES_DIR, KNOWN_MAP[repoSlug]);
    if (fs.existsSync(p)) return p;
  }
  const parts = repoSlug.split('/');
  const shortName = parts[parts.length - 1];
  const directPath = path.join(CLONES_DIR, shortName);
  if (fs.existsSync(directPath)) return directPath;
  const hyphenPath = path.join(CLONES_DIR, repoSlug.replace(/\\//g, '-'));
  if (fs.existsSync(hyphenPath)) return hyphenPath;
  return null;
}"""

content = content.replace(old_resolve, new_resolve)

# Fix datasetsDir
content = content.replace(
    "const datasetsDir = path.join(BASE_DATASET_DIR, 'datasets');",
    "const datasetsDir = fs.existsSync(path.join(BASE_DATASET_DIR, 'datasets')) ? path.join(BASE_DATASET_DIR, 'datasets') : BASE_DATASET_DIR;"
)

with open(val_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Updated validate_dataset.js successfully")
