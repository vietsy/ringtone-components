# reset

    route.ts    GET /id/reset  the sample data back to its seed, for this browser only

The link "Đặt lại dữ liệu mẫu" at the foot of every page while the portal runs on mock data. The browser's world
(cookie `r1-world`) returns to the seed, the session ends and the reader lands on sign-in; other browsers keep their
own worlds. Signing out does not reset anything: actions taken under one account stay visible to the next person who
signs in on the same browser, which is how a journey across people is walked.
