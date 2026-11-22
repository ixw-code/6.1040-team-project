import { httpWire } from "@mit-sdg/sync-engine-http/tooling";
import { assembleApplication } from "./src/assembly.ts";
import { policy } from "./src/http.ts";

export default {
  assemble: assembleApplication,
  title: "Shift Happens",
  wireName: "ShiftHappensWire",
  design: {
    version: 1,
    // Register application design documents as their concepts/compositions are implemented.
    documents: [new URL("./design/types.md", import.meta.url)],
  },
  projections: [httpWire({ policy, name: "ShiftHappensWireHttp" })],
};
