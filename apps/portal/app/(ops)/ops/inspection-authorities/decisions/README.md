# decisions

    page.tsx   SCR-VER-10  Decide a designation

The designations waiting, oldest first, and the one opened (`?designation=`, the oldest by default) with its facts,
document, recorder and the decision form. Approve asks for confirmation; Refuse needs a reason. DR-746 decides who
may: whoever recorded it sees SEGREGATION_REQUIRED and the controls unavailable, a reader without ACT-BIZ-APR sees
NOT_AUTHORISED; the server checks both again. The decision just recorded is said above the list (`?decided=`).
