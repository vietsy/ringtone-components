"use client";

import { useRef, useState, useTransition } from "react";
import { Banner, Button, ButtonRow, ChoiceList, DateField, Dialog, Divider, FactList, FieldRow, FieldRows, Panel, Select, TextField, format } from "@/components/r1";
import type { EnforcementInput, EnforcementKind } from "@/lib/api/venue";
import type { Locale } from "@/lib/i18n/translate";
import { instantOfField } from "./instants";

type Fact = { label: string; value: unknown; kind?: "status" | "datetime" | "mono" };

export interface EnforcementCopy {
  nowTitle: string;
  action: string;
  hints: Readonly<Record<EnforcementKind, string>>;
  actions: Readonly<Record<EnforcementKind, string>>;
  ground: string;
  groundPh: string;
  /** The choice's legend, its two options and their hints, then the time field's label and helper. */
  effective: string;
  when: Readonly<Record<When, string>>;
  whenHints: Readonly<Record<When, string>>;
  effectiveAt: string;
  effectiveHelp: string;
  notice: string;
  noticeHelp: string;
  noticePh: string;
  remedy: string;
  remedyHelp: string;
  conds: string;
  condsHelp: string;
  condCode: string;
  condText: string;
  /** "Điều kiện {n}" */
  cond: string;
  addCond: string;
  record: string;
  cancel: string;
  fillFirst: string;
  /** "{action} dịch vụ Player của {premises} từ {ts}, giờ Việt Nam?" */
  dlgTitle: string;
  dlgText: string;
  /** "{action} dịch vụ Player của {premises} ngay bây giờ?" */
  dlgTitleNow: string;
  dlgTextNow: string;
  dlgYes: Readonly<Record<EnforcementKind, string>>;
  dlgNo: string;
}

const KINDS: readonly EnforcementKind[] = ["SUSPEND", "RESTRICT", "REVOKE"];

type When = "NOW" | "AT";
const WHENS: readonly When[] = ["NOW", "AT"];

/**
 * SCR-VEN-14's form: the action, a ground the policy in force lists, the effective time, the notice, the remedy and,
 * unless it is a revocation, the reinstatement conditions. The time is now, the instant the service records the
 * action however long the form stayed open, or a time typed for later. Record the action is open once every mandatory
 * field is filled and asks first, naming the action, the premises and the time; a refusal comes back in the panel
 * above the actions with the fields kept, beside the field it names where it names one.
 */
export function EnforcementForm({
  copy,
  premises,
  facts,
  grounds,
  policy,
  notices,
  initial,
  refusal,
  errors,
  action,
  cancelHref,
  locale,
}: {
  copy: EnforcementCopy;
  premises: string;
  facts: readonly Fact[];
  grounds: readonly { value: string; label: string }[];
  policy: { name: string; version: string; effective: string } | null;
  notices: readonly { value: string; label: string }[];
  initial: EnforcementInput;
  refusal: { code: string; title: string; text: string; family: "neutral" | "attention" } | null;
  errors: { action?: string; ground?: string; effective?: string };
  action: (formData: FormData) => Promise<void>;
  cancelHref: string;
  locale: Locale;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [kind, setKind] = useState(initial.action);
  const [ground, setGround] = useState(initial.ground);
  const [when, setWhen] = useState(initial.when);
  const [effective, setEffective] = useState(initial.effectiveAt);
  const [remedy, setRemedy] = useState(initial.remedy);
  const [conditions, setConditions] = useState<{ code: string; text: string }[]>(initial.conditions.length > 0 ? [...initial.conditions] : [{ code: "", text: "" }]);
  const [confirming, setConfirming] = useState(false);
  const [sending, startSending] = useTransition();
  const revoke = kind === "REVOKE";
  // With no policy in force there is no ground to choose, and the submission is answered POLICY_NOT_APPROVED.
  const filled =
    kind !== "" &&
    (ground !== "" || grounds.length === 0) &&
    (when === "NOW" || (when === "AT" && effective !== "")) &&
    remedy.trim() !== "" &&
    (revoke || conditions.some((condition) => condition.code.trim() !== "" && condition.text.trim() !== ""));
  const chosen = KINDS.find((candidate) => candidate === kind) ?? "SUSPEND";
  const at = instantOfField(effective);
  const set = (index: number, part: "code" | "text", value: string) =>
    setConditions((before) => before.map((condition, at2) => (at2 === index ? { ...condition, [part]: value } : condition)));

  return (
    <form ref={form} action={action} style={{ display: "contents" }}>
      <input type="hidden" name="conditions" value={JSON.stringify(revoke ? [] : conditions)} />
      <Panel gap="xl" density="console" locale={locale}>
        <Panel variant="plain" level={2} title={copy.nowTitle} gap="sm" density="console" locale={locale}>
          <FactList items={[...facts]} columns={2} density="console" locale={locale} />
        </Panel>
        <Divider />
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", maxWidth: "var(--container-3xl)" }}>
          <ChoiceList
            legend={copy.action}
            name="action"
            required
            options={KINDS.map((value) => ({ value, label: copy.actions[value], hint: copy.hints[value] }))}
            {...(kind !== "" ? { value: kind } : {})}
            {...(errors.action !== undefined ? { error: errors.action } : {})}
            onChange={(event) => setKind((event as { target: { value: string } }).target.value)}
            layout="inline"
            density="console"
            locale={locale}
          />
          <Select
            label={copy.ground}
            name="ground_code"
            options={[...grounds]}
            {...(ground !== "" ? { value: ground } : {})}
            placeholder={copy.groundPh}
            onChange={setGround}
            {...(errors.ground !== undefined ? { error: errors.ground } : {})}
            required
            {...(policy !== null ? { policy } : {})}
            density="console"
            locale={locale}
          />
          <ChoiceList
            legend={copy.effective}
            name="effective_when"
            required
            options={WHENS.map((value) => ({ value, label: copy.when[value], hint: copy.whenHints[value] }))}
            {...(when !== "" ? { value: when } : {})}
            onChange={(event) => setWhen((event as { target: { value: string } }).target.value)}
            layout="inline"
            density="console"
            locale={locale}
          />
          {when === "AT" ? (
            <DateField
              withTime
              label={copy.effectiveAt}
              name="effective_at"
              helper={copy.effectiveHelp}
              value={effective}
              onChange={(value) => setEffective(typeof value === "string" ? value : "")}
              {...(errors.effective !== undefined ? { error: errors.effective } : {})}
              required
              density="console"
              locale={locale}
            />
          ) : null}
          <Select
            label={copy.notice}
            name="notice_ref"
            helper={copy.noticeHelp}
            options={[{ value: "", label: copy.noticePh }, ...notices]}
            value={initial.notice}
            density="console"
            locale={locale}
          />
          <TextField label={copy.remedy} name="remedy" helper={copy.remedyHelp} value={remedy} onChange={setRemedy} required multiline rows={2} density="console" locale={locale} />
        </div>
        {!revoke ? (
          <>
            <Divider />
            <FieldRows
              legend={copy.conds}
              helper={copy.condsHelp}
              required
              addLabel={copy.addCond}
              onAdd={() => setConditions((before) => [...before, { code: "", text: "" }])}
              count={conditions.length}
              density="console"
              locale={locale}
            >
              {conditions.map((condition, index) => (
                <FieldRow
                  key={index}
                  title={copy.cond.replace("{n}", String(index + 1))}
                  columns={2}
                  density="console"
                  removable={conditions.length > 1}
                  onRemove={() => setConditions((before) => before.filter((_, at2) => at2 !== index))}
                  locale={locale}
                >
                  <TextField label={copy.condCode} value={condition.code} onChange={(value) => set(index, "code", value)} mono density="console" locale={locale} />
                  <TextField label={copy.condText} value={condition.text} onChange={(value) => set(index, "text", value)} multiline rows={2} density="console" locale={locale} />
                </FieldRow>
              ))}
            </FieldRows>
          </>
        ) : null}
        <Divider />
        <section aria-live="polite" style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {refusal !== null ? (
            <Banner family={refusal.family} title={refusal.title} code={refusal.code} level={2} density="console" locale={locale}>
              {refusal.text}
            </Banner>
          ) : null}
        </section>
        <ButtonRow>
          <Button variant="secondary" size="sm" disabled={!filled} {...(!filled ? { disabledReason: copy.fillFirst } : {})} onClick={() => setConfirming(true)} locale={locale}>
            {copy.record}
          </Button>
          <Button variant="quiet" size="sm" href={cancelHref} locale={locale}>
            {copy.cancel}
          </Button>
        </ButtonRow>
      </Panel>
      {confirming ? (
        <Dialog
          title={(when === "NOW" ? copy.dlgTitleNow : copy.dlgTitle)
            .replace("{action}", copy.actions[chosen])
            .replace("{premises}", premises)
            .replace("{ts}", at === null ? effective : (format.timestamp(at, locale) ?? effective))}
          description={when === "NOW" ? copy.dlgTextNow : copy.dlgText}
          primaryAction={{ label: copy.dlgYes[chosen], variant: "danger", loading: sending, onClick: () => startSending(() => form.current?.requestSubmit()) }}
          secondaryAction={{ label: copy.dlgNo, onClick: () => setConfirming(false) }}
          onClose={() => setConfirming(false)}
          open
          placement="overlay"
          align="start"
          density="console"
          width="var(--container-xl)"
          locale={locale}
        />
      ) : null}
    </form>
  );
}
