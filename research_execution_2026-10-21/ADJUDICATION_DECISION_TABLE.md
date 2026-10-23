# Adjudication decision table: 11 in-window Java cases + 3 Netty cases

**What this is.** Recommendations only. `research_corrected_2026-10-21/ground_truth_adjudication.csv` is **unchanged**; all 11 rows are still blank, and the owner fills it in.

**Sources.** Diff evidence is in `research_corrected_2026-10-21/ground_truth_adjudication_evidence.md` (read-only `git show` of each origin commit and pin). Ranks are from E1, which reproduced 116/116.

**Shared caveat.** Every query uses the template "Locate current implementation corresponding to historical method `<old>` in `<Class>`". The class name is a structural cue for every case. None of these queries contains the new method name.

| Case | Query (old name / class) | Proposed target | Query leaks target or post-rename identity? | Historical relation unambiguous? | Key evidence | Recommended verdict | Your decision needed? |
|---|---|---|---|---|---|---|---|
| 0013 | `getMessages` in AbstractCheck | `AbstractCheck.getViolations` | No | Yes (1:1 rename, `24ead56`) | `- SortedSet<LocalizedMessage> getMessages()` → `+ SortedSet<Violation> getViolations()` | **Accept** (Y / Y) | Confirm only |
| 0049 | `getResource` in ReferenceCountedPooled | `ReferenceCountedPooled.getBuffer` | No | Yes (same signature, `b62c3f1`) | `getResource() throws IllegalStateException` → `getBuffer() throws …` | **Accept** (Y / Y) | Confirm only |
| 0047 | `send` in WebSocket07FrameSinkChannel | `…sendInternal` | No | Yes (`cea721e`) | `send(Pooled<ByteBuffer>)` → `sendInternal(Pooled<ByteBuffer>)`; `super.send` → `super.sendInternal` | **Accept** (Y / Y) | Confirm only |
| 0044 | `handleFrameData` in AjpClientResponseStreamSourceChannel | `…updateFrameDataRemaining` | No | Yes (identical parameters, `6199ea1`) | Same signature, renamed | **Accept** (Y / Y) | Confirm only |
| 0045 | `handleFrameData` in AbstractFramedStreamSourceChannel | `…updateFrameDataRemaining` | No | Yes (same commit) | Same signature, renamed | **Accept** (Y / Y) | Confirm only |
| 0105 | `removeZeroDegreeNodes` in PrepareRoutingSubnetworks | `…markNodesRemovedIfUnreachable` | No | Mostly: behavioural generalisation (`int` → `void`, multi-encoder) | Same call site; docstring at the pin: "I.e. removes zero degree nodes" | **Accept, with the note "generalisation"** | **Yes** (is a generalisation a successor?) |
| 0101 | `setAlgorithmFactory` in GraphHopper | `GraphHopper.putAlgorithmFactory` | No | Mostly: semantics change (single → per-`Weighting`) | `set(RoutingAlgorithmFactory)` → `put(Weighting, RoutingAlgorithmFactory)` | **Accept, with the note "signature change"** | **Yes** |
| 0019 | `getMessage` in **Violation** | `Violation.getViolation` | **Yes**: the class was `LocalizedMessage` when `getMessage` existed, and "Violation" is the target's stem | Yes (`24ead56`, R072 file rename) | `- String getMessage()` → `+ String getViolation()` | **Successor Y; query N → exclude from rescue claims** (it is one of the 3 measured rescues) | **Yes** |
| 0020 | `getCustomMessage` in **Violation** | `Violation.getCustomViolation` | **Yes** (same anachronism plus stem) | Yes | `- getCustomMessage()` → `+ getCustomViolation()` | **Successor Y; query N** | **Yes** |
| 0005 | `isEmptyCtorBlock` in WhitespaceAroundCheck | `…isEmptyCtorBlockCheckedFromRcurly` | No | **No**: a 1 → 2 split (`…CheckedFromRcurly` and `…CheckedFromSlist`) | `ff424ff`; the old body is inlined into two specialised variants | **Your judgment**: accept as "one of two successors", or exclude as not a rename | **Yes** |
| 0046 | `handleFrameData` in StreamSourceFrameChannel | `…processFrameData` | No | **No**: in-place replacement `processFrameData` vs inherited `updateFrameDataRemaining` | Return type and parameters changed; `masker` block kept | **Your judgment**: accept `processFrameData`, accept both, or exclude | **Yes** |

## Netty migrations (outside the window; classification decision)

| Case | Old → new | Recommendation |
|---|---|---|
| 0035 | `Dispatcher.messageReceived` → `channelRead0` | Classify as **framework API migration**, not rename. They stay in the outside-window group as a labelled subgroup or are excluded from rename claims. Ranks are unaffected either way: no B1 top-10, no fusion harm. |
| 0036 | `Dispatcher.channelIdle` → `userEventTriggered` | Same |
| 0038 | `Initializer.getPipeline` → `initChannel` | Same |

## Consequence for claims (if recommendations are accepted)

- **Clear accepts:** 5 (0013, 0049, 0047, 0044, 0045), from 4 origin commits.
- **Accept with a note:** 2 (0105, 0101), which adds 2 commits, for 6 clusters.
- **Your judgment:** 0019, 0020, 0005, 0046.
- **Historical rescues** under these recommendations: **0013 and 0049** (2 cases, 2 commits). 0019 drops out if its query is rejected.
