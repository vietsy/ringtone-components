"use client";

import { useState, useTransition } from "react";
import { Banner, Button, DateField, ItemList, Panel, SearchField, Select, TextField } from "@/components/r1";
import type { TrackOption } from "@/lib/api/venue";
import type { Locale } from "@/lib/i18n/translate";
import { searchMoodTracks } from "./console-actions";
import { readDate } from "./fields";
import { SubmitButton } from "./SubmitButton";

export interface MoodFormCopy {
  name: string;
  owner: string;
  ownerSO: string;
  from: string;
  tracks: string;
  /** "{n} bài" */
  picked: string;
  pickedOne: string;
  addTracks: string;
  search: string;
  searchHelp: string;
  noResults: string;
  add: string;
  submit: string;
  fillFirst: string;
}

/**
 * The tracks of a shared mood version and its date, as SCR-VEN-17 creates a mood with version 1 and SCR-VEN-18
 * prepares the next version: tracks found among those eligible now, put in order and removed in place. The submit is
 * open once every field is filled. A refusal comes back beside the field or the track it names.
 */
export function MoodForm({
  mode,
  copy,
  initial,
  errors,
  refusal,
  action,
  locale,
}: {
  mode: "create" | "prepare";
  copy: MoodFormCopy;
  initial: { name: string; effectiveFrom: string; tracks: readonly TrackOption[] };
  errors: { name?: string; effectiveFrom?: string; tracks?: string };
  /** TRACK_NOT_ELIGIBLE beside the track it names. */
  refusal: { track: string; sentence: string } | null;
  action: (formData: FormData) => Promise<void>;
  locale: Locale;
}) {
  const [name, setName] = useState(initial.name);
  const [from, setFrom] = useState(initial.effectiveFrom);
  const [tracks, setTracks] = useState<TrackOption[]>([...initial.tracks]);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<readonly TrackOption[] | null>(null);
  const [busy, startSearch] = useTransition();
  const filled = (mode === "prepare" || name.trim() !== "") && readDate(from) !== null && tracks.length > 0;

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <input type="hidden" name="tracks" value={JSON.stringify(tracks)} />
      {mode === "create" ? (
        <>
          <TextField label={copy.name} name="name" value={name} onChange={setName} {...(errors.name !== undefined ? { error: errors.name } : {})} required density="console" locale={locale} />
          <Select label={copy.owner} name="owner_role" options={[{ value: "SERVICE_OWNER", label: copy.ownerSO }]} value="SERVICE_OWNER" required density="console" locale={locale} />
        </>
      ) : null}
      <DateField
        label={copy.from}
        name="effective_from"
        value={initial.effectiveFrom}
        onChange={(value) => setFrom(typeof value === "string" ? value : "")}
        {...(errors.effectiveFrom !== undefined ? { error: errors.effectiveFrom } : {})}
        required
        density="console"
        locale={locale}
      />
      <Panel variant="plain" title={copy.tracks} meta={tracks.length === 1 ? copy.pickedOne : copy.picked.replace("{n}", String(tracks.length))} level={3} gap="sm" density="console" locale={locale}>
        {errors.tracks !== undefined ? (
          <Banner family="attention" level={4} compact density="console" locale={locale}>
            {errors.tracks}
          </Banner>
        ) : null}
        <ItemList
          items={tracks.map((track) => ({
            key: track.id,
            title: track.title,
            detail: track.by,
            ...(refusal !== null && refusal.track === track.id ? { message: { severity: "warning" as const, text: refusal.sentence } } : {}),
          }))}
          numbered
          reorder
          onMove={(at, to) =>
            setTracks((before) => {
              const next = [...before];
              const [moving] = next.splice(at, 1);
              if (moving !== undefined) next.splice(to, 0, moving);
              return next;
            })
          }
          onRemove={(index) => setTracks((before) => before.filter((_, at) => at !== index))}
          density="console"
          label={copy.tracks}
          locale={locale}
        />
        {searching ? (
          <>
            <SearchField
              label={copy.search}
              name="track_query"
              helper={copy.searchHelp}
              value={query}
              onChange={setQuery}
              onSearch={(words) => startSearch(async () => setResults(await searchMoodTracks(words)))}
              loading={busy}
              density="console"
              locale={locale}
            />
            {results !== null ? (
              <ItemList
                items={results
                  .filter((result) => !tracks.some((track) => track.id === result.id))
                  .map((result) => ({
                    key: result.id,
                    title: result.title,
                    detail: result.by,
                    actions: [{ label: copy.add, icon: "plus", ariaLabel: `${copy.add} ${result.title}`, onClick: () => setTracks((before) => [...before, result]) }],
                  }))}
                density="console"
                label={copy.search}
                emptyText={copy.noResults}
                locale={locale}
              />
            ) : null}
          </>
        ) : (
          <div style={{ display: "flex" }}>
            <Button variant="secondary" size="sm" icon="plus" onClick={() => setSearching(true)} locale={locale}>
              {copy.addTracks}
            </Button>
          </div>
        )}
      </Panel>
      <SubmitButton variant={mode === "create" ? "primary" : "secondary"} size="sm" fullWidth disabled={!filled} {...(!filled ? { disabledReason: copy.fillFirst } : {})} locale={locale}>
        {copy.submit}
      </SubmitButton>
    </form>
  );
}
