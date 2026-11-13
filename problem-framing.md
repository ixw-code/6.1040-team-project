**Domain:**

Shared households like dormitories, co-ops, and houses rely on residents sharing chores such as cleaning sinks, wiping counters, etc. Usually there is a coordinator who tracks these assignments and checks whether residents completed them. Checking the kitchen after a chore has been done might not always be obvious that a chore was completed because another resident may have used the space afterwards. As a result, many of these may use tedious photo verification for the coordinator to review and ensure residents are completing their chores and get credit for it.

**Bad Situations:**

*Manual chore verification is tedious and unreliable;*  A typical shared household often relies on messaging apps or forms, where residents submit photographs of their completed chores for coordinators to check. Chore assignments are tracked separately from chore submissions, so the coordinator needs to manually match photos to chores, evaluate the work done, and update the completion status every single time. Moreover, there aren’t any checks preventing residents from gaming the system by submitting fake or old photos to receive credit for work they didn’t do. After a chore is completed, the shared space can also be used again, making it difficult to distinguish an incomplete chore from changes made after the fact. 

*Chore responsibilities are distributed unfairly;* Shared household tasks vary in difficulty, frequency, and time required, and residents may prefer certain tasks over others. A system that distributes tasks evenly by count can still distribute the workload unevenly, leading to resentment from the resident who repeatedly gets to clean the toilet towards the resident who only needs to wipe the kitchen counters. 

*Individuals lack clear responsibilities, leading to undone chores;* People may be confused on the chores that they are supposed to do, or assume that others will do the chores. Everyone may assume that someone else will do the chore. People may feel no sense of personal ownership and thus no impetus or motivation to do chores. Even when chores are assigned through an informal messaging or spreadsheet system, people can forget their schedules, miss their shifts, or shifts can change. When the chore doesn’t get done in these cases, more responsibility falls on the coordinator to intervene. (Tragedy of the Commons.)

1. Friction with manual verification — automated/structured verification process (AI analysis)
    1. Would require Verifying, Identifying, etc. → composed w/ Ranking
2. Contribution / work is unbalanced between roommates
    1. Task completion ranking system such as a leaderboard
    2. Weighting / balancing mechanism for different difficulty of tasks and experience of people (algorithm/design needs to be worked out)
3. Friction is involved with getting chores done due to lack of individual responsibility
    1. Chore assignment via automated division of labor, e.g. Scheduling, Assigning
    2. Other feature extensions with potential bad situations: Swapping, BountyHunting, Rewarding

**Evidence & corroboration:**

- Hunnaid’s experience coordinating chores at Desmond. He uses Google Forms, Google Sheets, Messenger, and verbal reminders to collect photos, track assignments, and communicate issues/swaps with the residents. Even though residents are responsible for their own chores, he still needs to manually check each submission and update the shared spreadsheet. This firsthand account corroborates how a fragmented workflow stacks recurring, tedious responsibilities on the coordinator.
- In a reddit thread, [“PEOPLE WHO DORM: How do you guys split up chores?”](https://www.reddit.com/r/college/comments/1edqd0a), a student asks about how chores should be distributed in a shared living situation with seven roommates. For example, should assignments rotate weekly or remain fixed throughout the semester? Another reddit thread, [“AITA for giving my housemates chores?”](https://www.reddit.com/r/AmItheAsshole/comments/1gq210w), demonstrates how a student feels that they unfairly take on the most household responsibilities but feel uncomfortable assigning responsibilities to their housemates at the same time. Without a clear system for not just chore assignment but fair allocation of responsibilities, resentment and interpersonal conflicts can brew within a shared household. 
- In a reddit thread, [“How the hell do people do chores with roommates?”](https://www.reddit.com/r/badroommates/comments/1wwf6qo?utm_source=chatgpt.com) about a living situation with four college-aged roommates and an established chore chart, chore assignments are still missed and constant reminders are required, with communication difficult due to conflicting schedules. Another post, [“Roommate too lazy to do chores and lies about doing them”](https://www.reddit.com/r/badroommates/comments/16hs6py?utm_source=chatgpt.com),  talks about a system using monthly chore assignments, but with lack of accountability and reliability. One roommate claims to complete their chores without actually doing them, demonstrating the need for a reliable verification process. Without a consistent accountability mechanism for inevitable neglection of responsibilities, additional burden falls on coordinators to pick up the slack of undone tasks.  

**Workarounds and comparables:**

- Google Forms, Google Sheets, and Messenger. 
- In-person posters or whiteboards that show assignments and leaderboards.
- In-person checking.
- Sweepy: Helps organize cleaning, but falls short when it comes to verification.
    - It addresses our extensions, but the core part of our app is to have a verification process of completed chores and this solution fails on that front. 
- ChorePoints: Helps organize cleaning chores and has verification, but requires all members to participate in the AI features if enabled by the coordinator. Also has a small group size.
    - This has overlap with our solution with the AI verification, but the AI permissions are ultimately controlled by the coordinator. We would allow each member to choose the manual verification route.
    - It is also constrained by the small group size, it allows for up to 10 members, which will create capacity problems for larger communities.
- ChoreSplit: Addresses much of our proposed solution through features like AI verification with human fallback, chore rotation scheduling, and gamified point tracking,
    - This app falls short where fairness is concerned, prioritizing gamification and motivation for doing chores. Its smart scheduling feature doesn’t particularly account for workload-balancing and doesn’t address more logistical issues like needing to change shifts around for the week. 

**Solution sketch:**

Shift Happens connects each completion photo directly to a specific chore assignment and keeps its review in the same record. 

A resident opens an assignment, sees the completion criteria and photo instructions, and submits a photo to verify completion. The submission records the time and appears as review pending.

For AI enabled submissions, an agent checks the visible evidence against the chore’s criteria and a baseline image that the coordinator has provided for that job. The baseline shows the expected result. Feedback may point out specific issues or missing evidence, such as dishes still in the sink.

We propose approving clear cases automatically and sending uncertain submissions to the coordinator. The residents can also request human review or submit another photo after receiving feedback. The submission time and review time are distinct.

We would start with one chore and location, then test if the workflow reduces effort required from the coordinator, how often decisions need correction.

**Ethical analysis:**

1. Residents of a shared household (e.g. dormitory, ilg, etc)
    - Observation: Residents might be uncomfortable with being in a photo that is shared with an AI agent if they end up being in the background of an image being submitted.
    - Design response: There will be clear instructions and the ability to retake a photo if the resident feels their image is unsatisfactory. 
2. Residents getting credit for work
    - Observation: Automated verification can save time for the coordinator, but comparing against a baseline might judge the completed work unfairly. They might lose credit to false negatives.
    - Design response: We would define completion criteria and allow coordinators to correct decisions while preserving the original submission.
3. Residents adapting to verification
    - Observation: Repeated feedback can help residents learn what a completed chore is. Over time, they might focus on submitting photos that are guaranteed to be accepted.
    - Design response: Connect feedback to written chore requirements and have stricter specifications for what the photo should cover/include. 
4. Photo verification becomes expected
    -  Observation: If photo verification becomes widely adopted, residents might feel pressured to agree with submitting images to an AI to participate in household responsibilities. 
    - Design response: Let residents choose manual review before submission is processed and get equal credit no matter what option they choose.
5. Chores can feel impersonal and detached from human connection
    - Observation: In a shared household, chores can build a sense of belonging and contribution, as the coordinator notices and thanks people. When instead an AI agent silently approves photos, there is more efficiency but less recognition and community. Chores may start to feel like impersonal transactions rather than just about caring for your housemates.
    - Design response: Add a feature to update people when chores are completed, and the people can react or comment. This way, automation removes the tedious checking but keeps the closeness and community.