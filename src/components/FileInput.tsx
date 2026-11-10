"use client";

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useTranslation } from "@/lib/i18n/LanguageContext";

type SingleFileProps = {
  multiple?: false;
  file: File | null;
  onChange: (file: File | null) => void;
};

type MultiFileProps = {
  multiple: true;
  files: File[];
  onChange: (files: File[]) => void;
};

type DropProps = {
  // When provided, files dropped on the input are handed to this callback
  // instead of onChange, so the caller can intercept the drop (e.g. to
  // show a confirmation step) rather than silently populating the field.
  onFilesDropped?: (files: File[]) => void;
};

export default function FileInput({
  id,
  onFilesDropped,
  ...props
}: { id: string } & DropProps & (SingleFileProps | MultiFileProps)) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);

  const isEmpty = props.multiple ? props.files.length === 0 : !props.file;

  // Native file inputs can't have their value set programmatically, so
  // when the parent clears the selection (e.g. after a successful upload)
  // we clear the underlying input to match.
  useEffect(() => {
    if (isEmpty && inputRef.current) {
      inputRef.current.value = "";
    }
  }, [isEmpty]);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (props.multiple) {
      props.onChange(selected);
    } else {
      props.onChange(selected[0] ?? null);
    }
  }

  function handleDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setIsDragging(false);
    const dropped = Array.from(e.dataTransfer.files ?? []);
    if (dropped.length === 0) return;

    if (onFilesDropped) {
      onFilesDropped(dropped);
    } else if (props.multiple) {
      props.onChange(dropped);
    } else {
      props.onChange(dropped[0] ?? null);
    }
  }

  const label = isDragging
    ? t.admin.dropFilesHere
    : props.multiple
      ? props.files.length > 0
        ? t.admin.filesChosen(props.files.length)
        : t.admin.chooseFiles
      : props.file
        ? props.file.name
        : t.admin.chooseFile;

  return (
    <div>
      <input
        ref={inputRef}
        id={id}
        type="file"
        multiple={props.multiple}
        onChange={handleChange}
        className="sr-only"
      />
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-[14px] transition-colors ${
          isDragging
            ? "border-accent bg-accent-wash text-accent"
            : "border-border-strong bg-background text-secondary hover:bg-surface-muted"
        }`}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="shrink-0"
        >
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        </svg>
        <span className="truncate">{label}</span>
      </label>
    </div>
  );
}
