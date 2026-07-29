import React from "react";
import { Box } from "ink";
import type { CostRecord, CliFlags } from "../types.js";
import { QuickView } from "./QuickView.js";

interface AppProps {
  records: CostRecord[];
  flags: CliFlags;
}

export function App({ records, flags }: AppProps) {
  if (flags.interactive) {
    // Dashboard component added in Task 7
    return <QuickView records={records} flags={flags} />;
  }

  return (
    <Box flexDirection="column" paddingY={1}>
      <QuickView records={records} flags={flags} />
    </Box>
  );
}
