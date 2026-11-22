// Data for the photo proof page.
//
// The backend has no endpoints for these yet (generated/wire.ts is empty), so this module
// serves sample tasks and simulates a submission. When the endpoints exist, replace the
// bodies of loadMyTasks and submitProof with calls through `api` from ./api.ts. The page
// only depends on the types and functions exported here.

export type ProofTask = {
  // The scheduled task occurrence. This becomes PhotoChecking's subject.
  task: string;
  chore: string;
  due: Date;
  criteria: string[];
  // Optional photo the Coordinator gave as an example of the finished chore.
  baseline?: string;
};

export type ProofSubmission = {
  submission: string;
  task: string;
  submittedAt: Date;
};

export type Resident = { person: string; name: string };

const today = new Date();
const at = (days: number, hours: number) => {
  const date = new Date(today);
  date.setDate(date.getDate() + days);
  date.setHours(hours, 0, 0, 0);
  return date;
};

const sampleResident: Resident = { person: "resident-1", name: "Alex" };

const sampleTasks: ProofTask[] = [
  {
    task: "task-kitchen-sink",
    chore: "Kitchen sink",
    due: at(0, 22),
    criteria: [
      "No dishes left in the sink or on the counter",
      "Sink basin wiped down, no food scraps in the drain",
      "Drying rack emptied",
    ],
  },
  {
    task: "task-trash",
    chore: "Take out trash & recycling",
    due: at(1, 9),
    criteria: ["Both bins emptied", "New liners in both bins", "Bags taken to the outdoor bins"],
  },
];

export async function loadMe(): Promise<Resident> {
  return sampleResident;
}

// Tasks assigned to the signed-in resident that still need proof.
export async function loadMyTasks(): Promise<ProofTask[]> {
  return sampleTasks;
}

// Send one photo as proof for a task. When the endpoint exists, it saves the photo with
// savePhoto in src/storage/photos.ts and passes the returned reference to PhotoChecking.submit.
// Until then, this sample version only waits briefly and returns a new submission.
export async function submitProof(task: string, photo: Blob): Promise<ProofSubmission> {
  if (photo.size === 0) throw new Error("Take a photo before submitting.");
  await new Promise((resolve) => setTimeout(resolve, 700));
  return { submission: crypto.randomUUID(), task, submittedAt: new Date() };
}
