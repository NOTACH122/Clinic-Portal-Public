"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import FilesList, { type FileRow } from "@/components/FilesList";
import FileListItem from "@/components/FileListItem";
import FolderIcon from "@/components/FolderIcon";
import FolderBreadcrumb from "@/components/FolderBreadcrumb";
import { folderExpiryState } from "@/lib/protocolExpiry";
import {
  childFolderNames,
  filesDirectlyIn,
  filesUnder,
  joinFolderPath,
} from "@/lib/folderPath";

export default function ClinicFolderView({ files }: { files: FileRow[] }) {
  const { t } = useTranslation();
  const [viewAll, setViewAll] = useState(false);
  const [currentPath, setCurrentPath] = useState<string | null>(null);

  if (files.length === 0) {
    return <p className="text-[13.5px] text-secondary">{t.files.noFilesYet}</p>;
  }

  if (viewAll) {
    return (
      <div className="space-y-3.5">
        <button
          type="button"
          onClick={() => setViewAll(false)}
          className="text-[13px] font-semibold text-accent-dark hover:underline"
        >
          {t.dashboard.viewByFolder}
        </button>
        <FilesList files={files} canAcknowledgeExpiry />
      </div>
    );
  }

  const childFolders = childFolderNames(files, currentPath);
  const filesHere = filesDirectlyIn(files, currentPath);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FolderBreadcrumb path={currentPath} onNavigate={setCurrentPath} />
        <button
          type="button"
          onClick={() => setViewAll(true)}
          className="text-[13px] font-semibold text-accent-dark hover:underline"
        >
          {t.dashboard.viewAll}
        </button>
      </div>

      {childFolders.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {childFolders.map((name) => {
            const path = joinFolderPath(currentPath, name);
            const inside = filesUnder(files, path);
            const count = inside.length;
            const state = folderExpiryState(inside);
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
        <div>
          {childFolders.length > 0 && !currentPath && (
            <h3 className="mb-2 text-[12.5px] font-semibold uppercase tracking-wide text-secondary">
              {t.dashboard.generalFiles}
            </h3>
          )}
          <ul className="flex flex-col gap-2.5">
            {filesHere.map((file) => (
              <FileListItem
                key={file.id}
                file={file}
                showClinic={false}
                canDelete={false}
                canAcknowledgeExpiry
              />
            ))}
          </ul>
        </div>
      ) : (
        childFolders.length === 0 && (
          <p className="text-[13.5px] text-secondary">{t.files.emptyFolder}</p>
        )
      )}
    </div>
  );
}
