"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { moveFilesToFolder, deleteFiles } from "./actions";
import FileListItem from "@/components/FileListItem";
import FolderIcon from "@/components/FolderIcon";
import FolderBreadcrumb from "@/components/FolderBreadcrumb";
import SelectAllToggle from "@/components/SelectAllToggle";
import type { FileRow } from "@/components/FilesList";
import { isExpired } from "@/lib/protocolExpiry";
import {
  allFolderPaths,
  childFolderNames,
  filesDirectlyIn,
  filesUnder,
  joinFolderPath,
} from "@/lib/folderPath";

export default function AdminClinicFolderView({ files }: { files: FileRow[] }) {
  const router = useRouter();
  const { t } = useTranslation();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [folderInput, setFolderInput] = useState("");
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState<string | null>(null);

  const existingFolders = allFolderPaths(files);
  const childFolders = childFolderNames(files, currentPath);
  const filesHere = filesDirectlyIn(files, currentPath);

  // Only the files listed at this level are selectable, so "select all"
  // covers exactly what is on screen rather than reaching into subfolders.
  const selectedHereCount = filesHere.filter((f) => selectedIds.has(f.id)).length;

  function toggleSelectAll(selectAll: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const file of filesHere) {
        if (selectAll) next.add(file.id);
        else next.delete(file.id);
      }
      return next;
    });
  }

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleMove(folder: string | null) {
    setError(null);
    setMoving(true);
    const result = await moveFilesToFolder([...selectedIds], folder);
    setMoving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSelectedIds(new Set());
    setFolderInput("");
    router.refresh();
  }

  async function handleDeleteSelected() {
    if (!confirm(t.admin.confirmDeleteSelected(selectedIds.size))) return;
    setError(null);
    setMoving(true);
    const result = await deleteFiles([...selectedIds]);
    setMoving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSelectedIds(new Set());
    router.refresh();
  }

  if (files.length === 0) {
    return <p className="text-[13.5px] text-secondary">{t.files.noFilesYet}</p>;
  }

  return (
    <div className="space-y-4">
      <FolderBreadcrumb path={currentPath} onNavigate={setCurrentPath} />

      {selectedIds.size > 0 && (
        <div className="rounded-xl border border-accent bg-accent-wash p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-semibold text-accent-dark">
              {t.admin.selected(selectedIds.size)}
            </span>
            <input
              type="text"
              list="folder-suggestions"
              value={folderInput}
              onChange={(e) => setFolderInput(e.target.value)}
              placeholder={t.admin.folderPlaceholder}
              className="min-w-[180px] flex-1 rounded-lg border border-border-strong bg-surface px-3 py-1.5 text-[13px] text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-wash"
            />
            <datalist id="folder-suggestions">
              {existingFolders.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
            <button
              type="button"
              disabled={moving || !folderInput.trim()}
              onClick={() => handleMove(folderInput)}
              className="rounded-lg bg-accent px-3 py-1.5 text-[13px] font-bold text-white hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {moving ? t.admin.moving : t.admin.moveButton}
            </button>
            {currentPath && (
              <button
                type="button"
                disabled={moving || !folderInput.trim()}
                onClick={() => handleMove(joinFolderPath(currentPath, folderInput))}
                className="rounded-lg border border-accent bg-surface px-3 py-1.5 text-[13px] font-semibold text-accent-dark hover:bg-accent-wash disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t.admin.newFolder}
              </button>
            )}
            <button
              type="button"
              disabled={moving}
              onClick={() => handleMove(null)}
              className="rounded-lg border border-border-strong bg-surface px-3 py-1.5 text-[13px] font-semibold text-foreground hover:bg-surface-muted disabled:opacity-60"
            >
              {t.admin.noFolder}
            </button>
            <button
              type="button"
              disabled={moving}
              onClick={handleDeleteSelected}
              className="rounded-lg bg-danger px-3 py-1.5 text-[13px] font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t.admin.deleteSelected}
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-[13px] font-semibold text-secondary hover:text-foreground"
            >
              {t.admin.clearSelection}
            </button>
          </div>
          <p className="mt-2 text-[11.5px] text-accent-dark">
            {t.admin.folderNestHint}
          </p>
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-danger-wash px-3.5 py-2.5 text-[13.5px] text-danger">
          {error}
        </p>
      )}

      {childFolders.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {childFolders.map((name) => {
            const path = joinFolderPath(currentPath, name);
            const inside = filesUnder(files, path);
            const count = inside.length;
            // Admin view ignores clinic acknowledgement on purpose.
            const state = inside.some(isExpired) ? "expired" : "none";
            return (
              <button
                key={name}
                type="button"
                onClick={() => setCurrentPath(path)}
                className="relative flex flex-col items-center gap-1.5 rounded-xl border border-border bg-surface p-4 text-center hover:border-accent hover:bg-accent-wash"
              >
                {state !== "none" && (
                  <span
                    aria-hidden="true"
                    className={`absolute right-2 top-2 h-2.5 w-2.5 rounded-full ${
                      state === "expired" ? "bg-danger" : "bg-warn"
                    }`}
                  />
                )}
                <FolderIcon />
                <span className="w-full truncate text-[13px] font-semibold text-foreground">
                  {name}
                </span>
                <span className="text-[11.5px] text-secondary">
                  {t.files.filesCount(count)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {filesHere.length > 0 ? (
        <>
        <SelectAllToggle
          total={filesHere.length}
          selectedCount={selectedHereCount}
          onChange={toggleSelectAll}
        />
        <ul className="flex flex-col gap-2.5">
          {filesHere.map((file) => (
            <FileListItem
              key={file.id}
              file={file}
              showClinic={false}
              canDelete
              selectable
              selected={selectedIds.has(file.id)}
              onToggleSelect={() => toggle(file.id)}
            />
          ))}
        </ul>
        </>
      ) : (
        childFolders.length === 0 && (
          <p className="text-[13.5px] text-secondary">{t.files.emptyFolder}</p>
        )
      )}
    </div>
  );
}
