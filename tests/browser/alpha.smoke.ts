import assert from "node:assert/strict";
import { MongoClient } from "mongodb";
import { chromium, type Browser, type Page } from "playwright";
import { mondayOf, weekdays } from "../../src/shared/assignmentDates.ts";

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) throw new Error("Set MONGODB_URI before running the browser test.");
const mongo = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 3000 });
const database = mongo.db(`alpha_browser_test_${crypto.randomUUID()}`);
const databaseUrl = new URL(mongoUri);
if (!databaseUrl.searchParams.has("authSource") && mongo.options.credentials) {
  databaseUrl.searchParams.set("authSource", mongo.options.credentials.source);
}
databaseUrl.pathname = `/${database.databaseName}`;

function freePort() {
  const listener = Bun.listen({ hostname: "127.0.0.1", port: 0, socket: { data() {} } });
  const { port } = listener;
  listener.stop();
  return port;
}

const backendPort = freePort();
let frontendPort = freePort();
while (frontendPort === backendPort) frontendPort = freePort();
const origin = `http://localhost:${frontendPort}`;
const backend = `http://127.0.0.1:${backendPort}`;
const env = { ...process.env, HOST: "127.0.0.1", MONGODB_URI: databaseUrl.href, PORT: String(backendPort),
  PUBLIC_ORIGIN: origin, BACKEND_ORIGIN: backend };
const services: Bun.Subprocess[] = [];

async function start(args: string[], url: string) {
  const child = Bun.spawn([process.execPath, ...args], { env, stdout: "ignore", stderr: "inherit" });
  services.push(child);
  const timeout = Date.now() + 15_000;
  while (child.exitCode === null && Date.now() < timeout) {
    const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(1000) }).catch(() => undefined);
    if (response?.ok) return;
    await Bun.sleep(100);
  }
  throw new Error(`Test service at ${url} failed to start.`);
}

const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const label = (page: Page, name: string) => page.getByLabel(name, { exact: true });
const visibleText = (page: Page, value: string) => page.getByText(value, { exact: true }).waitFor();
const image = { name: "evidence.png", mimeType: "image/png", buffer: Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l2QAAAAASUVORK5CYII=", "base64",
) };
const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const base = new Date();
function dateAt(offset: number) {
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + offset));
}
const dateInput = (offset: number) => dateAt(offset).toISOString().slice(0, 10);

async function register(page: Page, username: string) {
  await page.goto(origin);
  await button(page, "Create an account").click();
  await page.getByLabel(/Username/).fill(username);
  await page.getByLabel(/Password/).fill("alpha-test-password");
  await button(page, "Create account").click();
  await visibleText(page, "Your households");
}

async function saveChore(page: Page, name: string, baseline?: typeof image) {
  await label(page, "Chore name").fill(name);
  await label(page, "Effort (1–10)").fill("4");
  await label(page, "Description and photo instructions").fill("Photograph the whole sink.");
  await label(page, "Completion criteria").fill("The sink is empty.");
  if (baseline) await page.getByLabel("Baseline photo").setInputFiles(baseline);
  await button(page, "Save chore").click();
  await page.getByRole("region", { name: "Chore catalog" }).getByText(name, { exact: true }).waitFor();
}

async function createAssignment(page: Page, { startDay, endDay = startDay, repeatThrough, chore = "Wash dishes" }: {
  startDay: number; endDay?: number; repeatThrough?: number; chore?: string;
}) {
  await button(page, "Chore catalog").click();
  await page.getByLabel("Catalog chore").selectOption({ label: chore });
  if (startDay === endDay) {
    await label(page, "Task date").fill(dateInput(startDay));
  } else {
    await label(page, "When can it be done?").selectOption("range");
    await label(page, "Start date").fill(dateInput(startDay));
    await label(page, "End date").fill(dateInput(endDay));
  }
  if (repeatThrough !== undefined) {
    await label(page, "Schedule").selectOption("weekly");
    await label(page, "Repeat through").fill(dateInput(repeatThrough));
  }
  await button(page, "Create assignment").click();
  await button(page, "View assignments in Manage").click();
  await button(page, "Assign available residents").click();
  await visibleText(page, "1 assigned. 0 still need a resident available for each occurrence.");
}

async function submitEvidence(page: Page) {
  await button(page, "Take Photo").waitFor();
  await page.locator("input[type=file]").setInputFiles(image);
  await button(page, "Submit").click();
  await visibleText(page, "Submitted");
}

async function run(browser: Browser) {
  const options = { locale: "en-US", timezoneId: "UTC" };
  const [owner, resident] = await Promise.all([browser.newPage(options), browser.newPage(options)]);
  owner.setDefaultTimeout(15_000);
  resident.setDefaultTimeout(15_000);
  await Promise.all([register(owner, "alpha-owner"), register(resident, "alpha-resident")]);
  await label(owner, "Household name").fill("Browser test home");
  await button(owner, "Create household").click();
  await label(owner, "Registered username").fill("alpha-resident");
  await button(owner, "Add resident").click();
  await visibleText(owner, "Resident added.");
  await button(resident, "Refresh households").click();
  await button(resident, "Availability").click();
  for (const day of weekdays) await label(resident, day).selectOption("AVAILABLE");
  await button(resident, "Save availability").click();
  await visibleText(resident, "Weekly availability saved.");
  assert.equal(await button(resident, "Manage").count(), 0);
  assert.equal(await button(resident, "Chore catalog").count(), 0);

  await button(owner, "Chore catalog").click();
  await saveChore(owner, "Wash dishes");
  await saveChore(owner, "Sweep floor", image);
  await button(resident, "Refresh board").click();
  await button(resident, "Prefs").click();
  await button(resident, "Move Wash dishes up").click();
  await button(resident, "Save preferences").click();
  await visibleText(resident, "Chore preferences saved.");
  await button(resident, "My Tasks").click();
  await visibleText(resident, "No tasks yet");

  await createAssignment(owner, { startDay: -2 });
  await createAssignment(owner, { startDay: -1, endDay: 1 });
  await createAssignment(owner, { startDay: 14, repeatThrough: 21 });
  await createAssignment(owner, { startDay: 28, chore: "Sweep floor" });
  await button(resident, "Refresh board").click();
  const notes = resident.getByRole("button", { name: /Wash dishes/ });
  await notes.nth(3).waitFor();
  assert.equal(await notes.count(), 4);
  await resident.getByRole("button", { name: /Sweep floor/ }).click();
  await resident.getByRole("img", { name: "Reference image 1" }).evaluate(img => (img as HTMLImageElement).decode());
  await resident.locator("button.rs-back").click();
  for (const occurrence of [
    { date: -2, message: "The submission window has closed." },
    { date: 14, message: `Submissions open ${shortDate.format(dateAt(14))}, 12:00 AM.` },
  ]) {
    await notes.filter({ hasText: shortDate.format(dateAt(occurrence.date)) }).click();
    await visibleText(resident, occurrence.message);
    assert.equal(await button(resident, "Take Photo").count(), 0);
    await resident.locator("button.rs-back").click();
  }
  await notes.filter({ hasText: shortDate.format(dateAt(1)) }).click();
  await visibleText(resident, "Criteria:");
  assert.equal(await resident.getByText("Reference Images:", { exact: true }).count(), 0);
  await submitEvidence(resident);

  await button(owner, "Review queue").click();
  await button(owner, "Reject").waitFor();
  assert.equal(await owner.getByText("Baseline photo", { exact: true }).count(), 0);
  await button(owner, "Reject").click();
  await visibleText(owner, "Add feedback so the resident knows what to fix.");
  await label(owner, "Feedback (required for rejection)").fill("Include the whole sink.");
  await button(owner, "Reject").click();
  await visibleText(owner, "Rejected. Feedback is available to the resident.");
  await button(resident, "Refresh board").click();
  await visibleText(resident, "Redo");
  await submitEvidence(resident);

  await button(owner, "Refresh board").click();
  await button(owner, "Approve").click();
  await visibleText(owner, "Approved. Completion and credit recorded.");
  await button(owner, "Reviewed").click();
  await owner.getByRole("button", { name: /Wash dishes alpha-resident/ }).nth(1).waitFor();
  await button(resident, "Refresh board").click();
  await visibleText(resident, "Approved");
  assert.equal(await button(resident, "Take Photo").count(), 0);
  await button(owner, "Manage").click();
  await visibleText(owner, "alpha-resident · 1 point");

  await label(owner, "Week starting").fill(mondayOf(dateInput(-1)));
  const due = dateAt(1).toLocaleDateString("en-US", { timeZone: "UTC" });
  owner.once("dialog", dialog => dialog.accept());
  await owner.getByRole("button", { name: new RegExp(`^Delete task for Wash dishes through ${due},`) }).click();
  await visibleText(owner, "Task deleted.");
  await resident.locator("button.rs-back").click();
  await button(resident, "Refresh board").click();
  await notes.filter({ hasText: shortDate.format(dateAt(1)) }).waitFor({ state: "hidden" });
  await notes.nth(2).waitFor();
  assert.equal(await notes.count(), 3);
  await button(owner, "Review queue").click();
  await button(owner, "Reviewed").click();
  await owner.getByRole("button", { name: /Wash dishes alpha-resident/ }).nth(1).waitFor();
}

let browser: Browser | undefined;
try {
  await mongo.connect();
  await start(["src/main.ts"], backend);
  await start(["node_modules/vite/bin/vite.js", "--config", "web/vite.config.ts", "--port", String(frontendPort)], origin);
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL });
  await run(browser);
  console.log("Browser smoke test passed for household setup, chores, preferences, scheduling, and evidence review.");
} finally {
  await browser?.close();
  for (const service of services.reverse()) service.kill();
  await Promise.all(services.map(service => service.exited));
  try { await database.dropDatabase(); }
  finally { await mongo.close(); }
}
