"use client";

import { Component, useEffect, useState, type ReactNode } from "react";
import { Banner, Divider, NavList, PageHeader } from "@/components/r1";
import { Text } from "@/components/Text";
import type { Locale } from "@/lib/i18n/translate";
import "./generated/gallery.css";
import { SPECIMENS } from "./generated/gallery.js";

/** The order the groups are read in: what a screen is built from first, the appliance surfaces last. */
const GROUP_ORDER = ["Actions", "Forms", "Values", "Status", "Feedback", "Data", "Page", "Flows", "Shells", "Legal", "Operations", "Media", "Player", "Icons"];

export interface GalleryLabels {
  title: string;
  /** "{count} components, ..." - the count is filled in here. */
  meta: string;
  jump: string;
  /** Said for a specimen that failed to render, with its name. */
  failed: string;
  groups: Readonly<Record<string, string>>;
}

/**
 * Every component of the design system R1, in the states its own specimen draws, rendered by the portal's
 * generated copy. It renders after mount: one specimen reads the page's computed tokens, which the server
 * does not have, and a developer page has no reason to be server-rendered.
 */
export function Gallery({ labels, locale }: { labels: GalleryLabels; locale: Locale }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const groups = [...new Set(SPECIMENS.map((s) => s.group))].sort(
    (a, b) => rank(a) - rank(b) || a.localeCompare(b),
  );

  return (
    <main style={{ boxSizing: "border-box", maxWidth: "var(--content-max)", margin: "0 auto", padding: "var(--space-8) var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
      <PageHeader title={labels.title} meta={labels.meta.replace("{count}", String(SPECIMENS.length))} size="public" locale={locale} />
      <NavList
        title={labels.jump}
        items={groups.map((group) => ({ label: labels.groups[group] ?? group, href: `#group-${group}` }))}
        locale={locale}
      />
      {mounted &&
        groups.map((group) => (
          <section key={group} id={`group-${group}`} aria-labelledby={`group-${group}-title`} style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <Text as="h2" id={`group-${group}-title`} size="lg" weight="semibold">
              {labels.groups[group] ?? group}
            </Text>
            {SPECIMENS.filter((s) => s.group === group).map((specimen) => (
              <article
                key={specimen.name}
                id={specimen.name}
                style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}
              >
                <Divider />
                <Text as="h3" size="base" weight="semibold">
                  {specimen.name}
                </Text>
                <div data-r1-preview={specimen.name} style={{ position: "relative" }}>
                  <SpecimenBoundary failed={labels.failed.replace("{name}", specimen.name)} locale={locale}>
                    {specimen.render()}
                  </SpecimenBoundary>
                </div>
              </article>
            ))}
          </section>
        ))}
    </main>
  );
}

function rank(group: string): number {
  const at = GROUP_ORDER.indexOf(group);
  return at === -1 ? GROUP_ORDER.length : at;
}

/** One specimen that throws is reported in its own card; the others still render. */
class SpecimenBoundary extends Component<{ failed: string; locale: Locale; children: ReactNode }, { error: string | null }> {
  override state: { error: string | null } = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) };
  }

  override render() {
    if (this.state.error === null) return this.props.children;
    return (
      <Banner family="danger" title={this.props.failed} locale={this.props.locale}>
        {this.state.error}
      </Banner>
    );
  }
}
