import { redirect } from "next/navigation";
import { routes } from "@/lib/routes";

/** `/mandates`, SCR-PUB-11's second entry address: the page of disclosures with the mandate list opened. */
export default function MandatesPage(): never {
  redirect(routes.disclosures({ open: "mandate-list" }));
}
