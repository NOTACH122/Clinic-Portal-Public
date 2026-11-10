// Nested folders are stored in the existing `files.folder` text column as a
// slash-separated path ("2026/February"), so no schema change is needed. No
// existing folder name contains a slash, so old flat names keep working as
// single-segment paths.
export const FOLDER_SEPARATOR = "/";

export function folderSegments(path: string | null | undefined): string[] {
  if (!path) return [];
  return path
    .split(FOLDER_SEPARATOR)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

export function normalizeFolderPath(
  path: string | null | undefined,
): string | null {
  const segments = folderSegments(path);
  return segments.length ? segments.join(FOLDER_SEPARATOR) : null;
}

export function joinFolderPath(
  parent: string | null,
  name: string,
): string | null {
  return normalizeFolderPath(parent ? `${parent}${FOLDER_SEPARATOR}${name}` : name);
}

export function parentFolderPath(path: string | null): string | null {
  const segments = folderSegments(path);
  if (segments.length <= 1) return null;
  return segments.slice(0, -1).join(FOLDER_SEPARATOR);
}

export function folderDisplayName(path: string | null): string {
  const segments = folderSegments(path);
  return segments[segments.length - 1] ?? "";
}

type HasFolder = { folder?: string | null };

/**
 * Names of folders sitting directly inside `parent` - one level down only,
 * so drilling in reveals the next level rather than every descendant at once.
 */
export function childFolderNames(
  files: HasFolder[],
  parent: string | null,
): string[] {
  const parentSegments = folderSegments(parent);
  const names = new Set<string>();

  for (const file of files) {
    const segments = folderSegments(file.folder);
    if (segments.length <= parentSegments.length) continue;
    if (!parentSegments.every((segment, i) => segments[i] === segment)) continue;
    names.add(segments[parentSegments.length]);
  }

  return [...names].sort((a, b) => a.localeCompare(b));
}

/** Files sitting directly in `parent`, excluding anything in its subfolders. */
export function filesDirectlyIn<T extends HasFolder>(
  files: T[],
  parent: string | null,
): T[] {
  return files.filter(
    (file) => normalizeFolderPath(file.folder) === normalizeFolderPath(parent),
  );
}

/** Every file inside `parent`, including those nested deeper. */
export function filesUnder<T extends HasFolder>(
  files: T[],
  parent: string | null,
): T[] {
  const parentSegments = folderSegments(parent);
  if (!parentSegments.length) return files;

  return files.filter((file) => {
    const segments = folderSegments(file.folder);
    if (segments.length < parentSegments.length) return false;
    return parentSegments.every((segment, i) => segments[i] === segment);
  });
}

/** Every distinct folder path in use, including implied parent levels. */
export function allFolderPaths(files: HasFolder[]): string[] {
  const paths = new Set<string>();

  for (const file of files) {
    const segments = folderSegments(file.folder);
    for (let i = 1; i <= segments.length; i++) {
      paths.add(segments.slice(0, i).join(FOLDER_SEPARATOR));
    }
  }

  return [...paths].sort((a, b) => a.localeCompare(b));
}
