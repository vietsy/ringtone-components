/**
 * Messages by key, per locale. Vietnamese is the product language and English the second locale; a
 * screen's copy lives in a catalogue pair under `messages/`, never inline in a component.
 *
 * A key missing from a catalogue throws rather than rendering the key: a raw key on screen reads as a
 * finished label to the person in front of it, and `test/messages.test.ts` keeps the two locales'
 * keys identical, so a throw here is a defect caught before release.
 */
export type Locale = "vi" | "en";

export type Catalogue = Readonly<Record<string, string>>;

export interface Catalogues {
  vi: Catalogue;
  en: Catalogue;
}

export type Translate = (key: string, values?: Readonly<Record<string, string | number>>) => string;

export function translator(catalogues: Catalogues, locale: Locale): Translate {
  const table = catalogues[locale];
  return (key, values) => {
    const template = table[key];
    if (template === undefined) throw new Error(`No ${locale} message for ${key}`);
    if (values === undefined) return template;
    return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
      Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : whole,
    );
  };
}
