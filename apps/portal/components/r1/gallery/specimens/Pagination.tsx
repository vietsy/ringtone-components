"use client";

import { Pagination } from "../..";
import type { Specimen } from "../specimen";

export const PaginationSpecimen: Specimen = {
  name: "Pagination",
  group: "Data",
  height: 180,
  render() {
    return (
      <div className="pv">
        <Pagination
          summary="11–20 trong 46 thiết bị"
          hasPrev={true}
          hasNext={true}
          pageSizes={[10, 25, 50]}
          pageSize={10}
        />
        <Pagination summary="41–46 trong 46 thiết bị" hasPrev={true} hasNext={false} />
        <Pagination summary="21–30 trong 46 thiết bị" hasPrev={true} hasNext={true} loading="next" />
      </div>
    );
  },
};
