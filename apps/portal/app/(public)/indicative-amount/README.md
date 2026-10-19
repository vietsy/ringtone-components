# indicative-amount

    page.tsx    SCR-PUB-03  Indicative amount

"Tính số tiền" submits to `calculateIndicativeAmount` (`features/public/actions.ts`), and the mock backend's
`POST /indicative-amounts` works the amount out by `DR-492` and TAR's `ALG-295` from the tariff in
`lib/mock/public.ts`: base amount, shares, the factors of the locality class, the kind of premises and the
floor-area band, the micro-business exemption, the cap, the rounding and the period of the transition rule.
The canvas's café (Ho Chi Minh City, 85 m², 40 seats, 30 September 2026) comes out at 4,554,000 VND for
1 October 2026 to 30 September 2027, as drawn. The answer and the facts as typed come back through
`?attempt=`; the service keeps nothing declared.

- An area with no locality class written (Hà Nội, Đà Nẵng, Cần Thơ, Huế) or no kind chosen: not shown to be
  in scope, so the board's no-amount state, never 0; its next step, "Nộp đơn đăng ký; cán bộ RightOne sẽ
  quyết định.", leads to signing in.
- Before 1 March 2026: NO_TARIFF_FOR_DATE. Under TV-2026.0, whose content the canvas does not write: the
  calculation cannot be made, TARIFF_UNAVAILABLE. Both above the form, as drawn.
- ASSESSMENT_INPUT_INVALID, which the board does not draw: SCR-PUB-02's banner and field errors.
- A bar of 250 m² reaches the cap; the cap line then says it was applied (new copy).

Every view the canvas drew is reachable as `?view=`: not-offered, guidance-not-offered, form, indicated,
no-amount, no-tariff-for-date, tariff-unavailable, loading.

The page is reached from SCR-PUB-11's "Số tiền tham khảo", and "Quay lại biểu phí" returns there.

Deviations: the not-offered refusal keeps its sentence "Bạn có thể xem biểu phí đang hiệu lực." verbatim; SCR-PUB-11
publishes the same tariff versions this page calculates under. The questions are one answer for both pages (`GET /scope-questions`), so the live form offers
the five provinces SCR-PUB-02 draws where this board draws three. The live form opens empty on today's date.
A failure the canvas does not draw reads as the public error state of PUB
convention 2.

Reached from SCR-PUB-02's in-scope answer (an addition awaiting the BA): the facts it carries in the address
(`assessment_date`, `premises_class`, `admin_area_key`, `floor_area_m2`, `seating_capacity`) fill the form;
a value the questions do not offer leaves its question open.
