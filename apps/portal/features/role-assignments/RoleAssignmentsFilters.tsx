"use client";

import { useState } from "react";
import { Combobox, DateField, Select } from "@/components/r1";
import type { Locale, Translate } from "@/lib/i18n/translate";
import type { Frame } from "@/lib/view/frame";
import { isDateFieldText, isIsoDay } from "./state";
import {
  ASSIGNMENT_STATUSES,
  ROLE_IDS,
  type RoleAssignmentFilters,
  type RoleAssignmentsData,
} from "./types";
import styles from "./RoleAssignmentsFilters.module.css";

interface Props {
  filters: RoleAssignmentFilters;
  holders: RoleAssignmentsData["holders"];
  referenceDate: string;
  locale: Locale;
  t: Translate;
  frame: Frame;
  disabled: boolean;
  onChange: (key: keyof RoleAssignmentFilters, value: string | null) => void;
}

/** The URL is the filter source; invalid text stays local until it becomes a complete date. */
export function RoleAssignmentsFilters({
  filters,
  holders,
  referenceDate,
  locale,
  t,
  frame,
  disabled,
  onChange,
}: Props) {
  const [dateInvalid, setDateInvalid] = useState(false);
  const density = frame === "phone" ? "portal" : "console";

  return (
    <section
      className={styles.fields}
      data-frame={frame}
      aria-label={t("roleAssignments.a11y.filters")}
    >
      <div className={styles.role}>
        <Select
          label={t("roleAssignments.filters.role")}
          value={filters.role ?? ""}
          options={[
            { value: "", label: t("roleAssignments.filters.all") },
            ...ROLE_IDS.map((role) => ({
              value: role,
              label: t("roleAssignments.roles." + role),
            })),
          ]}
          onChange={(value) => onChange("role", value || null)}
          disabled={disabled}
          density={density}
          locale={locale}
        />
      </div>
      <div className={styles.holder}>
        <Combobox
          label={t("roleAssignments.filters.holder")}
          placeholder={t("roleAssignments.filters.everyone")}
          value={filters.holder ?? ""}
          options={[
            { value: "", label: t("roleAssignments.filters.everyone") },
            ...holders.map((holder) => ({
              value: holder.id,
              label: holder.name,
            })),
          ]}
          onChange={(value) => {
            if (typeof value === "string" || value === null)
              onChange("holder", value || null);
          }}
          noResults={t("roleAssignments.filters.noPeople")}
          disabled={disabled}
          density={density}
          locale={locale}
        />
      </div>
      <div className={styles.status}>
        <Select
          label={t("roleAssignments.filters.status")}
          value={filters.status ?? ""}
          options={[
            { value: "", label: t("roleAssignments.filters.all") },
            ...ASSIGNMENT_STATUSES.map((status) => ({
              value: status,
              label: t("roleAssignments.status." + status),
            })),
          ]}
          onChange={(value) => onChange("status", value || null)}
          disabled={disabled}
          density={density}
          locale={locale}
        />
      </div>
      <div className={styles.date}>
        <DateField
          label={t("roleAssignments.filters.effectiveOn")}
          value={filters.effectiveOn}
          today={referenceDate}
          onChange={(value) => {
            const valid = typeof value === "string" && isIsoDay(value);
            setDateInvalid(!valid);
            if (valid)
              onChange("effectiveOn", value === referenceDate ? null : value);
          }}
          onBlur={(event) => {
            if (
              typeof event === "object" &&
              event !== null &&
              "currentTarget" in event &&
              event.currentTarget instanceof HTMLInputElement
            ) {
              setDateInvalid(!isDateFieldText(event.currentTarget.value));
            }
          }}
          {...(dateInvalid
            ? { error: t("roleAssignments.filters.required") }
            : {})}
          required
          helper={false}
          disabled={disabled}
          density={density}
          locale={locale}
        />
      </div>
    </section>
  );
}
