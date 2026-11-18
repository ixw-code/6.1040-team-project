import { createHttpClient } from "@mit-sdg/sync-engine-http/client";
import type { ShiftHappensWireHttp } from "../../generated/wire.ts";

// Endpoint methods become available as backend endpoints are added and regenerated.
export const api = createHttpClient<ShiftHappensWireHttp>({ baseUrl: "/api" });
