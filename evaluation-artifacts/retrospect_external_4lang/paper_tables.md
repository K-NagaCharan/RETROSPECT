# Paper tables

Each table is given in Markdown and as a LaTeX `tabular`.
Sources:
- External benchmark: `analysis/external_v1/results.json`.
- Main benchmark: `retrospect_evaluation_2026-10-21/evaluation/analysis/v4_parserfix/`.
- E3-Reach: `Retrospect/research_execution_2026-10-21/E3_reach_parserfix_analysis/`.

## Table 1. External benchmark funnel

| Language | Source | Repos considered | Excluded | Clone skipped | No valid event | Candidate events | Passed extractor check | Dropped at pin | Selected |
|---|---|---|---|---|---|---|---|---|---|
| java | S1 | 46 | 4 | 6 | 24 | 181 | 45 | 12 | 12 |
| python | S3 | 19 | 5 | 0 | 3 | 420 | 114 | 3 | 11 |
| python | S2 | 3 | 1 | 0 | 1 | 38 | 9 | 0 | 1 |
| javascript | S3 | 25 | 8 | 0 | 12 | 144 | 24 | 7 | 5 |
| javascript | S3b | 12 | 0 | 0 | 10 | 93 | 5 | 2 | 2 |
| typescript | S3 | 25 | 4 | 1 | 9 | 1500 | 139 | 15 | 11 |
| total |  |  |  |  |  |  |  |  | 42 |

```latex
\begin{table}[t]
\centering
\caption{Case-set construction funnel (one event per repository)}
\begin{tabular}{llllllllll}
\hline
Language & Source & Repos considered & Excluded & Clone skipped & No valid event & Candidate events & Passed extractor check & Dropped at pin & Selected \\
\hline
java & S1 & 46 & 4 & 6 & 24 & 181 & 45 & 12 & 12 \\
python & S3 & 19 & 5 & 0 & 3 & 420 & 114 & 3 & 11 \\
python & S2 & 3 & 1 & 0 & 1 & 38 & 9 & 0 & 1 \\
javascript & S3 & 25 & 8 & 0 & 12 & 144 & 24 & 7 & 5 \\
javascript & S3b & 12 & 0 & 0 & 10 & 93 & 5 & 2 & 2 \\
typescript & S3 & 25 & 4 & 1 & 9 & 1500 & 139 & 15 & 11 \\
total &  &  &  &  &  &  &  &  & 42 \\
\hline
\end{tabular}
\end{table}
```

## Table 2. Confirmatory test

| Task | Repos | MRR B1 | MRR G | R@1 B1 | R@1 G | R@10 B1 | R@10 G | Δ (G − B1) | 95% CI | p (two-sided) | Rescues / harms @10 | Decision |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| B_id | 42 | 0.363 | 0.775 | 0.262 | 0.714 | 0.524 | 0.857 | 0.412 | [0.279, 0.549] | 1.0e-05 | 14 / 0 | SUPPORTED |

```latex
\begin{table}[t]
\centering
\caption{Confirmatory test: Task B\_id, G vs B1, pooled over repositories (Monte Carlo sign-flip, 100k, seed 20261023)}
\begin{tabular}{lllllllllllll}
\hline
Task & Repos & MRR B1 & MRR G & R@1 B1 & R@1 G & R@10 B1 & R@10 G & $\Delta$ (G − B1) & 95\% CI & p (two-sided) & Rescues / harms @10 & Decision \\
\hline
B\_id & 42 & 0.363 & 0.775 & 0.262 & 0.714 & 0.524 & 0.857 & 0.412 & [0.279, 0.549] & 1.0e-05 & 14 / 0 & SUPPORTED \\
\hline
\end{tabular}
\end{table}
```

## Table 3. Harm check

| Task | Repos | MRR B1 | MRR G | Δ | Harms @10 | Result |
|---|---|---|---|---|---|---|
| A | 14 | 0.651 | 0.645 | -0.006 | 0 | PASS |

```latex
\begin{table}[t]
\centering
\caption{Harm check (non-inferiority): Task A, G vs B1 (PASS if harms@10 = 0 and $\Delta$ $\geq$ −0.01)}
\begin{tabular}{lllllll}
\hline
Task & Repos & MRR B1 & MRR G & $\Delta$ & Harms @10 & Result \\
\hline
A & 14 & 0.651 & 0.645 & -0.006 & 0 & PASS \\
\hline
\end{tabular}
\end{table}
```

## Table 4. All systems vs B1 (external)

| Stratum | Comparison | Repos | MRR B1 | MRR sys | Δ | 95% CI | p | Rescues / harms |
|---|---|---|---|---|---|---|---|---|
| B_id | G lineage gate vs B1 | 42 | 0.363 | 0.775 | 0.412 | [0.279, 0.549] | 1.0e-05 | 14 / 0 |
| B_id | B2 historical vs B1 | 42 | 0.363 | 0.653 | 0.290 | [0.125, 0.451] | 0.0015 | 14 / 4 |
| B_id | B3 linear fusion vs B1 | 42 | 0.363 | 0.553 | 0.191 | [0.062, 0.319] | 0.0056 | 14 / 1 |
| B_id | B4 RRF fusion vs B1 | 42 | 0.363 | 0.520 | 0.158 | [0.046, 0.275] | 0.0096 | 10 / 2 |
| B_nl (mean of 3 templates) | G lineage gate vs B1 | 42 | 0.240 | 0.724 | 0.484 | [0.365, 0.604] | 1.0e-05 | 54 / 0 |
| B_nl (mean of 3 templates) | B2 historical vs B1 | 42 | 0.240 | 0.676 | 0.436 | [0.288, 0.579] | 1.0e-05 | 59 / 6 |
| B_nl (mean of 3 templates) | B3 linear fusion vs B1 | 42 | 0.240 | 0.660 | 0.420 | [0.303, 0.536] | 1.0e-05 | 61 / 2 |
| B_nl (mean of 3 templates) | B4 RRF fusion vs B1 | 42 | 0.240 | 0.548 | 0.308 | [0.211, 0.403] | 1.0e-05 | 48 / 3 |
| A | G lineage gate vs B1 | 14 | 0.651 | 0.645 | -0.006 | [-0.018, 0.000] | 1.0000 | 0 / 0 |
| A | B2 historical vs B1 | 14 | 0.651 | 0.275 | -0.376 | [-0.637, -0.088] | 0.0248 | 0 / 7 |
| A | B3 linear fusion vs B1 | 14 | 0.651 | 0.547 | -0.105 | [-0.330, 0.118] | 0.3984 | 0 / 0 |
| A | B4 RRF fusion vs B1 | 14 | 0.651 | 0.548 | -0.103 | [-0.319, 0.116] | 0.3906 | 0 / 1 |

```latex
\begin{table}[t]
\centering
\caption{All systems vs B1 by task (descriptive; repository-bootstrap CIs)}
\begin{tabular}{lllllllll}
\hline
Stratum & Comparison & Repos & MRR B1 & MRR sys & $\Delta$ & 95\% CI & p & Rescues / harms \\
\hline
B\_id & G lineage gate vs B1 & 42 & 0.363 & 0.775 & 0.412 & [0.279, 0.549] & 1.0e-05 & 14 / 0 \\
B\_id & B2 historical vs B1 & 42 & 0.363 & 0.653 & 0.290 & [0.125, 0.451] & 0.0015 & 14 / 4 \\
B\_id & B3 linear fusion vs B1 & 42 & 0.363 & 0.553 & 0.191 & [0.062, 0.319] & 0.0056 & 14 / 1 \\
B\_id & B4 RRF fusion vs B1 & 42 & 0.363 & 0.520 & 0.158 & [0.046, 0.275] & 0.0096 & 10 / 2 \\
B\_nl (mean of 3 templates) & G lineage gate vs B1 & 42 & 0.240 & 0.724 & 0.484 & [0.365, 0.604] & 1.0e-05 & 54 / 0 \\
B\_nl (mean of 3 templates) & B2 historical vs B1 & 42 & 0.240 & 0.676 & 0.436 & [0.288, 0.579] & 1.0e-05 & 59 / 6 \\
B\_nl (mean of 3 templates) & B3 linear fusion vs B1 & 42 & 0.240 & 0.660 & 0.420 & [0.303, 0.536] & 1.0e-05 & 61 / 2 \\
B\_nl (mean of 3 templates) & B4 RRF fusion vs B1 & 42 & 0.240 & 0.548 & 0.308 & [0.211, 0.403] & 1.0e-05 & 48 / 3 \\
A & G lineage gate vs B1 & 14 & 0.651 & 0.645 & -0.006 & [-0.018, 0.000] & 1.0000 & 0 / 0 \\
A & B2 historical vs B1 & 14 & 0.651 & 0.275 & -0.376 & [-0.637, -0.088] & 0.0248 & 0 / 7 \\
A & B3 linear fusion vs B1 & 14 & 0.651 & 0.547 & -0.105 & [-0.330, 0.118] & 0.3984 & 0 / 0 \\
A & B4 RRF fusion vs B1 & 14 & 0.651 & 0.548 & -0.103 & [-0.319, 0.116] & 0.3906 & 0 / 1 \\
\hline
\end{tabular}
\end{table}
```

## Table 5. Per language (external)

| Language | Task | Repos | MRR B1 | MRR B2 | MRR B3 | MRR B4 | MRR G | Δ G − B1 | 95% CI |
|---|---|---|---|---|---|---|---|---|---|
| java | B_id | 12 | 0.278 | 0.368 | 0.325 | 0.240 | 0.570 | 0.292 | [0.093, 0.517] |
| java | B_nl | 12 | 0.204 | 0.382 | 0.405 | 0.299 | 0.528 | 0.324 | [0.122, 0.550] |
| python | B_id | 12 | 0.533 | 0.628 | 0.681 | 0.669 | 0.836 | 0.303 | [0.056, 0.550] |
| python | B_nl | 12 | 0.347 | 0.662 | 0.722 | 0.612 | 0.766 | 0.418 | [0.211, 0.632] |
| javascript | B_id | 7 | 0.411 | 1.000 | 0.714 | 0.751 | 1.000 | 0.589 | [0.262, 0.873] |
| javascript | B_nl | 7 | 0.270 | 1.000 | 0.845 | 0.790 | 1.000 | 0.730 | [0.508, 0.920] |
| typescript | B_id | 11 | 0.239 | 0.770 | 0.560 | 0.518 | 0.788 | 0.549 | [0.278, 0.813] |
| typescript | B_nl | 11 | 0.142 | 0.805 | 0.752 | 0.595 | 0.717 | 0.576 | [0.343, 0.802] |

```latex
\begin{table}[t]
\centering
\caption{Per-language results (descriptive)}
\begin{tabular}{llllllllll}
\hline
Language & Task & Repos & MRR B1 & MRR B2 & MRR B3 & MRR B4 & MRR G & $\Delta$ G − B1 & 95\% CI \\
\hline
java & B\_id & 12 & 0.278 & 0.368 & 0.325 & 0.240 & 0.570 & 0.292 & [0.093, 0.517] \\
java & B\_nl & 12 & 0.204 & 0.382 & 0.405 & 0.299 & 0.528 & 0.324 & [0.122, 0.550] \\
python & B\_id & 12 & 0.533 & 0.628 & 0.681 & 0.669 & 0.836 & 0.303 & [0.056, 0.550] \\
python & B\_nl & 12 & 0.347 & 0.662 & 0.722 & 0.612 & 0.766 & 0.418 & [0.211, 0.632] \\
javascript & B\_id & 7 & 0.411 & 1.000 & 0.714 & 0.751 & 1.000 & 0.589 & [0.262, 0.873] \\
javascript & B\_nl & 7 & 0.270 & 1.000 & 0.845 & 0.790 & 1.000 & 0.730 & [0.508, 0.920] \\
typescript & B\_id & 11 & 0.239 & 0.770 & 0.560 & 0.518 & 0.788 & 0.549 & [0.278, 0.813] \\
typescript & B\_nl & 11 & 0.142 & 0.805 & 0.752 & 0.595 & 0.717 & 0.576 & [0.343, 0.802] \\
\hline
\end{tabular}
\end{table}
```

## Table 6. Main benchmark: in-window and all-indexed

| Stratum | Cases / clusters | MRR B1 | MRR B2 | MRR B3 | MRR B4 | Δ B4 − B1 | B4 rescues / harms |
|---|---|---|---|---|---|---|---|
| Held-out B, in window, H=400 | 14 / 12 | 0.407 | 0.650 | 0.528 | 0.491 | +0.091 | 3 / 0 |
| Held-out B, all indexed, H=400 | 63 / 49 | 0.433 | 0.249 | 0.346 | 0.270 | -0.084 | 4 / 23 |
| Held-out B, all indexed, H=50 | 63 / 49 | 0.433 | 0.088 | 0.305 | 0.170 | -0.214 | 3 / 17 |

```latex
\begin{table}[t]
\centering
\caption{Main benchmark (4 languages, held-out, v4 parser-fix): structural vs historical vs fusion}
\begin{tabular}{llllllll}
\hline
Stratum & Cases / clusters & MRR B1 & MRR B2 & MRR B3 & MRR B4 & $\Delta$ B4 − B1 & B4 rescues / harms \\
\hline
Held-out B, in window, H=400 & 14 / 12 & 0.407 & 0.650 & 0.528 & 0.491 & +0.091 & 3 / 0 \\
Held-out B, all indexed, H=400 & 63 / 49 & 0.433 & 0.249 & 0.346 & 0.270 & -0.084 & 4 / 23 \\
Held-out B, all indexed, H=50 & 63 / 49 & 0.433 & 0.088 & 0.305 & 0.170 & -0.214 & 3 / 17 \\
\hline
\end{tabular}
\end{table}
```

## Table 7. Main benchmark Task D

| Language | H | Cases | Clusters | False-lineage-claim rate (B2 top-10) |
|---|---|---|---|---|
| java | 400 | 567 | 34 | 0.0000 |
| javascript | 400 | 61 | 40 | 0.0000 |
| pooled | 400 | 903 | 180 | 0.0000 |
| python | 400 | 155 | 70 | 0.0000 |
| typescript | 400 | 120 | 36 | 0.0000 |
| java | 50 | 567 | 34 | 0.0000 |
| javascript | 50 | 61 | 40 | 0.0164 |
| pooled | 50 | 903 | 180 | 0.0011 |
| python | 50 | 155 | 70 | 0.0000 |
| typescript | 50 | 120 | 36 | 0.0000 |

```latex
\begin{table}[t]
\centering
\caption{Main benchmark Task D (held-out): false lineage claims}
\begin{tabular}{lllll}
\hline
Language & H & Cases & Clusters & False-lineage-claim rate (B2 top-10) \\
\hline
java & 400 & 567 & 34 & 0.0000 \\
javascript & 400 & 61 & 40 & 0.0000 \\
pooled & 400 & 903 & 180 & 0.0000 \\
python & 400 & 155 & 70 & 0.0000 \\
typescript & 400 & 120 & 36 & 0.0000 \\
java & 50 & 567 & 34 & 0.0000 \\
javascript & 50 & 61 & 40 & 0.0164 \\
pooled & 50 & 903 & 180 & 0.0011 \\
python & 50 & 155 & 70 & 0.0000 \\
typescript & 50 & 120 & 36 & 0.0000 \\
\hline
\end{tabular}
\end{table}
```

## Table 8. E3-Reach

| Set | Cases | Clusters | MRR B1 | MRR B4 | Δ B4 − B1 | p (exact) | Rescues / harms | Outcome |
|---|---|---|---|---|---|---|---|---|
| E3-Reach primary (Java, H=400, fixed code) | 18 | 13 | 0.162 | 0.282 | +0.107 | 0.06641 | 4 / 2 | INCONCLUSIVE |

```latex
\begin{table}[t]
\centering
\caption{E3-Reach (pre-registered, Java)}
\begin{tabular}{lllllllll}
\hline
Set & Cases & Clusters & MRR B1 & MRR B4 & $\Delta$ B4 − B1 & p (exact) & Rescues / harms & Outcome \\
\hline
E3-Reach primary (Java, H=400, fixed code) & 18 & 13 & 0.162 & 0.282 & +0.107 & 0.06641 & 4 / 2 & INCONCLUSIVE \\
\hline
\end{tabular}
\end{table}
```

## Table 9. Sensitivity (owner-confirmed cases)

Source: `analysis/external_v1_posthoc/results_posthoc.json`. Computed after the confirmatory result.

| Set | Repos | MRR B1 | MRR G | Δ (G − B1) | 95% CI | p (two-sided) | Rescues / harms @10 |
|---|---|---|---|---|---|---|---|
| S1 + S2 + owner-confirmed S3/S3b (B_id) | 39 | 0.386 | 0.757 | 0.372 | [0.235, 0.509] | 1.0e-05 | 12 / 0 |

```latex
\begin{table}[t]
\centering
\caption{Sensitivity (protocol §7): confirmatory statistic with owner-rejected S3/S3b cases removed}
\begin{tabular}{llllllll}
\hline
Set & Repos & MRR B1 & MRR G & $\Delta$ (G − B1) & 95\% CI & p (two-sided) & Rescues / harms @10 \\
\hline
S1 + S2 + owner-confirmed S3/S3b (B\_id) & 39 & 0.386 & 0.757 & 0.372 & [0.235, 0.509] & 1.0e-05 & 12 / 0 \\
\hline
\end{tabular}
\end{table}
```

## Table 10. Post-hoc descriptive (template 2 excluded; S1 only)

Source: `analysis/external_v1_posthoc/results_posthoc.json`. Computed after the confirmatory result.

| Stratum | Comparison | Repos | MRR B1 | MRR sys | Δ | 95% CI | p | Rescues / harms |
|---|---|---|---|---|---|---|---|---|
| B_nl, templates 1 and 3 | G lineage gate vs B1 | 42 | 0.360 | 0.757 | 0.397 | [0.268, 0.529] | 1.0e-05 | 24 / 0 |
| B_nl, templates 1 and 3 | B2 historical vs B1 | 42 | 0.360 | 0.668 | 0.308 | [0.133, 0.477] | 0.0014 | 25 / 6 |
| B_nl, templates 1 and 3 | B3 linear fusion vs B1 | 42 | 0.360 | 0.645 | 0.285 | [0.156, 0.413] | 0.0001 | 27 / 2 |
| B_nl, templates 1 and 3 | B4 RRF fusion vs B1 | 42 | 0.360 | 0.518 | 0.158 | [0.054, 0.263] | 0.0051 | 15 / 3 |
| S1 only (RefactoringMiner, Java), B_id | G lineage gate vs B1 | 12 | 0.278 | 0.570 | 0.292 | [0.093, 0.517] | 0.0625 | 3 / 0 |
| S1 only (RefactoringMiner, Java), B_nl | G lineage gate vs B1 | 12 | 0.204 | 0.528 | 0.324 | [0.122, 0.550] | 0.0312 | 10 / 0 |

```latex
\begin{table}[t]
\centering
\caption{Post-hoc descriptive rows (added after the confirmatory result)}
\begin{tabular}{lllllllll}
\hline
Stratum & Comparison & Repos & MRR B1 & MRR sys & $\Delta$ & 95\% CI & p & Rescues / harms \\
\hline
B\_nl, templates 1 and 3 & G lineage gate vs B1 & 42 & 0.360 & 0.757 & 0.397 & [0.268, 0.529] & 1.0e-05 & 24 / 0 \\
B\_nl, templates 1 and 3 & B2 historical vs B1 & 42 & 0.360 & 0.668 & 0.308 & [0.133, 0.477] & 0.0014 & 25 / 6 \\
B\_nl, templates 1 and 3 & B3 linear fusion vs B1 & 42 & 0.360 & 0.645 & 0.285 & [0.156, 0.413] & 0.0001 & 27 / 2 \\
B\_nl, templates 1 and 3 & B4 RRF fusion vs B1 & 42 & 0.360 & 0.518 & 0.158 & [0.054, 0.263] & 0.0051 & 15 / 3 \\
S1 only (RefactoringMiner, Java), B\_id & G lineage gate vs B1 & 12 & 0.278 & 0.570 & 0.292 & [0.093, 0.517] & 0.0625 & 3 / 0 \\
S1 only (RefactoringMiner, Java), B\_nl & G lineage gate vs B1 & 12 & 0.204 & 0.528 & 0.324 & [0.122, 0.550] & 0.0312 & 10 / 0 \\
\hline
\end{tabular}
\end{table}
```

