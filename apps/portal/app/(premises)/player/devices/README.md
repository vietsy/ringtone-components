# devices

    page.tsx            the Player devices of the premises the person acts for
    [device]/page.tsx   SCR-PLR-04 venue view, SCR-PLR-05 offline limit reached

No board draws the list; it is laid out as the Player landing and leads to each device and to the pairing screen.
A device that nothing reaches shows "Lúc này chưa có nhạc" with why under it (the service's state, or the device
suspended or revoked), as SCR-PLR-04 says it.
Its empty state is SCR-PLR-04's. Views: empty, loading, error.

- The devices are the PLR and IAM boards': Pasteur's PLY-0023 online, Lê Thánh Tôn's PLY-0031 offline, Đa Kao's
  PLY-0035 at the evidence ceiling (drawn stopped: Đa Kao holds no Player service), Bùi Viện's PLY-0038 stopped at its offline limit. They sit where the boards put
  them, which is not always a premises with a Player service (Lê Thánh Tôn's is paired before it enrols). No device
  reports in the mock, so each keeps the state of its last report (30 September, 12:36).
