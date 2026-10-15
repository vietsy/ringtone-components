# i18n

    translate.ts   translator(catalogues, locale): a message by key, with {name} values
    locale.ts      getLocale(): the reader's locale, from the cookie the shells' switch writes

The locale is read on the server before render, never toggled in the browser alone: the catalogue
is what makes an error code and a status label read correctly, so it has to be chosen first. The
switch in every shell writes the cookie and asks the router to render again.
