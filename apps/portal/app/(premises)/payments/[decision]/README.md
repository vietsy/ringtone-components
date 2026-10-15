# [decision]

    page.tsx   SCR-FIN-02  payment position of one obligation decision

Live: the latest payment made in the session for the decision, or the position the canvas drew for it.
Pasteur (`OBD-3FJW6NRA5C`) opens on its payment taken back (disputed); once the payer has authorised payment
again it waits for the new payment under that instruction, as the board's disputed drawing does, and once the
transfer or the card is settled it opens on the new payment, reconciled and invoiced. Nguyễn Huệ
(`OBD-8KWT2PZH6M`) opens on its reconciled transfer, Đa Kao (`OBD-4NPV8CRA2J`) on its second transfer held as
a duplicate. The canvas draws no payment for Lê Thánh Tôn's or Phan Xích Long's decision, so they have no
position to show (the not-found state). Check again reads the position afresh.

Review views: reconciled, disputed, pending on Pasteur; reconciled, failed on Nguyễn Huệ; duplicate,
in-suspense on Đa Kao; not-found, loading, error on any.

Before the payer authorises payment again there is no new instruction for the chargeback banner to open, so
its first action is the payment page itself, named by that page's title ("Pay the fee for decision {ref}";
"Pay a fee" on a phone). The board draws the banner only after the instruction exists.

Deviation awaiting the BA: a reconciled or paid payment also offers "Xem giấy xác nhận" / "Open the status
record" (SCR-CER-12). The design has no way from a paid fee to the record it unlocks, and the journey walks
that step (screen list workbook, sheet "Việc cần làm", B2).
