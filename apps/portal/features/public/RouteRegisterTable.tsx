"use client";

import { useRef, useState, type ComponentProps } from "react";
import { Button, Dialog, Table, TextField } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";

type TableProps = ComponentProps<typeof Table>;

/** What a row of the register lets the officer do, in words the server wrote. */
export interface RouteActs {
  /** The route's name for a screen reader ("Khiếu nại rightone.vn/khieu-nai"). */
  name: string;
  /** Null for a retired route, which takes no act. */
  confirm: boolean;
  editHref: string | null;
  retire: null | { disabledReason: string | null; title: string; description: string; confirm: string };
}

/**
 * SCR-PUB-18's register: Xác nhận sends at once, as the spec's Confirm needs no confirmation; Sửa opens the route's
 * form beside the list; Ngừng asks for the reason in a dialog naming the route and what the public pages show in its
 * place, and is refused in place for the last authoritative contact. Each act posts to its server action.
 */
export function RouteRegisterTable({
  columns,
  rows,
  acts,
  confirmAction,
  retireAction,
  words,
  table,
  locale,
}: {
  columns: TableProps["columns"];
  rows: Record<string, unknown>[];
  acts: Readonly<Record<string, RouteActs>>;
  confirmAction: (form: FormData) => Promise<void>;
  retireAction: (form: FormData) => Promise<void>;
  words: { confirm: string; edit: string; retire: string; reason: string; cancel: string; clear: string };
  table: { caption: string; sortNote: string; empty: { title: string; clearHref: string | null } };
  locale: Locale;
}) {
  const confirmForm = useRef<HTMLFormElement>(null);
  const retireForm = useRef<HTMLFormElement>(null);
  const [routeId, setRouteId] = useState("");
  const [retiring, setRetiring] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);

  function confirm(id: string) {
    setRouteId(id);
    const form = confirmForm.current;
    if (form === null) return;
    const field = form.elements.namedItem("route");
    if (field instanceof HTMLInputElement) field.value = id;
    form.requestSubmit();
  }

  const withActs = rows.map((row) => {
    const id = String(row._key);
    const act = acts[id];
    if (act === undefined) return row;
    const items = [
      ...(act.confirm ? [{ label: words.confirm, ariaLabel: `${words.confirm} ${act.name}`, variant: "secondary" as const, onClick: () => confirm(id) }] : []),
      ...(act.editHref !== null ? [{ label: words.edit, ariaLabel: `${words.edit} ${act.name}`, variant: "quiet" as const, href: act.editHref }] : []),
      ...(act.retire !== null
        ? [
            {
              label: words.retire,
              ariaLabel: `${words.retire} ${act.name}`,
              variant: "quiet" as const,
              ...(act.retire.disabledReason !== null ? { disabled: true, disabledReason: act.retire.disabledReason } : {}),
              onClick: () => {
                setReason("");
                setRetiring(id);
              },
            },
          ]
        : []),
    ];
    return { ...row, act: items };
  });
  const asked = retiring !== null ? acts[retiring]?.retire : null;

  return (
    <>
      <form ref={confirmForm} action={confirmAction} style={{ display: "none" }}>
        <input type="hidden" name="route" defaultValue={routeId} />
      </form>
      <form ref={retireForm} action={retireAction} style={{ display: "none" }}>
        <input type="hidden" name="route" value={retiring ?? ""} />
        <input type="hidden" name="reason" value={reason} />
      </form>
      <Table
        columns={columns}
        rows={withActs}
        density="console"
        caption={table.caption}
        rowFocus
        sortNote={table.sortNote}
        empty={{
          variant: "filtered",
          title: table.empty.title,
          action:
            table.empty.clearHref !== null ? (
              <Button variant="secondary" size="sm" href={table.empty.clearHref} locale={locale}>
                {words.clear}
              </Button>
            ) : (
              false
            ),
        }}
        locale={locale}
      />
      {asked !== null && asked !== undefined ? (
        <Dialog
          title={asked.title}
          description={asked.description}
          primaryAction={{
            label: asked.confirm,
            variant: "danger",
            loading: sending,
            onClick: () => {
              setSending(true);
              retireForm.current?.requestSubmit();
            },
          }}
          secondaryAction={{ label: words.cancel, onClick: () => setRetiring(null) }}
          onClose={() => setRetiring(null)}
          open
          placement="viewport"
          align="start"
          density="console"
          width="var(--container-lg)"
          locale={locale}
        >
          <TextField label={words.reason} value={reason} onChange={setReason} multiline rows={3} required density="console" locale={locale} />
        </Dialog>
      ) : null}
    </>
  );
}
