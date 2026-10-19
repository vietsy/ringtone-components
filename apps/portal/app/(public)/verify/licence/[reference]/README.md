# [reference]

    page.tsx    SCR-PUB-07  Direct-licence and proof verification, for a licence

The page is `features/public/DirectRecordVerification.tsx`, shared with `verify/proof/[reference]`; the address
names the one route read, never both, since each absence counts toward the pattern control. LIC offers no public
reader yet (`CR-PUB-02`), so a reference admitted past the refusals (an empty one, a list or a wildcard; too many
lookups; anything but 1 to 64 of `[A-Za-z0-9._-]`) answers that the service could not tell, with the cause
"Việc kiểm tra loại hồ sơ này chưa được cung cấp.", never that no record exists. "Tra cứu mã khác" opens SCR-PUB-04
for a licence or proof.

`?view=` shows any view the canvas drew: licence-unable (P1's), proof-unable, checking, identifier-not-accepted,
rate-limited, error.

Left out: "Mở bản ghi" (SCR-PUB-09), shown only for a licence answered with its track, which no licence is until
LIC offers its reader.
