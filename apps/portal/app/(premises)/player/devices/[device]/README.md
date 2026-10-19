# [device]

    page.tsx    SCR-PLR-04 venue view, and SCR-PLR-05 for a device whose offline limit was reached

One device, from GET /devices/{id}/venue-view: offline with the time left against DR-218's limit, online with
what plays and the period it is in (VEN's DR-15 at the report), at the evidence ceiling, or stopped at the limit
(SCR-PLR-05, which says it is a licence condition and not a fault), or stopped because nothing reaches it. The
evidence waiting is shown in every state.
Contact support opens SCR-CAS-01 with the device's reference; Close returns to the Player landing. A device of
another party is NOT_AUTHORISED. Views: refused, loading, error.

While the music plays, GET /sync/progress (`loadSyncProgress`) draws the synchronisation: a device receiving its next
snapshot reads "Trực tuyến, đang đồng bộ" with the share arrived, what is left and the tracks it brings, and keeps
playing from the snapshot it holds until all of it has (FR-PLR-014, 027); one whose transfer the connection cut says
where it resumes, never starting again; a settled device names the snapshot it holds. The device never acts in the
mock, so a connected device's transfer moves on each time the page is read and, once whole, the last synchronisation
is that moment. Pasteur's PLY-0023 is at 62 per cent, Lê Thánh Tôn's PLY-0031 stopped at 40 per cent when it went
offline. The offline limit is DR-218's for the session: the approved policy in force when the device lost contact,
else the snapshot's 72 hours, and the page says whose it is: the policy's version with its grace period or none, or
that no policy is approved yet. A delegate reads the venue view (PERM-502) and not the synchronisation, which PERM-481
gives the principal alone: for them the page says when the device last synchronised and draws no progress.

- PLR-05 is the same address as PLR-04: the specification declares no control on the venue view that opens it,
  so the device's state decides which screen is drawn.
- SCR-PLR-04 names no state for a device that nothing reaches. The page draws one: "Lúc này chưa có nhạc" (SCR-PLR-06's
  words for a display with nothing to play), why, and what brings the music back. The seam decides it from the two
  families that do: IAM's credential (held, revoked or none: stopped whether the device is connected or not, the
  revoked sentence is IAM's DEVICE_CREDENTIAL_REVOKED) and, for a connected device, VEN's service when it is not
  ACTIVE, in its state's word and shape (convention 7) and the effect sentence SCR-VEN-04 uses. An offline device
  plays on from what it holds, so the service does not stop it, and one past its limit stays SCR-PLR-05.
- Đa Kao holds no Player service, so its PLY-0035 at the evidence ceiling is drawn stopped ("Cơ sở chưa có dịch vụ
  Player"), as PLR's backend answers it; the ceiling view is built and no seeded device reaches it.
- The online view names the period from VEN's resolution (Trưa văn phòng, 11:00–13:30), where the board writes a
  "Giờ trưa" schedule 11:00–14:00 that VEN's seed does not hold.
