# PESOSE Track Decision for APPFL

**Decision: Track 2 (Establish and Expand; 2 years, up to $1.5M).**
Track 1 is the fallback only if NSF/PO feedback says APPFL is "too mature" or if we cannot line up 3-5 external user/contributor letters.

Sources: `NSF PESOSE.pdf` (info-session notes), `NSF_PESOSE_Merit_Review.pptx` (reviewer training, slides 16-21), GitHub/PyPI data pulled 2026-11-23.

---

## 1. What each track is scored on

| | Track 1: Scoping & Planning | Track 2: Establishing & Expanding |
|---|---|---|
| Size | 1 yr, $300K | 2 yr, $1.5M |
| Purpose | Plan an OSE. "Supports OSE planning, not product development." | Build a strong, sustainable OSE around a **robust, promising product** meeting an emergent societal/national need |
| Review criteria | Ecosystem Discovery; Organization & Governance; Risk Analysis/Security Plan; Community Building | Ecosystem Growth; Organization & Governance; Continuous Development; Risk Analysis & Security; Community Building; **Sustainability**; **Evaluation Plan** |
| Reviewers look for | Are the scoping plans concrete, innovative, budgeted, assessable? | Is there a clear strategy to *expand* an existing user/contributor base, with metrics and a funding plan beyond the award? |

Both tracks require (slide 16): a pointer to the public product, current status (dev/testing model, dissemination, user base, contributor base) **backed by repo evidence and letters**, the problem statement, team qualifications, and **3-5 letters of collaboration from current users or contributors**.

## 2. APPFL's evidence (as of 2026-11-23)

**Product is robust, so it qualifies as Track 2's "robust, promising product":**
- Public since Oct 2021, MIT license, 185 stars, 47 forks, release v1.12.0 (Oct 2026), steady release cadence (v1.10 Mar, v1.11 Aug, v1.12 Oct 2026).
- CI workflows, pre-commit, dependabot, ReadTheDocs, CITATION.cff, Zenodo DOI, `CONTRIBUTING.md`, `SECURITY.md`, PR/issue templates.
- ~600 PyPI downloads/month; 91 PRs merged in the last 12 months.
- Clear national need: privacy-preserving training on siloed sensitive data (health, energy, finance, government), multi-institution science.

**Ecosystem is thin, which is the gap Track 2 pays to close:**
- Contributors are concentrated: the top 3 contributors account for ~85% of human commits, and one maintainer for ~55%. The core team is essentially one lab (Argonne).
- Only 9 issues opened in the last 12 months, so there is little visible external user engagement on GitHub.
- No code of conduct, no `GOVERNANCE.md`, no maintainer/committer ladder, no steering body, no fiscal sponsor, no public roadmap process.
- No sustainability plan beyond DOE program funding.

This "strong product, thin ecosystem" profile is the PESOSE sweet spot described in the info session.

## 3. Why not Track 1

- Track 1 is for projects whose ecosystem foundations need to be *discovered and planned*. APPFL already has users, releases, CI, docs, and a security policy. A Track 1 proposal would undersell the project, and reviewers may ask why planning money is needed.
- Track 1 cannot fund the activities APPFL actually needs (paid community manager, external-contributor onboarding, security hardening, governance transition), and it is one-third of the budget.
- When Track 1 would make sense: if we cannot document an existing external user base (letters, deployments, citations), the Track 2 "expand" story collapses and Track 1 becomes the honest option.

## 4. Risks to the Track 2 case and how to address them

| Risk | Reviewer framing | Mitigation in proposal |
|---|---|---|
| "Already well-resourced" (PESOSE disqualifier) | Argonne/DOE-funded project; why does it need NSF? | State plainly that DOE funding supports **research and product features**, not community, governance, or external onboarding. Show the ecosystem metrics above as evidence of the gap. Confirm **no prior POSE/SafeOSC award** (the info session said a prior POSE Phase II award makes Track 1/2 the wrong fit). |
| Lab-centric project | "Will this outlive the PI's group?" | Multi-org governance (steering committee with external seats), fiscal sponsor (e.g., NumFOCUS / LF AI & Data), co-PIs or senior personnel from outside Argonne. |
| Contribution to knowledge (Intellectual Merit) | "This is community management, not research" | Frame IM around how to build a *secure* FL ecosystem: trust model for third-party aggregators/compressors/communicators, a plugin certification process, and reproducible FL benchmarks. |
| Crowded FL space (Flower, NVFlare, FedML, OpenFL) | "Why APPFL?" | Point to differentiators such as HPC/science-facility focus, Globus Compute and MPI backends, privacy algorithms, and data-readiness reports. Present APPFL as the FL ecosystem for open science / national labs and universities, not a competitor to industry frameworks. |
| Security is scored separately (Risk Analysis & Security) | FL has a large attack surface | Use the FL threat landscape (gradient inversion, poisoning, Byzantine clients, untrusted plugins, supply chain of third-party compressors and Globus Compute) to write a specific plan: signed releases, SBOM, OpenSSF Scorecard, vulnerability disclosure SLA, 2FA and least-privilege for maintainers. |

## 5. Special-interest hook (optional)

The info session named **AI agent protocol ecosystems** as an area of special interest (no set-aside). If APPFL has or plans agent/MCP tooling (the repo already has an APPFL agent skill), a work package on "agent-operable FL" (MCP server for configuring and launching federations) could be a differentiator. Include it only if it is real and maintained.

## 6. Conflict-of-interest note

You serve as a PESOSE panelist. Before submitting:
- Tell the PESOSE program officer that you plan to submit. You cannot sit on, or see, the panel that reviews your proposal.
- Do not use anything from proposals or panel discussions you reviewed (confidential). The PESOSE reviewer-training criteria in the .pptx are generic program guidance and are fine to use.
