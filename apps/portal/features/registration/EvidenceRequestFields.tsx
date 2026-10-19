"use client";

import { useState, type ReactNode } from "react";
import { Button, ButtonRow, Divider, FieldRow, FieldRows, ItemList, TextField } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";
import { ConfirmSubmit } from "./ConfirmSubmit";

interface Item {
  code: string;
  description: string;
}

export interface EvidenceRequestWords {
  items: string;
  itemsHelp: string;
  item: string;
  code: string;
  desc: string;
  add: string;
  request: string;
  requestNone: string;
  requestWhy: string;
  cancel: string;
  dlgTitle: string;
  dlgText: string;
  dlgBack: string;
}

/**
 * SCR-REG-11's items and its act. Each item is a row of a code and the sentence the applicant reads; Add an item
 * gives a blank row and moves focus to its code, Remove takes a row away (nothing was sent). Request {n} items
 * waits for one complete item and asks before it sends, naming the count and the due date.
 */
export function EvidenceRequestFields({
  formId,
  initial,
  error,
  cancelHref,
  words,
  between,
  locale,
}: {
  formId: string;
  initial: readonly Item[];
  /** EVIDENCE_ITEMS_EMPTY beside the items. */
  error: string | null;
  cancelHref: string;
  /** The words with {n} and {d} filled by the count; `dlgTitle` and `request` carry {n}. */
  words: EvidenceRequestWords;
  /** What sending does, and a refusal of the last attempt, between the items and the actions. */
  between: ReactNode;
  locale: Locale;
}) {
  const [items, setItems] = useState<Item[]>(initial.length > 0 ? [...initial] : [{ code: "", description: "" }]);
  const complete = items.filter((item) => item.code.trim() !== "" && item.description.trim() !== "");
  const n = String(complete.length);
  const change = (index: number, field: keyof Item, value: string) =>
    setItems((before) => before.map((item, at) => (at === index ? { ...item, [field]: field === "code" ? value.toUpperCase() : value } : item)));
  return (
    <>
      <FieldRows
        legend={words.items}
        helper={words.itemsHelp}
        required
        count={items.length}
        addLabel={words.add}
        onAdd={() => setItems((before) => [...before, { code: "", description: "" }])}
        {...(error !== null ? { error } : {})}
        density="console"
        locale={locale}
      >
        {items.map((item, index) => {
          const head = words.item.replace("{n}", String(index + 1));
          return (
            <FieldRow
              key={index}
              title={item.code.trim() !== "" ? `${head}: ${item.code.trim()}` : head}
              removable={items.length > 1}
              onRemove={() => setItems((before) => before.filter((_, at) => at !== index))}
              density="console"
              locale={locale}
            >
              <TextField
                label={words.code}
                name={`items[${String(index)}].item_code`}
                value={item.code}
                onChange={(value) => change(index, "code", value)}
                required
                mono
                maxLength={40}
                density="console"
                width="var(--space-72)"
                locale={locale}
              />
              <TextField
                label={words.desc}
                name={`items[${String(index)}].description`}
                value={item.description}
                onChange={(value) => change(index, "description", value)}
                required
                multiline
                rows={2}
                maxLength={300}
                width="100%"
                density="console"
                locale={locale}
              />
            </FieldRow>
          );
        })}
      </FieldRows>
      {between}
      <Divider />
      <ButtonRow>
        <ConfirmSubmit
          formId={formId}
          label={complete.length > 0 ? words.request.replace("{n}", n) : words.requestNone}
          shortcut="Alt+R"
          disabledReason={complete.length > 0 ? null : words.requestWhy}
          dialog={{ title: words.dlgTitle.replace("{n}", n), description: words.dlgText, confirm: words.request.replace("{n}", n), back: words.dlgBack }}
          locale={locale}
        >
          <ItemList
            items={complete.map((item, index) => ({ key: `i${String(index)}`, title: item.description.trim(), meta: item.code.trim() }))}
            numbered
            readOnly
            density="console"
            label={words.items}
            locale={locale}
          />
        </ConfirmSubmit>
        <Button variant="quiet" size="sm" href={cancelHref} locale={locale}>
          {words.cancel}
        </Button>
      </ButtonRow>
    </>
  );
}
