"use client";

import { useRef, useState, useTransition } from "react";
import { Banner, Button, ButtonRow, DateField, Dialog, Divider, FieldRow, Panel, StatusLine, TextField, format } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";
import { instantOfField } from "./instants";

export interface ReinstatementCopy {
  condTitle: string;
  condHelp: string;
  evidence: string;
  has: string;
  none: string;
  effective: string;
  effectiveHelp: string;
  reinstate: string;
  cancel: string;
  /** "{n} trong {m} điều kiện chưa có bằng chứng." */
  missing: string;
  /** "Khôi phục dịch vụ Player của {premises} từ {ts}, giờ Việt Nam?" */
  dlgTitle: string;
  dlgText: string;
  dlgYes: string;
  dlgNo: string;
}

/**
 * SCR-VEN-15's form: one row per condition of the action being lifted, each with its evidence reference, and the
 * time the service is active again. Reinstate stays unavailable, saying how many conditions still have no evidence,
 * until every one has; it then asks first, naming the premises and the time. CONDITIONS_NOT_MET comes back above the
 * conditions, the evidence kept.
 */
export function ReinstatementForm({
  copy,
  premises,
  conditions,
  initialEvidence,
  initialEffective,
  refusal,
  blocked,
  action,
  cancelHref,
  locale,
}: {
  copy: ReinstatementCopy;
  premises: string;
  conditions: readonly { code: string; text: string }[];
  initialEvidence: Readonly<Record<string, string>>;
  initialEffective: string;
  refusal: { code: string; title: string; text: string } | null;
  /** NOT_REINSTATABLE: the state admits no reinstatement; the reason the control gives. */
  blocked: string | null;
  action: (formData: FormData) => Promise<void>;
  cancelHref: string;
  locale: Locale;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [evidence, setEvidence] = useState<Record<string, string>>(() => Object.fromEntries(conditions.map((condition) => [condition.code, initialEvidence[condition.code] ?? ""])));
  const [effective, setEffective] = useState(initialEffective);
  const [confirming, setConfirming] = useState(false);
  const [sending, startSending] = useTransition();
  const missing = conditions.filter((condition) => (evidence[condition.code] ?? "").trim() === "").length;
  const reason =
    blocked ??
    (missing > 0 ? copy.missing.replace("{n}", format.count(missing, locale) ?? String(missing)).replace("{m}", format.count(conditions.length, locale) ?? String(conditions.length)) : null);
  const at = instantOfField(effective);

  return (
    <form ref={form} action={action} style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {refusal !== null ? (
        <Banner family="attention" title={refusal.title} code={refusal.code} level={2} density="console" live locale={locale}>
          {refusal.text}
        </Banner>
      ) : null}
      {/* The conditions are the lifted action's, so a row is neither added nor removed here: R1's FieldRows would offer both. */}
      {conditions.length > 0 ? (
        <Panel variant="plain" level={2} title={copy.condTitle} description={copy.condHelp} gap="sm" density="console" locale={locale}>
          {conditions.map((condition) => {
            const given = (evidence[condition.code] ?? "").trim() !== "";
            return (
              <FieldRow key={condition.code} title={condition.text} columns={2} removable={false} density="console" locale={locale}>
                <StatusLine family={given ? "positive" : "attention"} text={given ? copy.has : copy.none} detail={condition.code} locale={locale} />
                <TextField
                  label={copy.evidence}
                  name={`evidence_${condition.code}`}
                  value={evidence[condition.code] ?? ""}
                  onChange={(value) => setEvidence((before) => ({ ...before, [condition.code]: value }))}
                  required
                  mono
                  disabled={blocked !== null}
                  density="console"
                  locale={locale}
                />
              </FieldRow>
            );
          })}
        </Panel>
      ) : null}
      <Divider />
      <div style={{ maxWidth: "var(--container-sm)" }}>
        <DateField
          withTime
          label={copy.effective}
          name="effective_at"
          helper={copy.effectiveHelp}
          value={initialEffective}
          onChange={(value) => setEffective(typeof value === "string" ? value : "")}
          required
          disabled={blocked !== null}
          density="console"
          locale={locale}
        />
      </div>
      <ButtonRow>
        <Button variant="primary" size="sm" disabled={reason !== null} {...(reason !== null ? { disabledReason: reason } : {})} onClick={() => setConfirming(true)} locale={locale}>
          {copy.reinstate}
        </Button>
        <Button variant="quiet" size="sm" href={cancelHref} locale={locale}>
          {copy.cancel}
        </Button>
      </ButtonRow>
      {confirming ? (
        <Dialog
          title={copy.dlgTitle.replace("{premises}", premises).replace("{ts}", at === null ? effective : (format.timestamp(at, locale) ?? effective))}
          description={copy.dlgText}
          primaryAction={{ label: copy.dlgYes, loading: sending, onClick: () => startSending(() => form.current?.requestSubmit()) }}
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
