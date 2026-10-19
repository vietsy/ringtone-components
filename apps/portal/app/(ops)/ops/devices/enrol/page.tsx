import { PageHeader, ViewState } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { day, plropsTranslator, refusalWords } from "@/features/player-ops/copy";
import { EnrolForm, type SupplierChoice } from "@/features/player-ops/EnrolForm";
import { Failure } from "@/features/player-ops/Failure";
import { readForPage } from "@/lib/api/flash";
import { loadDeviceRecord, loadEnrolForm, type EnrolAttempt, type SupplierCertification } from "@/lib/api/player";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { PLR03_VIEWS } from "@/lib/mock/player";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-PLR-03 Enrol a device, for a device that already holds the identity on its label: the supplier, and the
 * premises with a Player service it will serve. The device is Newly enrolled and accepts no evidence until its
 * supplier holds a current certification and it is paired with the premises, which the steps beside the form show. An
 * identity already enrolled is refused naming the device that holds it and the premises it is enrolled at.
 */
export default async function EnrolDevicePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-OPS");
  const query = await searchParams;
  const locale = await getLocale();
  const t = plropsTranslator(locale);
  const view = reviewView(query, PLR03_VIEWS);
  const attempt = readForPage<EnrolAttempt>(query);
  const mine = attempt?.page === "enrol" ? attempt : null;
  const outcome = view === "loading" ? null : await loadEnrolForm(staff, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const refused = mine?.code ?? null;
  // DEVICE_ALREADY_ENROLLED names the device holding the identity; its record names the premises it is enrolled at.
  const holder = refused === "DEVICE_ALREADY_ENROLLED" && mine !== null && mine.existing !== null ? (await loadDeviceRecord(staff, mine.existing, null)).data : null;

  return (
    <OpsFrame console="operations" current="devices" staff={staff} searchLabel={t("plrops.search")} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[{ label: t("plrops.area") }, { label: t("plr01.title"), href: routes.opsDevices() }, { label: t("plr03.title") }]}
          title={t("plr03.title")}
          meta={t("plr03.lead")}
          locale={locale}
        />
        {view === "loading" ? <ViewState view="loading" skeleton="facts" rows={4} density="console" locale={locale} /> : null}
        {failure !== null ? <Failure failure={failure} errorText={t("plr03.errText")} prefix="plrops" t={t} locale={locale} /> : null}
        {data !== null ? (
          <EnrolForm
            // Each answer opens the form afresh with what was typed for it.
            key={typeof query.attempt === "string" ? query.attempt : ""}
            suppliers={data.suppliers.map((supplier) => supplierChoice(supplier, t, locale))}
            premises={data.premises.map((premises) => ({ value: premises.id, label: premises.name, detail: premises.area }))}
            initial={mine?.values ?? null}
            errors={{
              identity: mine?.field === "identity" ? t("plr03.idInvalid") : null,
              supplier: mine?.field === "supplier" ? t("plr03.supplierInvalid") : null,
              premises: mine?.field === "premises" ? t("plr03.premisesInvalid") : null,
            }}
            refusal={
              refused === null
                ? null
                : refused === "DEVICE_ALREADY_ENROLLED" && mine !== null && mine.existing !== null
                  ? {
                      code: refused,
                      title:
                        holder !== null
                          ? t("plr03.refTitleAt", { i: mine.values.identity, p: holder.premises.name, d: mine.existing })
                          : t("plr03.refTitle", { i: mine.values.identity, d: mine.existing }),
                      text: t("plrops.refusal.DEVICE_ALREADY_ENROLLED"),
                      action: { label: t("plr03.refOpen", { d: mine.existing }), href: routes.opsDevice(mine.existing) },
                    }
                  : { code: refused, ...refusalWords(refused, t, "plrops"), action: null }
            }
            cancelHref={routes.opsDevices()}
            words={{
              device: t("plr03.device"),
              idLabel: t("plr03.idLabel"),
              idHelp: t("plr03.idHelp"),
              supplier: t("plr03.supplier"),
              chooseSupplier: t("plr03.chooseSupplier"),
              premises: t("plr03.premises"),
              choosePremises: t("plr03.choosePremises"),
              noPremises: t("plr03.noPremises"),
              enrol: t("plr03.enrol"),
              cancel: t("plr03.cancel"),
              needAll: t("plr03.needAll"),
              needPremises: t("plr03.needPremises"),
              nextTitle: t("plr03.nextTitle"),
              nextText: t("plr03.nextText"),
              steps: [t("plr03.stepEnrolled"), t("plr03.stepCert"), t("plr03.stepPaired"), t("plr03.stepActive")],
            }}
            locale={locale}
          />
        ) : null}
      </div>
    </OpsFrame>
  );
}

/** A supplier and the line under the field: certified until when, or why its devices stay Newly enrolled. */
function supplierChoice(supplier: SupplierCertification, t: Translate, locale: Locale): SupplierChoice {
  const name = supplier.supplier;
  if (supplier.status === "CERTIFIED") {
    return { value: name, label: name, certified: true, line: { family: "positive", text: t("plr03.suppOk", { s: name, d: day(supplier.validTo ?? "", locale) }), detail: null } };
  }
  const detail =
    supplier.status === "REFUSED"
      ? t("plr03.suppRefused", { d: day(supplier.decidedOn ?? "", locale), c: supplier.criterion ?? "" })
      : supplier.status === "EXPIRED"
        ? t("plr03.suppExpired", { d: day(supplier.validTo ?? "", locale) })
        : supplier.status === "WITHDRAWN"
          ? t("plr03.suppWithdrawn", { d: day(supplier.decidedOn ?? "", locale) })
          : t("plr03.suppOpen");
  return { value: name, label: name, certified: false, line: { family: "attention", text: t("plr03.suppNone", { s: name }), detail } };
}
