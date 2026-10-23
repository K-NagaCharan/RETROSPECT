# Ground-truth adjudication evidence (G1)

This document supports filling in `ground_truth_adjudication.csv`. It contains **no verdicts**.

- **Template values:**
  - `target_is_successor`: Y, N or unsure.
  - `query_acceptable`: Y or N.
  - `note`: free text.
  - `adjudicator` and `date`: yours.
- **Source of the evidence:** read-only `git show` of each origin commit and of the target file at the pin, in `D:\clones`. Ranks come from `per_case_results_corrected.csv`.
- **Preliminary recommendations** are Claude's reading of the diffs, offered to speed your review. They are not ground truth.

**One threat applies to all 14 cases.** Every query follows the template "Locate current implementation corresponding to historical method `<old>` in `<Class>`". The class name always matches the target's enclosing class and file path, which is a structural cue for B1. None of the queries contains the new method name itself.

## Required cases (11)

| Case | Repo @ pin | Origin commit | Old → proposed successor | Diff evidence (origin commit) | Query reveals target or post-rename identity? | Preliminary recommendation |
|---|---|---|---|---|---|---|
| **0013** | checkstyle @ `10a3a0777c` | `24ead56cf9` 2021-04-09 "Issue #4465: Rename LocalizedMessage to Violation" | `AbstractCheck.getMessages` → `getViolations` | In `AbstractCheck.java`, `- public SortedSet<LocalizedMessage> getMessages()` becomes `+ public SortedSet<Violation> getViolations()`. The same rename happens in `AbstractFileSetCheck.java`, a sibling successor that the query's class name disambiguates. At the pin: `getViolations()` at line 113; no `getMessages` remains. | No. "AbstractCheck" was the class name both before and after. | **Successor Y, query Y.** A 1:1 rename with the same signature shape; only the element type changed with the class rename. |
| **0049** | undertow @ `cf3abec914` | `b62c3f1ef` 2015-06-22 "Implement new buffer management API" (201 files) | `ReferenceCountedPooled.getResource` → `getBuffer` | In `ReferenceCountedPooled.java`, `- public ByteBuffer getResource() throws IllegalStateException` becomes `+ public ByteBuffer getBuffer() throws IllegalStateException`; the call sites `underlying.getResource()` become `getBuffer()`. At the pin: line 102. The same file also has an anonymous-class `getBuffer()` at line 133, which is rejected case 0050. | No. | **Y / Y.** An identical-signature rename that is part of an API-wide rename. |
| **0005** | checkstyle @ `10a3a0777c` | `ff424ff8e1` 2021-03-04 "Issue #8237: fixing no whitespace violation in empty constructors" | `WhitespaceAroundCheck.isEmptyCtorBlock` → `isEmptyCtorBlockCheckedFromRcurly` | `- isEmptyCtorBlock(DetailAST ast, int parentType)` is replaced by **two** methods: `+ isEmptyCtorBlockCheckedFromRcurly(DetailAST ast)` and `+ isEmptyCtorBlockCheckedFromSlist(DetailAST ast)`. The old body called `isEmptyBlock(ast, parentType, CTOR_DEF / COMPACT_CTOR_DEF)`; the new bodies inline the RCURLY and SLIST variants. | No (the new names add suffixes the query does not contain). | **Successor: unsure.** This is a 1→2 split, not a rename, and the dataset names only the Rcurly variant. Options: (a) accept with the note "split; one of two successors"; (b) mark N, with the result that the primary group loses this case. Query Y. |
| **0047** | undertow @ `cf3abec914` | `cea721e47` 2015-09-02 "Fix some issue with the refactor" | `WebSocket07FrameSinkChannel.send` → `sendInternal` | `- public boolean send(Pooled<ByteBuffer> pooled)` becomes `+ public boolean sendInternal(Pooled<ByteBuffer> pooled)`, and `super.send(...)` becomes `super.sendInternal(...)`. At the pin: `public boolean sendInternal(PooledByteBuffer pooled)` at line 159; the parameter type was changed by a later commit. | No ("send" is a substring of the target, but the query does not contain "Internal"). | **Y / Y.** An identical-signature rename that follows a superclass refactor. |
| **0105** | graphhopper @ `c7497d1100` | `88806c24c` 2015-08-03 "make multiple vehicles working for subnetwork removal" | `PrepareRoutingSubnetworks.removeZeroDegreeNodes` → `markNodesRemovedIfUnreachable` | `- int removeZeroDegreeNodes()` (marked nodes with no edges as removed, returned a count) is replaced by `+ void markNodesRemovedIfUnreachable()` (marks nodes as removed when they are unreachable for **all** encoders). The commit restructures the whole class: new `findSubnetworks`, `removeEdges`, and others. At the pin, the docstring reads: "Removes nodes if all edges are not accessible. I.e. removes zero degree nodes." | No. | **Successor Y, with the note "behavioural generalisation, not a pure rename"** (the return type changed and the logic became multi-encoder). Query Y. |
| **0019** | checkstyle @ `10a3a0777c` | `24ead56cf9` (same commit as 0013) | `getMessage` → `getViolation`, on the class renamed in that commit (`LocalizedMessage.java` → `Violation.java`, R072) | `- public String getMessage()` becomes `+ public String getViolation()` in the renamed file. At the pin: line 454. The commit also adds other `public Violation getViolation()` methods in other classes. | **Yes.** The query says "in **Violation**", but when `getMessage` existed the class was `LocalizedMessage`, so the query uses the post-rename class name. "Violation" is also the stem of the target name. | **Successor Y; query N** (anachronism plus a target-stem leak). |
| **0020** | checkstyle @ `10a3a0777c` | `24ead56cf9` (same commit) | `getCustomMessage` → `getCustomViolation` (same class rename) | `- private String getCustomMessage()` becomes `+ private String getCustomViolation()`. At the pin: line 485. | **Yes**, for the same reason as 0019: the post-rename class "Violation" is also the stem of the target name. | **Successor Y; query N.** |
| **0101** | graphhopper @ `c7497d1100` | `158d0eced` 2015-07-24 "first measurement runnable, all tests pass, for multiple CH profiles #464" | `GraphHopper.setAlgorithmFactory` → `putAlgorithmFactory` | `- public void setAlgorithmFactory(RoutingAlgorithmFactory algoFactory)` becomes `+ public void putAlgorithmFactory(Weighting weighting, RoutingAlgorithmFactory algoFactory)`. One global factory became one factory per weighting. At the pin: `public GraphHopper putAlgorithmFactory(Weighting, RoutingAlgorithmFactory)` at line 797, plus a new `getAlgorithmFactory(Weighting)`. | No. | **Successor Y, with the note "signature/semantic change: single → per-weighting"**. Query Y. |
| **0044** | undertow @ `cf3abec914` | `6199ea13d` 2015-08-13 "Refactor websocket extensions to be transforms" | `AjpClientResponseStreamSourceChannel.handleFrameData` → `updateFrameDataRemaining` | `- protected long handleFrameData(Pooled<ByteBuffer> frameData, long frameDataRemaining)` becomes `+ protected long updateFrameDataRemaining(...)` with the same parameters. At the pin: line 69. | No. | **Y / Y.** An identical-signature rename (the override follows the parent, see 0045). |
| **0045** | undertow @ `cf3abec914` | `6199ea13d` (same commit) | `AbstractFramedStreamSourceChannel.handleFrameData` → `updateFrameDataRemaining` | Same identical-signature rename in the parent class. At the pin: line 384. | No. | **Y / Y.** |
| **0046** | undertow @ `cf3abec914` | `6199ea13d` (same commit) | `StreamSourceFrameChannel.handleFrameData` → `processFrameData` | `- protected long handleFrameData(Pooled<ByteBuffer> frameData, long frameDataRemaining)` is replaced in place by `+ protected Pooled<ByteBuffer> processFrameData(Pooled<ByteBuffer> frameData, boolean lastFragmentOfFrame)`. The leading `if (masker != null)` unmasking block is kept as context, the extension logic is replaced by `extensionFunction.transformForRead(...)`, and the return type changed. The class **also inherits** `updateFrameDataRemaining` from its parent (0045's target), which is the name-level successor of the parent's `handleFrameData`. | No. | **Successor: unsure.** There are two plausible successors: `processFrameData` (same location, part of the same body) and the inherited `updateFrameDataRemaining` (the same role in the class hierarchy). Query Y. |

### Clusters and why they matter for the statistics

The 11 cases come from 7 origin commits:

| Origin commit | Cases |
|---|---|
| `24ead56` | 0013, 0019, 0020 |
| `6199ea1` | 0044, 0045, 0046 |
| `b62c3f1` | 0049 |
| `88806c2` | 0105 |
| `ff424ff` | 0005 |
| `cea721e` | 0047 |
| `158d0ec` | 0101 |

Rejecting a case removes a cluster only if it is the cluster's last remaining case. For example, rejecting 0005 removes cluster `ff424ff`; rejecting 0019 and 0020 keeps `24ead56` through 0013.

**Impact on the rescue cases.** Of the three historical rescues, 0013 and 0049 are recommended Y/Y. 0019 is a rescue only under a query you may judge unacceptable.

## Netty migration cases: classification decision needed

All three share one origin commit, `083600a93` (2014-11-11, "Upgrade Netty to 4.0.26 (JAVA-622)"), in datastax/java-driver at pin `f4240267b3`, in `Connection.java`. The rev-list distance is 628 and the origin is **outside** the 50-commit retrieval window, so B2 cannot rank them in any case.

| Case | Old → proposed successor | Diff evidence | Query | Ranks (B1/B2/B3/B4) |
|---|---|---|---|---|
| 0035 | `Dispatcher.messageReceived` → `channelRead0` | `- public void messageReceived(ChannelHandlerContext ctx, MessageEvent e)` becomes `+ protected void channelRead0(ChannelHandlerContext ctx, Message.Response response)` | "…historical method messageReceived in Dispatcher" | —/—/—/— |
| 0036 | `Dispatcher.channelIdle` → `userEventTriggered` | `- public void channelIdle(ChannelHandlerContext ctx, IdleStateEvent e)` becomes `+ public void userEventTriggered(ChannelHandlerContext ctx, Object evt)` | "…historical method channelIdle in Dispatcher" | —/—/—/— |
| 0038 | `Initializer.getPipeline` → `initChannel` | `- public ChannelPipeline getPipeline()` becomes `+ protected void initChannel(SocketChannel channel)` | "…historical method getPipeline in Initializer" | 67/—/68/108 |

**What these cases are.** The new names are callbacks imposed by the Netty 4 API: the handler classes were re-based on `SimpleChannelInboundHandler` and `ChannelInitializer`. The logic was ported, but the developer did not rename the methods.

**Preliminary recommendation.** Do not count them as *method renames*. Either keep them as a labelled "framework API migration" subgroup within the unreachable cases, or exclude them from rename claims with that stated reason. Numerically, the choice changes only the N of the outside-window group (14 → 11). None of the three has B1 in the top-10, so fusion-harm counts are unaffected.

**Decision to record:** keep as migration or exclude from rename claims. You can add three rows to the CSV with `target_is_successor = migration` and a note, or record the decision in the `note` column of a separate list.
