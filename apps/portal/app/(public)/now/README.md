# now

    [premises]/page.tsx            SCR-PLR-06  now playing, the guest's view, no account
    [premises]/actions/page.tsx    SCR-PLR-19  guest actions, the installed display's actions layout and the
                                               guest's phone page its code opens, no account

The guest display a room reads (any width but a phone's) and the same pages on a guest's phone, which the display's
code opens: the code on either display opens the guest actions (`/now/[premises]/actions`, D-PLY-06 in the Design
Brief). Both read the browser's world (`currentWorld`), by the premises id (`/now/pasteur`, `/now/ltt`), from the
same now-playing answer.
