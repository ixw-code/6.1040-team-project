import { httpWire } from "@mit-sdg/sync-engine-http/tooling";
import { assembleApplication } from "./src/assembly.ts";
import { policy } from "./src/http.ts";

export default {
  assemble: assembleApplication,
  title: "Shift Happens",
  wireName: "ShiftHappensWire",
  design: {
    version: 1,
    documents: [
      new URL("./design/types.md", import.meta.url),
      new URL("./design/compositions/Users.md", import.meta.url),
      new URL("./design/compositions/HouseholdManagement.md", import.meta.url),
      new URL("./design/compositions/ChoreAssignments.md", import.meta.url),
    ],
  },
  projections: [httpWire({ policy, name: "ShiftHappensWireHttp" })],
};
