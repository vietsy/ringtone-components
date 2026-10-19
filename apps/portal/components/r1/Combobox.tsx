"use client";

import type * as React from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { keepRefs } from "./lib/button";
import { describedBy, fieldIconSize, fieldShell, readOnlyBox, sizedField } from "./lib/form-parts";
import { announce, cx, focusEl, fold, isNil, useSynced, useUid } from "./lib/helpers";
import { resultWords } from "./lib/search-and-pick";
import { tx } from "./lib/strings";
import type { FieldBase } from "./lib/types";

export type ComboboxProps = FieldBase & {
  options: {
    value: string;
    label: string;
    detail?: string | undefined;
    disabled?: boolean | undefined;
    reason?: string | undefined;
  }[];
  value?: string | string[] | undefined;
  onChange?: ((value: string | null | string[], option: unknown, e?: unknown) => void) | undefined;
  multiple?: boolean | undefined;
  chips?: boolean | undefined;
  allowCustom?: boolean | undefined;
  customLabel?: string | undefined;
  /** one choice: while not focused, a chosen label wider than the field is shown whole over several lines and the field grows */ wrap?:
    boolean | undefined;
  /** one choice: the chosen option's detail stays under the field and is read with it */ selectedDetail?:
    boolean | undefined;
  query?: string | undefined;
  open?: boolean | undefined;
  activeIndex?: number | undefined;
  loading?: boolean | undefined;
  noResults?: string | undefined;
  placeholder?: string | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

/** An option of the list, or (custom) the text the reader typed, offered as a value of its own. */
type ComboItem = ComboboxProps["options"][number] & { custom?: boolean | undefined };

// Type to narrow a long list, then pick one. The ARIA 1.2 combobox pattern: the input keeps focus,
// the active option is announced through aria-activedescendant. Loading and the number of matches are said
// once typing settles. multiple picks several: each pick keeps the list open, the choices show as removable
// chips under the field (or, with chips={false}, as a count inside it), and Backspace in an empty box removes
// the last one. onChange(value, option), or onChange(values, options) with multiple.
export function Combobox(p: ComboboxProps) {
  const t = tx(p.locale);
  const id = useUid("r1-combo");
  const listId = id + "-list";
  const opts = p.options || [];
  const multi = !!p.multiple;
  const vs = useSynced(multi ? undefined : (p.value as string | undefined), null);
  // The values of a multiple choice are compared by a string key, since the page builds the array afresh.
  const ks = useSynced(
    multi && !isNil(p.value) ? JSON.stringify(Array.isArray(p.value) ? p.value : [p.value]) : undefined,
    "[]",
  );
  const values: string[] = multi ? (JSON.parse(ks[0]) as string[]) : [];
  // allowCustom: a value the reader typed that is no option is still a value; it reads as itself.
  const custom = !!p.allowCustom;
  function byValue(v: string | null | undefined): ComboItem | undefined {
    const o = opts.filter(function (x) {
      return x.value === v;
    })[0];
    if (o || !custom || isNil(v) || v === "") return o;
    return { value: v, label: String(v), custom: true };
  }
  function customWords(text: string) {
    const w = p.customLabel || t.combo.custom;
    return w.indexOf("{text}") >= 0 ? w.replace("{text}", text) : w + " \u201c" + text + "\u201d";
  }
  const sel = multi ? null : byValue(vs[0]);
  const picked = values.map(byValue).filter(Boolean) as ComboItem[];
  const q = useSynced(p.query, sel ? sel.label : "");
  const lastVal = useRef(vs[0]);
  if (!multi && lastVal.current !== vs[0]) {
    lastVal.current = vs[0];
    if (sel && q[0] !== sel.label) q[1](sel.label);
  }
  const open = useState(!!p.open);
  const act = useState(isNil(p.activeIndex) ? -1 : p.activeIndex);
  const inputRef = useRef<HTMLInputElement>(null);
  const chipsRef = useRef<HTMLUListElement>(null);
  const refocus = useRef<number | null>(null);
  const query = q[0];
  const needle = query && !(sel && query === sel.label) ? fold(query).trim() : "";
  const shown = needle
    ? opts.filter(function (o) {
        return fold(o.label + " " + (o.detail || "")).indexOf(needle) >= 0;
      })
    : opts;
  // The typed text as the last option, while it is no option's label and not already chosen.
  const typed = String(query || "").trim();
  const customOpt: ComboItem | null =
    custom &&
    needle &&
    !opts.some(function (o) {
      return fold(o.label) === fold(typed);
    }) &&
    !(multi && values.indexOf(typed) >= 0)
      ? { value: typed, label: typed, custom: true }
      : null;
  const items: ComboItem[] = customOpt ? shown.concat([customOpt]) : shown;
  const isOpen = open[0] && !p.disabled && !p.readOnly;
  // wrap (one choice): while the field is not focused and the chosen label is wider than the field, the field shows
  // the whole label over as many lines as it needs and grows in height; focus brings back the one-line box to type
  // in. The input stays the one control and keeps the value; the wrapped copy is drawn for the eye only.
  const wrapOn = !!p.wrap && !multi;
  const focused = useState(false);
  const over = useState(false);
  const showWhole = wrapOn && over[0] && !focused[0] && !isOpen && !!sel && query === sel.label;
  // The label is measured only while the one-line box is drawn. In the whole form the input lies over the label drawn in
  // flow, so its width follows that label wherever the field is sized by its content: measured there, a label that fits
  // the grown box would switch the whole form off, the box would shrink, and the two would trade places without end.
  // Kept on, the whole form of a label that fits draws the same one line. The observer is made once per state, not per
  // render, and state is set only when the answer changes.
  const overNow = useRef(over[0]);
  overNow.current = over[0];
  const wholeNow = useRef(showWhole);
  wholeNow.current = showWhole;
  useLayoutEffect(
    function () {
      const el = inputRef.current;
      if (!wrapOn || !el) return undefined;
      function measure() {
        if (wholeNow.current) return;
        const o = el!.scrollWidth > el!.clientWidth;
        if (o !== overNow.current) {
          overNow.current = o;
          over[1](o);
        }
      }
      measure();
      if (typeof ResizeObserver === "undefined") return undefined;
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return function () {
        ro.disconnect();
      };
    },
    [wrapOn, showWhole, query],
  );
  const first = useRef(true);
  useEffect(
    function () {
      if (first.current) {
        first.current = false;
        return undefined;
      }
      if (!isOpen) return undefined;
      const tm = setTimeout(function () {
        announce(
          p.loading
            ? t.loading
            : shown.length
              ? resultWords(shown.length, t.combo)
              : customOpt
                ? customWords(typed)
                : p.noResults || t.combo.noResults,
        );
      }, 400);
      return function () {
        clearTimeout(tm);
      };
    },
    [isOpen, !!p.loading, shown.length, needle],
  );
  // After a chip is removed, focus goes to the chip that took its place, else the one before, else the box.
  useEffect(function () {
    if (refocus.current === null) return;
    const at = refocus.current;
    refocus.current = null;
    const chips = chipsRef.current ? chipsRef.current.querySelectorAll<HTMLElement>(".r1-combo__chip") : [];
    focusEl(chips.length ? chips[Math.min(at, chips.length - 1)] : inputRef.current);
  });
  function setValues(next: string[], e: unknown) {
    ks[1](JSON.stringify(next));
    if (p.onChange) p.onChange(next, next.map(byValue).filter(Boolean), e);
  }
  function toggle(o: ComboItem, e: unknown) {
    const on = values.indexOf(o.value) >= 0;
    setValues(
      on
        ? values.filter(function (v) {
            return v !== o.value;
          })
        : values.concat([o.value]),
      e,
    );
    announce((on ? t.combo.unpicked : t.combo.picked).replace("{label}", o.label));
  }
  function choose(o: ComboItem, e?: unknown) {
    if (multi) {
      toggle(o, e);
      if (o.custom) {
        q[1]("");
        act[1](-1);
      }
      return;
    }
    vs[1](o.value);
    q[1](o.label);
    open[1](false);
    act[1](-1);
    if (p.onChange) p.onChange(o.value, o, e);
  }
  // Leaving the field never leaves text that disagrees with the choice: an exact match is taken,
  // an emptied field clears the choice, anything else goes back to the chosen label.
  // With multiple, the typed text is only a filter and is cleared.
  function settle() {
    open[1](false);
    act[1](-1);
    if (multi) {
      if (query) q[1]("");
      return;
    }
    if (sel && query === sel.label) return;
    if (!query.trim()) {
      if (sel) {
        vs[1](null);
        if (p.onChange) p.onChange(null, null);
      }
      q[1]("");
      return;
    }
    const same = opts.filter(function (o) {
      return fold(o.label) === fold(query).trim();
    })[0];
    const exact = same && !same.disabled ? same : null;
    // With allowCustom, text that is no option is taken as typed; the label of an option that cannot be picked is not.
    if (exact) choose(exact);
    else if (custom && !same) choose({ value: query.trim(), label: query.trim(), custom: true });
    else q[1](sel ? sel.label : "");
  }
  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      open[1](true);
      const n = items.length;
      if (!n) return;
      act[1]((act[0] + (e.key === "ArrowDown" ? 1 : n - 1) + (act[0] < 0 && e.key === "ArrowUp" ? 1 : 0)) % n);
    } else if (e.key === "Enter" && isOpen && act[0] >= 0 && items[act[0]] && !items[act[0]]!.disabled) {
      e.preventDefault();
      choose(items[act[0]]!, e);
    } else if (e.key === "Enter" && isOpen && act[0] < 0 && customOpt) {
      e.preventDefault();
      choose(customOpt, e);
    } else if (e.key === "Escape") {
      if (isOpen) open[1](false);
      else if (multi && query) q[1]("");
    } else if (e.key === "Backspace" && multi && !query && picked.length) {
      toggle(picked[picked.length - 1]!, e);
    }
  }
  // selectedDetail (one choice): the chosen option's detail stays under the field once it is picked (a decision's amount
  // and due date), as the open list showed it, and is read with the field. While the reader types something else, the
  // field no longer shows that choice and the line waits until it does again.
  const chosenId = id + "-chosen";
  const chosenDetail =
    p.selectedDetail &&
    !multi &&
    sel &&
    !isNil(sel.detail) &&
    sel.detail !== "" &&
    (p.readOnly || query === sel.label) ? (
      <div id={chosenId} className="r1-combo__chosen">
        {keepRefs(sel.detail)}
      </div>
    ) : null;
  if (p.readOnly) {
    const shownValue = multi
      ? picked.length
        ? picked
            .map(function (o) {
              return o.label;
            })
            .join(", ")
        : "–"
      : sel
        ? sel.label
        : "–";
    return fieldShell(
      p,
      id,
      <div className="r1-field__control">{readOnlyBox(p, id, shownValue, null, chosenDetail ? chosenId : null)}</div>,
      chosenDetail,
    );
  }
  const size = fieldIconSize(p);
  const countMode = multi && p.chips === false;
  const list = isOpen ? (
    <ul
      id={listId}
      role="listbox"
      className={cx("r1-combo__list", multi && "r1-combo__list--multi")}
      aria-label={p.label}
      aria-multiselectable={multi ? "true" : undefined}
    >
      {p.loading ? (
        <li className="r1-combo__note" role="presentation">
          <Icon name="loader-circle" size={16} spin={true} />
          <span>{t.loading}</span>
        </li>
      ) : items.length ? (
        items.map(function (o, i) {
          if (o.custom) {
            return (
              <li
                key="&#x1;custom"
                id={listId + "-" + i}
                role="option"
                aria-selected="false"
                className={cx("r1-combo__opt r1-combo__opt--custom", i === act[0] && "r1-combo__opt--active")}
                onMouseDown={function (e) {
                  e.preventDefault();
                  choose(o, e);
                }}
              >
                <Icon name="plus" size={16} className="r1-combo__plus" />
                <span className="r1-combo__text">
                  <span className="r1-combo__label">{customWords(o.value)}</span>
                </span>
              </li>
            );
          }
          const on = multi ? values.indexOf(o.value) >= 0 : o.value === vs[0];
          return (
            <li
              key={o.value}
              id={listId + "-" + i}
              role="option"
              aria-selected={on ? "true" : "false"}
              aria-disabled={o.disabled ? "true" : undefined}
              className={cx(
                "r1-combo__opt",
                i === act[0] && "r1-combo__opt--active",
                on && "r1-combo__opt--selected",
                o.disabled && "r1-combo__opt--disabled",
              )}
              onMouseDown={function (e) {
                e.preventDefault();
                if (!o.disabled) choose(o, e);
              }}
            >
              {multi ? (
                <span className="r1-combo__box" aria-hidden="true">
                  {on ? <Icon name="check" size={12} strokeWidth={3} /> : null}
                </span>
              ) : null}
              <span className="r1-combo__text">
                <span className="r1-combo__label">{o.label}</span>
                {o.detail ? (
                  <span className="r1-combo__detail">{o.disabled && o.reason ? o.reason : o.detail}</span>
                ) : o.disabled && o.reason ? (
                  <span className="r1-combo__detail">{o.reason}</span>
                ) : null}
              </span>
              {on && !multi ? <Icon name="check" size={16} className="r1-combo__check" /> : null}
            </li>
          );
        })
      ) : (
        <li className="r1-combo__note" role="presentation">
          {p.noResults || t.combo.noResults}
        </li>
      )}
    </ul>
  ) : null;
  const countText = t.combo.count.replace("{n}", String(picked.length));
  const control = (
    <div
      className={cx(
        "r1-combo",
        isOpen && "r1-combo--open",
        countMode && picked.length && "r1-combo--count",
        showWhole && "r1-combo--whole",
      )}
    >
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        className="r1-input r1-combo__input"
        value={query}
        placeholder={p.placeholder}
        disabled={p.disabled}
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={isOpen ? "true" : "false"}
        aria-controls={listId}
        aria-activedescendant={isOpen && act[0] >= 0 ? listId + "-" + act[0] : undefined}
        aria-invalid={p.error ? "true" : undefined}
        aria-busy={p.loading ? "true" : undefined}
        aria-describedby={
          [describedBy(p, id), countMode && picked.length ? id + "-count" : null, chosenDetail ? chosenId : null]
            .filter(Boolean)
            .join(" ") || undefined
        }
        required={p.required && !(multi && picked.length)}
        onChange={function (e) {
          q[1](e.target.value);
          open[1](true);
          act[1](-1);
        }}
        onFocus={function () {
          open[1](true);
          if (wrapOn) focused[1](true);
        }}
        onBlur={function () {
          if (wrapOn) focused[1](false);
          settle();
        }}
        onKeyDown={onKey}
      />
      {showWhole ? (
        <span className="r1-combo__whole" aria-hidden="true">
          {sel.label}
        </span>
      ) : null}
      {p.name ? (
        multi ? (
          values.map(function (v) {
            return <input key={v} type="hidden" name={p.name} value={v} />;
          })
        ) : (
          <input type="hidden" name={p.name} value={isNil(vs[0]) ? "" : vs[0]} />
        )
      ) : null}
      {countMode && picked.length ? (
        <span className="r1-combo__end">
          <span id={id + "-count"} className="r1-combo__count r1-num">
            {countText}
          </span>
          {p.disabled ? null : (
            <button
              type="button"
              className="r1-combo__clear"
              aria-label={t.combo.clearAll}
              onClick={function (e) {
                setValues([], e);
                announce(t.combo.count.replace("{n}", "0"));
                focusEl(inputRef.current);
              }}
            >
              <Icon name="x" size={size} />
            </button>
          )}
        </span>
      ) : null}
      <Icon name="chevron-down" size={size} className="r1-select__chev" />
      {list}
    </div>
  );
  const chips =
    multi && !countMode && picked.length ? (
      <ul ref={chipsRef} className="r1-combo__chips" aria-label={t.combo.chosen}>
        {picked.map(function (o, i) {
          return (
            <li key={o.value}>
              <button
                type="button"
                className="r1-chip r1-combo__chip"
                disabled={p.disabled}
                aria-label={t.combo.remove.replace("{label}", o.label)}
                onClick={function (e) {
                  refocus.current = i;
                  toggle(o, e);
                }}
              >
                <span>{o.label}</span>
                <Icon name="x" size={16} />
              </button>
            </li>
          );
        })}
        {picked.length > 1 && !p.disabled ? (
          <li key="*">
            <button
              type="button"
              className="r1-combo__clearall"
              onClick={function (e) {
                setValues([], e);
                announce(t.combo.count.replace("{n}", "0"));
                focusEl(inputRef.current);
              }}
            >
              {t.combo.clearAll}
            </button>
          </li>
        ) : null}
      </ul>
    ) : null;
  return fieldShell(
    sizedField(p),
    id,
    <div className="r1-field__control" style={p.width ? { maxWidth: p.width } : undefined}>
      {control}
      {chips}
    </div>,
    chosenDetail,
  );
}
