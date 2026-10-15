# .github/rulesets

`main.json` is the branch ruleset this repository intends, ready to apply once the plan allows it:

    gh api -X POST /repos/phanlaw/rightone-web/rulesets --input .github/rulesets/main.json

## It cannot be applied today

The `phanlaw` organisation is on the **Free** plan, and branch protection on a **private**
repository needs Team or higher. Both the rulesets API and the older branch-protection API answer
403, and the Settings page is closed for the same reason - this is not something that can be
imported by hand instead.

So `main` is unprotected: anyone with write access can push to it. CODEOWNERS still requests review
from the right people; nothing requires that review before a merge.

## Two rules are deliberately absent

| Rule | Why it is out | Turn it on when |
|---|---|---|
| `required_signatures` | No commit here is signed. Requiring signatures would reject every push, including the one that fixes it | commit signing is set up for everyone with write access |
| `required_status_checks` | Actions runs fail before they start while the organisation is over its included minutes. Requiring them would mean nothing can ever merge | CI can actually run |
