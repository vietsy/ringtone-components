"use client";

import { useState } from "react";
import { Banner, Button, ButtonRow, Combobox, Divider, Panel, Select, Stepper, StatusLine, TextField } from "@/components/r1";
import { Text } from "@/components/Text";
import type { EnrolInput } from "@/lib/api/player";
import type { Locale } from "@/lib/i18n/translate";
import { enrolDevice } from "./actions";

export interface SupplierChoice {
  value: string;
  label: string;
  certified: boolean;
  /** The supplier's standing as the line under the field says it. */
  line: { family: "positive" | "attention"; text: string; detail: string | null };
}

/**
 * SCR-PLR-03's form and what follows it. Choosing a supplier says at once whether it holds a current certification,
 * and the steps after enrolment show the step that cannot be met yet; the device can still be enrolled, and stays
 * Newly enrolled. Enrol is available once an identity, a supplier and a premises are all given. A refusal takes the
 * place of the steps, with what was typed kept.
 */
export function EnrolForm({
  suppliers,
  premises,
  initial,
  errors,
  refusal,
  cancelHref,
  words,
  locale,
}: {
  suppliers: readonly SupplierChoice[];
  premises: readonly { value: string; label: string; detail: string | null }[];
  initial: EnrolInput | null;
  errors: { identity: string | null; supplier: string | null; premises: string | null };
  refusal: { code: string; title: string; text: string; action: { label: string; href: string } | null } | null;
  cancelHref: string;
  words: {
    device: string;
    idLabel: string;
    idHelp: string;
    supplier: string;
    chooseSupplier: string;
    premises: string;
    choosePremises: string;
    noPremises: string;
    enrol: string;
    cancel: string;
    needAll: string;
    needPremises: string;
    nextTitle: string;
    nextText: string;
    steps: readonly [string, string, string, string];
  };
  locale: Locale;
}) {
  const [identity, setIdentity] = useState(initial?.identity ?? "");
  const [supplier, setSupplier] = useState(initial?.supplier ?? "");
  const [place, setPlace] = useState(initial?.premises ?? "");
  const chosen = suppliers.find((option) => option.value === supplier) ?? null;
  const missing = identity.trim() === "" || supplier === "" || place === "";
  const why = premises.length === 0 ? words.needPremises : missing ? words.needAll : null;
  const certStep = chosen === null ? "todo" : chosen.certified ? "done" : "blocked";

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-6)", alignItems: "flex-start" }}>
      <div style={{ flex: "3 1 var(--container-md)", minWidth: 0, maxWidth: "var(--container-3xl)" }}>
        <form action={enrolDevice} style={{ display: "contents" }}>
          <Panel gap="xl" density="console" locale={locale}>
            <Panel variant="plain" level={2} title={words.device} density="console" locale={locale}>
              <TextField
                label={words.idLabel}
                name="device_identity"
                helper={words.idHelp}
                value={identity}
                onChange={setIdentity}
                mono
                required
                {...(errors.identity !== null ? { error: errors.identity } : {})}
                density="console"
                locale={locale}
              />
              <Select
                label={words.supplier}
                name="supplier_name"
                options={suppliers.map((option) => ({ value: option.value, label: option.label }))}
                {...(supplier !== "" ? { value: supplier } : {})}
                placeholder={words.chooseSupplier}
                onChange={setSupplier}
                required
                {...(errors.supplier !== null ? { error: errors.supplier } : {})}
                density="console"
                locale={locale}
              />
              {chosen !== null ? (
                <StatusLine family={chosen.line.family} text={chosen.line.text} {...(chosen.line.detail !== null ? { detail: chosen.line.detail } : {})} locale={locale} />
              ) : null}
              <Combobox
                wrap
                label={words.premises}
                name="premises_id"
                options={premises.map((option) => ({ value: option.value, label: option.label, ...(option.detail !== null ? { detail: option.detail } : {}) }))}
                {...(place !== "" ? { value: place } : {})}
                placeholder={words.choosePremises}
                onChange={(value) => setPlace(typeof value === "string" ? value : "")}
                required
                {...(premises.length === 0 ? { info: words.noPremises } : {})}
                {...(errors.premises !== null ? { error: errors.premises } : {})}
                density="console"
                locale={locale}
              />
            </Panel>
            <Divider />
            <ButtonRow>
              <Button variant="primary" size="sm" type="submit" {...(why !== null ? { disabled: true, disabledReason: why } : {})} locale={locale}>
                {words.enrol}
              </Button>
              <Button variant="quiet" size="sm" href={cancelHref} locale={locale}>
                {words.cancel}
              </Button>
            </ButtonRow>
          </Panel>
        </form>
      </div>
      <div style={{ flex: "2 1 var(--container-xs)", minWidth: 0 }}>
        {refusal !== null ? (
          <Banner
            family="neutral"
            title={refusal.title}
            code={refusal.code}
            {...(refusal.action !== null ? { action: { label: refusal.action.label, href: refusal.action.href, icon: "file-text" } } : {})}
            density="console"
            locale={locale}
          >
            {refusal.text}
          </Banner>
        ) : (
          <Panel title={words.nextTitle} level={2} density="console" locale={locale}>
            <Stepper
              label={words.nextTitle}
              steps={[
                { label: words.steps[0], state: "current" },
                { label: words.steps[1], state: certStep },
                { label: words.steps[2], state: "todo" },
                { label: words.steps[3], state: "todo" },
              ]}
              locale={locale}
            />
            <Text size="sm" tone="secondary">
              {words.nextText}
            </Text>
          </Panel>
        )}
      </div>
    </div>
  );
}
