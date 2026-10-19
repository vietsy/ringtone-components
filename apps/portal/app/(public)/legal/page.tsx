import { redirect } from "next/navigation";
import { routes } from "@/lib/routes";

/** SCR-PUB-10 has no page of its own without a document: `/legal` opens the first one its list names. */
export default function LegalLibraryPage(): never {
  redirect(routes.legalDocument());
}
