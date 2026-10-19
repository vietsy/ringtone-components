# recovery

    page.tsx             SCR-COM-08  the required notices with no delivered outcome, a depth per class
    [notice]/page.tsx    SCR-COM-09  record an alternative service of one notice, by its reference, or withdraw it

There is no "mark as delivered" control anywhere here, and the queue says why: only the delivery provider reports a
notice delivered; an officer who served it records the route, the date and their own name. The business approver
reads the queue too, to reach the notices they may close unserved (POST /notices/{id}/withdraw).
