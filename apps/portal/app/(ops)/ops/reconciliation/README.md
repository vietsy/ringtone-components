# reconciliation

    page.tsx              SCR-PTY-14  reconciliation runs and differences
    exceptions/page.tsx   SCR-PTY-15  the exception queue, the exception opened under the table

The register data console ("Dữ liệu sổ đăng ký") of the party family: the data owner starts runs and works the
exceptions; assurance reads both, and the security admin works the exceptions (finding F-11). A run started here is
completed by the sweep a short while later, as the API's would be; nobody completes it by hand. Under the runs, the data
owner re-points the register to a new geography version where a published successor table leads to it (FR-PTY-040);
an area withdrawn with no successor keeps its premises and raises NO_SUCCESSOR_AREA on the exception queue.
