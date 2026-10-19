# view

    frame.ts       getFrame(): desktop, tablet or phone, guessed on the server; ?frame= overrides it
    demo-view.ts   demoView(): with mock data, ?view= selects any state the design canvas drew

The frame is a guess from the user agent, so it may fold a page to one column (`Columns single`) but never holds two
columns open: a desktop browser can be narrow and iPad Safari names itself a Mac. Columns fold on their own width
(R1's `Columns`); beyond that the frame decides what a phone or a tablet gets in place of a desktop part, such as
cards for a table or a bar at the bottom.
