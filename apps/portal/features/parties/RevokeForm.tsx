"use client";

import { useState } from "react";
import { Banner, ChoiceList, DateField, FactList, Panel, TextField } from "@/components/r1";
import { Text } from "@/components/Text";
import type { AuthorityDetail, PartyAttempt } from "@/lib/api/parties";
import type { Locale } from "@/lib/i18n/translate";
import { ConfirmSubmit } from "./ConfirmSubmit";
import { count, joinNames, moment, partyTranslator, refusal, scopeWords } from "./copy";

const one = (value: string | readonly string[] | undefined): string => (typeof value === "string" ? value : "");

/**
 * SCR-PTY-13's revocation: from now or from a date and time, with a ground, and the sentence that acts performed while
 * the authority was effective stay valid and attributable (FR-PTY-017). Revoke asks first, naming the person, the
 * premises and the acts that stay valid. A backdated revocation over a performed act is refused naming the act, and
 * the refusal offers Revoke from now as a control, not as prose.
 */
export function RevokeForm({
  authority,
  action,
  attempt,
  phone,
  locale,
}: {
  authority: AuthorityDetail;
  action: (formData: FormData) => Promise<void>;
  attempt: PartyAttempt | null;
  phone: boolean;
  locale: Locale;
}) {
  const t = partyTranslator(locale);
  const values = attempt?.values ?? {};
  const failed = attempt?.refusal ?? null;
  const [effective, setEffective] = useState(one(values.effective) || "now");
  const [at, setAt] = useState(one(values.effective_at));
  const [ground, setGround] = useState(one(values.ground));
  const backdated = failed?.code === "REVOCATION_BACKDATED_OVER_PERFORMED_ACT" ? failed.values : null;
  const pending = authority.state === "PENDING_START";
  const acts = authority.acts.map((act) => t(`party.act.${act}`).toLocaleLowerCase());
  const when = effective === "at" && at !== "" ? moment(at, locale) : moment(authority.now, locale);

  /** Revoke from now, as the refusal offers it: the same ground, effective at the moment it is sent. */
  const fromNow = () => {
    const form = document.getElementById("revocation");
    if (!(form instanceof HTMLFormElement)) return;
    const choice = form.querySelector<HTMLInputElement>('input[name="effective"][value="now"]');
    if (choice !== null) choice.checked = true;
    form.requestSubmit();
  };

  return (
    <form id="revocation" action={action} noValidate>
      <Panel title={t(pending ? "pty13.formTitlePending" : "pty13.formTitle")} level={2} inset={phone ? "sm" : "md"} density="portal" locale={locale}>
        {pending ? (
          <Text size="base" measure="2xl">
            {t("pty13.pendingDetail")}
          </Text>
        ) : null}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          <ChoiceList
            legend={t("pty13.fEffective")}
            name="effective"
            options={[
              { value: "now", label: t("pty13.effNow"), helper: moment(authority.now, locale) },
              { value: "at", label: t("pty13.effAt") },
            ]}
            value={effective}
            onChange={(event) => {
              const target = (event as { target?: { value?: string } }).target;
              if (target?.value !== undefined) setEffective(target.value);
            }}
            required
            density="portal"
            locale={locale}
          />
          {effective === "at" ? (
            <DateField
              label={t("pty13.fAt")}
              name="effective_at"
              withTime
              {...(at !== "" ? { value: at } : {})}
              onChange={(value) => setAt(typeof value === "string" ? value : "")}
              {...(failed?.field === "effective_at" && failed.code === "FIELD_MISSING" ? { error: refusal(t, "FIELD_MISSING").text } : {})}
              required
              today={authority.now.slice(0, 10)}
              density="portal"
              locale={locale}
            />
          ) : null}
          {backdated !== null ? (
            <Banner
              family="attention"
              title={t(`party.performed.${backdated.act ?? ""}`, { person: backdated.person ?? authority.person, subject: backdated.subject ?? "", ts: moment(backdated.at ?? "", locale) })}
              code="REVOCATION_BACKDATED_OVER_PERFORMED_ACT"
              action={{ label: t("pty13.fromNow"), variant: "primary", onClick: fromNow }}
              density="portal"
              live
              locale={locale}
            >
              {t("party.refusal.REVOCATION_BACKDATED_OVER_PERFORMED_ACT.text")}
            </Banner>
          ) : null}
          <TextField
            label={t("pty13.fGround")}
            helper={t("pty13.fGroundHelp")}
            name="ground"
            value={ground}
            onChange={setGround}
            {...(failed?.code === "GROUND_REQUIRED" ? { error: refusal(t, "GROUND_REQUIRED").text } : {})}
            multiline
            rows={3}
            required
            width="100%"
            density="portal"
            locale={locale}
          />
          <Text size="base" measure="2xl">
            {t("pty13.actsStay")}
          </Text>
          <div style={{ display: "flex", flexDirection: phone ? "column" : "row", flexWrap: "wrap", alignItems: phone ? "stretch" : "flex-start", gap: "var(--space-2)" }}>
            <ConfirmSubmit
              formId="revocation"
              label={t("pty13.revoke")}
              variant="secondary"
              size="md"
              fullWidth={phone}
              dialog={{
                title: t("pty13.dlgTitle", { ref: authority.reference, person: authority.person }),
                description:
                  t("pty13.dlgText", { when, person: authority.person, acts: joinNames(acts, t), scope: scopeWords(authority.premises, t) }) +
                  " " +
                  (authority.performed.length > 0 ? t("pty13.dlgActs", { n: count(authority.performed.length, locale) }) : t("pty13.dlgNoActs")),
                confirm: t("pty13.dlgPrimary", { ref: authority.reference }),
                confirmVariant: "danger",
                back: t("pty13.dlgKeep"),
              }}
              density="portal"
              locale={locale}
            >
              <FactList
                items={[
                  { label: t("pty13.fEffective"), value: effective === "at" && at !== "" ? at : authority.now, kind: "datetime" },
                  { label: t("pty13.fGround"), value: ground, missing: t("party.notRecorded") },
                ]}
                density="portal"
                locale={locale}
              />
            </ConfirmSubmit>
          </div>
        </div>
      </Panel>
    </form>
  );
}
