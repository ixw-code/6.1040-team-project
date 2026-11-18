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
    // The setup currently assembles an empty application; design/ contains draft specs.
    documents: [],
  },
  projections: [httpWire({ policy, name: "ShiftHappensWireHttp" })],
};
