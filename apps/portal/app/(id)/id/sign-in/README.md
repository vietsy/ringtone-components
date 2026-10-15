# sign-in

    page.tsx    SCR-RID-01  Sign in

The page draws the reader's own last attempt (`?attempt=`, kept by the action) or an empty form. For
design review every view the canvas drew is reachable as `?view=`: form, field-error, submitting,
invalid, locked, suspended, unconfirmed, session-expired, reauth, external-failed, external-unverified,
account-deleted, error. With mock data `?client=none` draws RightOne ID's own sign-in (no application in
the address) and `?providers=all|none` the canvas's Providers tweak; the default is RightOne and Google.

"Đăng nhập" submits to `signIn`, which checks the account: a principal goes on to SCR-RID-04, an inspector
to the field client; a refusal comes back here with the address kept and the password not. Five wrong
passwords lock the account for twelve minutes. "Đăng nhập với Google" submits to `signInWithProvider`; the
mock has no provider, so it is answered as a provider sign-in that could not be completed.

Left out: "Quên mật khẩu?" (RID-05) and the "Gửi lại email xác nhận" action of the unconfirmed banner
(RID-09), whose sentence keeps "hoặc gửi lại thư" as the canvas words it. In "Sau bước này, RightOne ID
hỏi mã xác thực hai lớp nếu bạn đã bật, rồi hỏi tổ chức ..." the two-factor link (RID-02) is dropped and
its words kept, which still read true; "tổ chức" links to SCR-RID-04. The locked banner's minutes and
time are worked out from the answer's instants (12 minutes, 10:27).
