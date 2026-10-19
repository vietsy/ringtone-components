# scope

    page.tsx    SCR-PUB-02  Scope self-assessment

The page asks the questions of the tariff in effect today, or, after an answer, of the tariff for the date the reader
stated (`GET /scope-questions`, the floor area required because the version's size bands use it, the seating capacity
asked for the exemption alone), and answers "Xem kết quả" in place:
`assessScope` (`features/public/actions.ts`) sends the facts to the mock backend's `POST /scope-assessments`,
which works the treatment out by `DR-491` from the tariff in `lib/mock/public.ts` (TV-2026.1 from 1 July
2026; none before 1 March 2026; TV-2026.0 in between, whose content the canvas does not write). The answer
and the facts as typed come back through `?attempt=`; the service keeps nothing declared.

"Việc tiếp theo" is the section of the scope guide in effect for the treatment (`IN_SCOPE`, `OUT_OF_SCOPE`,
`INDETERMINATE`, `DR-491`), its approved text: the guide is a page of the policy console (SCR-PUB-14 to 16). While no
version of the guide is in effect, as in the seed, where 2026.1 is a draft, the next action is the support route, and
the support line is drawn under the answer. The sentences below are the words of a guide in effect that says what the
canvas says.

What the answers can be, and what the page draws for each:

- In scope (a listed kind of premises in Ho Chi Minh City, the one area the canvas gives a locality class):
  the canvas's answer, every sentence filled from the answer's data; "Việc tiếp theo", "Đăng ký cơ sở với
  RightOne.", leads to signing in.
- Cannot be determined (no kind chosen, no area chosen, or an area the tariff gives no class): the same
  panel with the guidance word of `04-refusal-codes.md`, the class kind that decided it as the basis, and
  "Nộp đơn đăng ký; cán bộ RightOne sẽ quyết định." (SCR-PUB-03's words for the same section), which also
  leads to signing in. The board's helper for the kind of premises promises this answer; no view draws it.
- ASSESSMENT_INPUT_INVALID: the board's banner, the fields to correct marked, what was typed kept. A date
  that is not a date cannot be drawn back, since the date field takes only a calendar date.
- A date with no approved tariff: the board's no-rules state, no question and no button; the reader leaves
  it by reloading the page or by "Về RightOne".
- A date under TV-2026.0: the guidance cannot reach the tariff (`DR-491` row 1), drawn as the board's
  GUIDANCE_UNAVAILABLE state with the support line.

Every view the canvas drew is reachable as `?view=`: p1-not-offered, form, checking, in-scope,
input-invalid, no-rules-for-date, loading.

"Đi tiếp" holds "Về RightOne", "Xem biểu phí" (SCR-PUB-11) and "Trợ giúp" (SCR-PUB-12).

Deviations: the canvas's form opens filled
with its sample café; the live form opens empty on today's date, the province asked with a placeholder so
none is chosen for the reader. A failure other than GUIDANCE_UNAVAILABLE, which the canvas does not draw,
reads as the public error state of PUB convention 2.

Addition awaiting the BA: an in-scope answer carries "Ước tính số tiền phải trả với các thông tin này" /
"Estimate the amount to pay with these answers", a link to SCR-PUB-03 with the facts just answered in its
address (none of them personal), so the form opens filled. On the board SCR-PUB-03 is reached only from the
tariff page (SCR-PUB-11), whose "Số tiền tham khảo" opens it with an empty form.
