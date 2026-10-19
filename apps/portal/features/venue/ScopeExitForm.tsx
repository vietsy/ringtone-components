"use client";

import { useRef, useState, useTransition } from "react";
import { Button, ButtonRow, ChoiceList, DateField, Dialog, Divider, Panel, Select, TextField, format } from "@/components/r1";
import type { ScopeExitInput } from "@/lib/api/venue";
import type { Locale } from "@/lib/i18n/translate";
import { instantOfField } from "./instants";

export interface ScopeExitCopy {
  causeTitle: string;
  family: string;
  families: readonly { value: string; label: string }[];
  detail: string;
  detailPh: string;
  /** The details each family pairs with, as the Detail select offers them once the family is chosen. */
  details: Readonly<Record<string, readonly { value: string; label: string }[]>>;
  event: string;
  eventHelp: string;
  effective: string;
  effectiveHelp: string;
  evidence: string;
  evidenceHelp: string;
  record: string;
  cancel: string;
  fillFirst: string;
  /** "Kết thúc dịch vụ Player của {premises} do ngoài phạm vi từ {ts}, giờ Việt Nam?" */
  dlgTitle: string;
  dlgText: string;
  dlgYes: string;
  dlgNo: string;
}

/**
 * SCR-VEN-16's cause: the family whose event took the premises out of scope, the detail that family pairs with, the
 * event's own reference and instant, and the evidence. Record asks first; the confirmation says this is not a
 * revocation. A refusal comes back beside the field it names, the fields kept; recorded by legal, the fields stay as
 * sent and read only.
 */
export function ScopeExitForm({
  copy,
  premises,
  initial,
  errors,
  locked,
  lockedReason,
  action,
  cancelHref,
  locale,
}: {
  copy: ScopeExitCopy;
  premises: string;
  initial: ScopeExitInput;
  errors: Partial<Record<"detail" | "event" | "effectiveAt" | "evidence", string>>;
  /** Recorded, or ended: nothing more can be sent. */
  locked: boolean;
  /** ALREADY_ENDED's sentence while the service is terminal. */
  lockedReason: string | null;
  action: (formData: FormData) => Promise<void>;
  cancelHref: string;
  locale: Locale;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [family, setFamily] = useState(initial.family === "" ? "REG" : initial.family);
  const [detail, setDetail] = useState(initial.detail);
  const [event, setEvent] = useState(initial.event);
  const [effective, setEffective] = useState(initial.effectiveAt);
  const [evidence, setEvidence] = useState(initial.evidence);
  const [confirming, setConfirming] = useState(false);
  const [sending, startSending] = useTransition();
  const options = copy.details[family] ?? [];
  const filled = detail !== "" && event.trim() !== "" && instantOfField(effective) !== null && evidence.trim() !== "";
  const reason = lockedReason ?? (filled ? null : copy.fillFirst);
  const at = instantOfField(effective);

  return (
    <form ref={form} action={action} style={{ display: "contents" }}>
      <Panel title={copy.causeTitle} level={2} gap="xl" density="console" locale={locale}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", maxWidth: "var(--container-3xl)" }}>
          <ChoiceList
            legend={copy.family}
            name="cause_family"
            required
            options={[...copy.families]}
            value={family}
            onChange={(change) => {
              const next = (change as { target: { value: string } }).target.value;
              setFamily(next);
              // A detail belongs to one family: choosing another family asks for its detail again.
              if (!(copy.details[next] ?? []).some((option) => option.value === detail)) setDetail("");
            }}
            disabled={locked}
            layout="inline"
            density="console"
            locale={locale}
          />
          <Select
            key={family}
            label={copy.detail}
            name="cause_detail"
            options={[...options]}
            {...(detail !== "" ? { value: detail } : {})}
            placeholder={copy.detailPh}
            onChange={setDetail}
            {...(errors.detail !== undefined ? { error: errors.detail } : {})}
            required
            disabled={locked}
            density="console"
            locale={locale}
          />
          <TextField
            label={copy.event}
            name="cause_event_ref"
            helper={copy.eventHelp}
            value={event}
            onChange={setEvent}
            {...(errors.event !== undefined ? { error: errors.event } : {})}
            required
            mono
            disabled={locked}
            density="console"
            locale={locale}
          />
          <DateField
            withTime
            label={copy.effective}
            name="event_effective_at"
            helper={copy.effectiveHelp}
            value={initial.effectiveAt}
            onChange={(value) => setEffective(typeof value === "string" ? value : "")}
            {...(errors.effectiveAt !== undefined ? { error: errors.effectiveAt } : {})}
            required
            disabled={locked}
            density="console"
            locale={locale}
          />
          <TextField
            label={copy.evidence}
            name="evidence_ref"
            helper={copy.evidenceHelp}
            value={evidence}
            onChange={setEvidence}
            {...(errors.evidence !== undefined ? { error: errors.evidence } : {})}
            required
            disabled={locked}
            density="console"
            locale={locale}
          />
        </div>
        <Divider />
        <ButtonRow>
          {/* Recorded, Record is gone; Cancel stays, so whoever recorded it can leave the screen. */}
          {!locked || lockedReason !== null ? (
            <Button variant="secondary" size="sm" disabled={reason !== null} {...(reason !== null ? { disabledReason: reason } : {})} onClick={() => setConfirming(true)} locale={locale}>
              {copy.record}
            </Button>
          ) : null}
          <Button variant="quiet" size="sm" href={cancelHref} locale={locale}>
            {copy.cancel}
          </Button>
        </ButtonRow>
      </Panel>
      {confirming ? (
        <Dialog
          title={copy.dlgTitle.replace("{premises}", premises).replace("{ts}", at === null ? effective : (format.timestamp(at, locale) ?? effective))}
          description={copy.dlgText}
          primaryAction={{ label: copy.dlgYes, variant: "danger", loading: sending, onClick: () => startSending(() => form.current?.requestSubmit()) }}
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
