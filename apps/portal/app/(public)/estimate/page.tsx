import { redirect } from "next/navigation";
import { routes } from "@/lib/routes";

/** `/estimate`, SCR-PUB-03's entry address in the spec: the indicative amount, whose page lives at `/indicative-amount`. */
export default function EstimatePage(): never {
  redirect(routes.indicativeAmount());
}
