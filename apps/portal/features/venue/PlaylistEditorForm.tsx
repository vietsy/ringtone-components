"use client";

import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useState, useTransition } from "react";
import {
  Banner,
  Button,
  ButtonRow,
  Columns,
  Dialog,
  Divider,
  EmptyState,
  ItemList,
  Panel,
  SearchField,
  Select,
  StatusLine,
  TextField,
} from "@/components/r1";
import type { EditorItem, TrackResult } from "@/lib/api/venue";
import type { Locale } from "@/lib/i18n/translate";
import { searchTracks } from "./actions";
import { SubmitButton } from "./SubmitButton";

/** An item on screen: what the API holds, and whether it was added since the last save. */
type Item = EditorItem & { added: boolean };

export interface EditorCopy {
  items: string;
  name: string;
  noItemsTitle: string;
  noItemsText: string;
  addTitle: string;
  search: string;
  searchHelp: string;
  noResults: string;
  add: string;
  mood: string;
  moodPlaceholder: string;
  moodHelp: string;
  back: string;
  track: string;
  moodKind: string;
  byRightOne: string;
  eligible: string;
  notEligible: string;
  inEffect: string;
  notInEffect: string;
  added: string;
  unsavedAdded: string;
  unsavedRemoved: string;
  unsavedMoved: string;
  nameFirst: string;
  changeFirst: string;
  leaveTitle: string;
  leaveText: string;
  leave: string;
  keepEditing: string;
  save: string;
}

/**
 * SCR-VEN-07's editor: the items in play order, moved and removed in place, eligible tracks found by search and
 * shared moods added from the list RightOne keeps. Nothing is saved until Save, which sends the whole list as a new
 * playlist or the next revision; leaving with changes asks first. A refusal comes back beside the item it names.
 */
export function PlaylistEditorForm({
  service,
  playlist,
  initialName,
  saved,
  initialItems,
  moods,
  refusal,
  readOnly,
  stopped,
  copy,
  action,
  backHref,
  phone,
  locale,
}: {
  service: string;
  /** Null for a new playlist. */
  playlist: { id: string; name: string } | null;
  initialName: string;
  /** The items of the revision saved now, against which a change is told. */
  saved: readonly EditorItem[];
  initialItems: readonly EditorItem[];
  moods: readonly { id: string; name: string }[];
  /** The last save's refusal: beside the item it names, above the items, or under the name. */
  refusal: { code: string; title: string; text: string; sentence: string; ref: string | null; place: "item" | "items" | "name" | "header" } | null;
  readOnly: boolean;
  /** Why the service's state lets nothing be saved (ENTITLEMENT_NOT_ACTIVE, in its words), or null while it does. */
  stopped: string | null;
  copy: EditorCopy;
  action: (formData: FormData) => Promise<void>;
  backHref: Route;
  phone: boolean;
  locale: Locale;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [items, setItems] = useState<Item[]>(() => initialItems.map((item) => ({ ...item, added: !saved.some((kept) => kept.ref === item.ref) })));
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<readonly TrackResult[] | null>(null);
  const [searching, startSearching] = useTransition();
  const [moodKey, setMoodKey] = useState(0);
  const [leaving, setLeaving] = useState(false);

  const addedTitles = items.filter((item) => item.added).map((item) => item.title);
  const removed = saved.filter((kept) => !items.some((item) => item.ref === kept.ref)).length;
  const moved = !addedTitles.length && !removed && items.some((item, index) => saved[index]?.ref !== item.ref);
  const changed = addedTitles.length > 0 || removed > 0 || moved;
  const unsaved =
    addedTitles.length > 0
      ? copy.unsavedAdded.replace("{titles}", addedTitles.join(", "))
      : removed > 0
        ? copy.unsavedRemoved.replace("{n}", String(removed))
        : moved
          ? copy.unsavedMoved
          : null;
  const blocked = stopped ?? (readOnly ? copy.changeFirst : playlist === null ? (name.trim() === "" ? copy.nameFirst : null) : changed ? null : copy.changeFirst);

  function add(item: Item) {
    setItems((before) => [...before, item]);
  }
  function search(words: string) {
    startSearching(async () => setResults(await searchTracks(service, words)));
  }
  const status = (item: Item) =>
    item.added
      ? { family: "info" as const, label: copy.added }
      : item.kind === "TRACK"
        ? { family: item.eligible ? ("neutral" as const) : ("attention" as const), label: item.eligible ? copy.eligible : copy.notEligible }
        : { family: item.eligible ? ("neutral" as const) : ("attention" as const), label: item.eligible ? copy.inEffect : copy.notInEffect };

  const list = (
    <Panel variant="plain" level={2} title={copy.items} gap="md" density="portal" locale={locale}>
      {refusal !== null && refusal.place === "items" ? (
        <Banner family="attention" title={refusal.title} code={refusal.code} level={3} density="portal" live locale={locale}>
          {refusal.text}
        </Banner>
      ) : null}
      {items.length === 0 ? (
        <EmptyState variant="not-started" title={copy.noItemsTitle} level={3} action={false} density="portal" locale={locale}>
          {copy.noItemsText}
        </EmptyState>
      ) : (
        <ItemList
          items={items.map((item, index) => ({
            key: `${item.ref}-${String(index)}`,
            lead: item.kind === "TRACK" ? copy.track : copy.moodKind,
            title: item.title,
            detail: item.by ?? copy.byRightOne,
            status: status(item),
            ...(refusal !== null && refusal.place === "item" && refusal.ref === item.ref ? { message: { severity: "warning" as const, text: refusal.sentence } } : {}),
          }))}
          reorder={!readOnly}
          readOnly={readOnly}
          onMove={(from, to) =>
            setItems((before) => {
              const next = [...before];
              const [moving] = next.splice(from, 1);
              if (moving !== undefined) next.splice(to, 0, moving);
              return next;
            })
          }
          onRemove={(index) => setItems((before) => before.filter((_, at) => at !== index))}
          density="portal"
          label={copy.items}
          locale={locale}
        />
      )}
    </Panel>
  );

  const save = (
    <SubmitButton variant="primary" size="md" fullWidth={phone} disabled={blocked !== null} {...(blocked !== null ? { disabledReason: blocked } : {})} locale={locale}>
      {copy.save}
    </SubmitButton>
  );
  const back = (
    <Button variant="quiet" size="md" fullWidth={phone} {...(changed ? { onClick: () => setLeaving(true) } : { href: backHref })} locale={locale}>
      {copy.back}
    </Button>
  );

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <input type="hidden" name="items" value={JSON.stringify(items.map(({ added, ...item }) => (added ? { ...item, eligible: true } : item)))} />
      <Columns single={phone || readOnly}>
        <Panel gap="xl" inset={phone ? "sm" : "md"} density="portal" locale={locale}>
          {playlist === null ? (
            <TextField
              label={copy.name}
              name="name"
              value={name}
              onChange={setName}
              required
              {...(refusal !== null && refusal.place === "name" ? { error: refusal.sentence } : {})}
              density="portal"
              locale={locale}
            />
          ) : null}
          {list}
          {unsaved !== null && !readOnly ? <StatusLine family="info" text={unsaved} cutout="surface" locale={locale} /> : null}
        </Panel>
        {!readOnly ? (
          <Panel as="aside" title={copy.addTitle} level={2} inset={phone ? "sm" : "md"} density="portal" locale={locale}>
            <SearchField label={copy.search} name="track_query" helper={copy.searchHelp} value={query} onChange={setQuery} onSearch={search} loading={searching} density="portal" locale={locale} />
            {results !== null ? (
              <ItemList
                items={results.map((result) => ({
                  key: result.id,
                  title: result.title,
                  detail: result.by,
                  actions: [
                    {
                      label: copy.add,
                      icon: "plus",
                      ariaLabel: `${copy.add} ${result.title}`,
                      onClick: () => add({ kind: "TRACK", ref: result.id, title: result.title, by: result.by, eligible: true, added: true }),
                    },
                  ],
                }))}
                density="portal"
                label={copy.search}
                emptyText={copy.noResults}
                locale={locale}
              />
            ) : null}
            <Divider />
            <Select
              key={moodKey}
              label={copy.mood}
              name="shared_mood_pick"
              helper={copy.moodHelp}
              options={moods.map((mood) => ({ value: mood.id, label: mood.name }))}
              placeholder={copy.moodPlaceholder}
              onChange={(id) => {
                const mood = moods.find((candidate) => candidate.id === id);
                if (mood === undefined) return;
                add({ kind: "SHARED_MOOD", ref: mood.id, title: mood.name, by: null, eligible: true, added: true });
                setMoodKey((value) => value + 1);
              }}
              density="portal"
              locale={locale}
            />
          </Panel>
        ) : null}
      </Columns>
      {phone ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {save}
          {back}
        </div>
      ) : (
        <ButtonRow>
          {save}
          {back}
        </ButtonRow>
      )}
      {leaving ? (
        <Dialog
          title={copy.leaveTitle}
          description={copy.leaveText.replace("{name}", playlist?.name ?? name)}
          primaryAction={{ label: copy.leave, variant: "danger", onClick: () => router.push(backHref) }}
          secondaryAction={{ label: copy.keepEditing, onClick: () => setLeaving(false) }}
          onClose={() => setLeaving(false)}
          open
          placement="viewport"
          density="portal"
          locale={locale}
        />
      ) : null}
    </form>
  );
}
