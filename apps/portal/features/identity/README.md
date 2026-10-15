# identity

The stand-ins for the RightOne ID pages (`app/(id)`): their server actions and the two client components
the pages need. RightOne ID itself is a separate product at id.rightone.vn; until the portal signs in
through it, these sign people in against the mock backend through `lib/api/identity.ts`.

    actions.ts              sign in, sign in with a provider, register, continue with an organisation
    layout.ts               the panel inset per frame, and the canvas's Client and Providers tweaks
    password-rules.ts       RightOne ID's four rules for a new password
    NewPasswordField.tsx    a password field whose rule checklist follows what is typed (client)
    OrganisationPicker.tsx  the organisation choice and the button it enables (client)
