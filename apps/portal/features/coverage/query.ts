import type { CoverageField, CoverageOptions, CoverageQuery, CoverageSearchParams } from "./types";

const PARAMS = {
  rightType: "right_type",
  repertoireKey: "repertoire_key",
  territoryCode: "territory_code",
  asOf: "as_of",
} as const;

export function readCoverageQuery(params: CoverageSearchParams): CoverageQuery | null {
  if (!Object.values(PARAMS).some((name) => params[name] !== undefined)) return null;
  const value = (name: string): string => typeof params[name] === "string" ? params[name] : "";
  return {
    rightType: value(PARAMS.rightType),
    repertoireKey: value(PARAMS.repertoireKey),
    territoryCode: value(PARAMS.territoryCode),
    asOf: value(PARAMS.asOf),
  };
}

export function coverageSearchParams(params: CoverageSearchParams): string {
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (typeof value === "string") search.append(name, value);
    else if (Array.isArray(value)) value.forEach((item) => search.append(name, item));
  }
  return search.toString();
}

export function coverageSearch(query: CoverageQuery, current: string): string {
  const search = new URLSearchParams(current);
  for (const field of Object.keys(PARAMS) as CoverageField[]) search.set(PARAMS[field], query[field].trim());
  return search.toString();
}

export function parseCoverageDate(value: string): string {
  const trimmed = value.trim();
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  const day = match?.[1];
  const month = match?.[2];
  const year = match?.[3];
  if (day === undefined || month === undefined || year === undefined) return trimmed;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function invalidCoverageFields(query: CoverageQuery, options: CoverageOptions): CoverageField[] {
  const fields: CoverageField[] = [];
  if (!options.rightTypes.some((value) => value === query.rightType)) fields.push("rightType");
  if (query.repertoireKey.trim() === "") fields.push("repertoireKey");
  if (!options.territories.some((value) => value === query.territoryCode)) fields.push("territoryCode");
  if (!isCalendarDate(query.asOf)) fields.push("asOf");
  return fields;
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000-")) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
