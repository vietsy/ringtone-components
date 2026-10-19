# preferences

    page.tsx   SCR-COM-12  notice preferences

One switch per class of the policy in force. A required class is marked Bắt buộc and shows a fixed switch with
"Chúng tôi buộc phải gửi loại này cho bạn." rather than a hidden row; Save waits until a switch has changed. The
preferences are a party's: a principal's own, or, opened from a notice with `?notice=`, those of the party the
notice was sent to. A recipient known only by the address they gave is offered the classes sent to a case's
raiser, all of them required. Save records or releases a suppression per changed class; a required class sent
off is refused SUPPRESSION_NOT_PERMITTED beside it, recorded, and nothing is written for it.

- The Required column of the wireframe is the switch's hint, and the Receive column its state.
