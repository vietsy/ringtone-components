import type * as React from "react";

/** One component of the gallery: its name, the group it is listed under, the height it needs, and its states. */
export interface Specimen {
  name: string;
  group: string;
  height: number;
  render: () => React.ReactElement;
}
