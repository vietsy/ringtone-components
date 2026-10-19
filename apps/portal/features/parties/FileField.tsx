"use client";

import { useState } from "react";
import { FileList as R1FileList, FileUpload } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";

interface Chosen {
  name: string;
  type: string;
  sizeBytes: number;
  at: string;
}

const kindOf = (type: string): "pdf" | "image" | "other" => (type === "application/pdf" ? "pdf" : type.startsWith("image/") ? "image" : "other");

/**
 * A file chosen for a form: the browser's chooser, then the file by its name and size. The form sends what the
 * file is in three hidden fields (`<name>_name`, `_type`, `_size`); the mock keeps no bytes, as there is no document
 * store to hand them to yet. On the console the chosen file reads as a list entry with who attached it and when, as
 * SCR-PTY-03 draws it; on the portal it stays in the upload field, as SCR-PTY-12 draws it.
 */
export function FileField({
  name,
  label,
  helper,
  sizeWords,
  by,
  initial,
  density,
  locale,
}: {
  name: string;
  label: string;
  helper: string;
  /** "{n} KB": the file's size as the field shows it. */
  sizeWords: string;
  /** Who attaches it, for the console's list entry. */
  by: string;
  initial: { name: string; type: string; sizeBytes: number } | null;
  density: "console" | "portal";
  locale: Locale;
}) {
  const [chosen, setChosen] = useState<Chosen | null>(initial !== null ? { ...initial, at: new Date().toISOString() } : null);
  const take = (files: FileList) => {
    const file = files[0];
    if (file !== undefined) setChosen({ name: file.name, type: file.type, sizeBytes: file.size, at: new Date().toISOString() });
  };
  const size = chosen !== null ? sizeWords.replace("{n}", String(Math.max(1, Math.round(chosen.sizeBytes / 1000)))) : null;
  return (
    <>
      {chosen !== null ? (
        <>
          <input type="hidden" name={`${name}_name`} value={chosen.name} />
          <input type="hidden" name={`${name}_type`} value={chosen.type} />
          <input type="hidden" name={`${name}_size`} value={String(chosen.sizeBytes)} />
        </>
      ) : null}
      {density === "console" && chosen !== null ? (
        <R1FileList
          items={[{ key: name, name: chosen.name, type: kindOf(chosen.type), ...(size !== null ? { size } : {}), at: chosen.at, by, state: "ready", removable: true, onRemove: () => setChosen(null) }]}
          label={label}
          density="console"
          locale={locale}
        />
      ) : (
        <FileUpload
          label={label}
          helper={helper}
          accept=".pdf,.jpg,.png"
          onFiles={take}
          onReplace={take}
          onRemove={() => setChosen(null)}
          {...(chosen !== null && size !== null ? { fileName: chosen.name, fileSize: size } : {})}
          density={density}
          locale={locale}
        />
      )}
    </>
  );
}
