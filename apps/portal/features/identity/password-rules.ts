/** The words of RightOne ID's four password rules, in the reader's language. */
export interface PasswordRuleTexts {
  length: string;
  cases: string;
  digit: string;
  symbol: string;
}

/**
 * RightOne ID's rules for a new password, each with whether the value meets it. The service checks them
 * again and adds the breach check; this is the checklist the reader sees while typing.
 */
export function passwordRules(password: string, texts: PasswordRuleTexts): { text: string; met: boolean }[] {
  return [
    { text: texts.length, met: password.length >= 12 },
    { text: texts.cases, met: /[A-Z]/.test(password) && /[a-z]/.test(password) },
    { text: texts.digit, met: /[0-9]/.test(password) },
    { text: texts.symbol, met: /[^A-Za-z0-9]/.test(password) },
  ];
}
