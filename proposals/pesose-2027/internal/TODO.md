# PESOSE Track 2 Proposal: APPFL — TODO

Track rationale: see [track-decision.md](track-decision.md).
Writing lives in `../write/` (LaTeX). Internal notes live here.

Legend: `[ ]` open · `[x]` done · **(blocker)** must be resolved before writing goes far

---

## Phase 0 — Eligibility & logistics (do first)

- [ ] **(blocker)** Read the current PESOSE solicitation on nsf.gov and record here: solicitation number, deadline(s), page limit, required Project Description section headings, required supplementary docs, letters-of-collaboration rules, budget caps per track, and any limits on proposals per PI/institution.
- [x] Confirm APPFL (and each PI/co-PI) has **no prior POSE / SafeOSC award**. Confirmed 2026-11-23: no previous award.
- [ ] **(blocker)** Email the program officer (PESOSE@nsf.gov) with a 1-page project summary to check Track 2 fit, and ask specifically about the "well-resourced" concern for a DOE-lab-hosted project. Draft is in [po-inquiry/](po-inquiry/): fill in the placeholders, build the PDF, then send.
- [ ] Tell the PO that you are a PESOSE panelist and plan to submit (COI). Keep reviewed-proposal content out of this work entirely. This is included in the PO email draft.
- [ ] Confirm the lead institution and submission route (Argonne as lead vs. a university lead with Argonne as subaward/collaborator). Check NSF eligibility rules for FFRDCs, then talk to the sponsored-programs office.
- [ ] Register/verify Research.gov access, SAM/UEI for all organizations, and set internal routing deadlines (usually 5-10 business days before NSF deadline).
- [ ] Sign up for PESOSE updates and attend an upcoming PESOSE webinar (links in `NSF PESOSE.pdf`).

## Phase 1 — Team & partners

- [ ] Decide PI / co-PIs. Aim for at least one co-PI **outside Argonne** (university user group) to counter the "single-lab project" risk.
- [ ] Recruit a community/OSS-ecosystem person (senior personnel or consultant): community manager, OSPO staff, or someone with prior POSE experience.
- [ ] Pick an OSE-building partner organization (strongly encouraged at the info session). Candidates to contact:
  - [ ] NumFOCUS or LF AI & Data: fiscal sponsorship, governance
  - [ ] The Carpentries: training/curriculum
  - [ ] OpenSSF / Software Freedom Conservancy: security practices, licensing/compliance
  - [ ] Open Source Collective: financial infrastructure
- [ ] Identify industry and international collaborators (Track 2 criteria encourage both).
- [ ] Collect **3-5 letters of collaboration** from current users or contributors. Reviewers are told to read these closely.
  - [ ] List all known external users (institutions, projects, papers using APPFL). Check citations of APPFL papers and the Zenodo DOI; check `work/appfl-bio-suite/` for user-facing deployments.
  - [ ] Shortlist 6-8 letter writers (get extras in case some fall through), covering a range of domains: biomedical, energy/science facility, university, industry.
  - [ ] Draft the letter template. Letters must follow NSF's letter-of-collaboration format (no endorsements); verify the rule in the solicitation/PAPPG.
  - [ ] Send requests ≥6 weeks before deadline; track status in a table here.

## Phase 2 — Evidence gathering (baseline metrics)

Reviewers check whether the status claims are "backed by evidence from the repository and collaboration letters."

- [ ] Snapshot repo metrics with dates: stars, forks, releases, commits, contributors by organization, PRs/issues by external vs. internal authors, time-to-first-response, PyPI/conda downloads over time, docs page views, Discord members.
- [ ] Contributor concentration analysis (bus factor; % of commits from non-Argonne contributors over time). This is the "thin ecosystem" evidence.
- [ ] Inventory known deployments/federations (who, domain, scale, communicator used).
- [ ] Publications and citations using APPFL; tutorials and workshops already given.
- [ ] Current security posture: SECURITY.md, dependabot, CI, release process, maintainer 2FA, signing (none?). Run OpenSSF Scorecard for a baseline score.
- [ ] Competitor landscape table (Flower, NVFlare, FedML, OpenFL, FATE) and APPFL's niche.
- [ ] Prior funding list for APPFL (DOE programs etc.) and what each one did/did not cover. This feeds the "not well-resourced" argument.

## Phase 3 — Narrative design (before drafting)

- [ ] Write a one-paragraph "elevator pitch": national need → why an open ecosystem (not just a tool) → why APPFL → what the 2 years change.
- [ ] Define the ecosystem's target end state at month 24 (and month 60), e.g., governance body with N external seats, X active external maintainers, Y orgs running production federations, fiscal sponsor in place.
- [ ] Map every Track 2 review criterion to a section/work package (keep the table in this folder):
  - [ ] Ecosystem Growth: who are users/contributors/partners, how each is found, engaged, and supported
  - [ ] Organization & Governance: governance model, roles ladder, roadmap/decision process, licensing (MIT; CLA vs. DCO decision)
  - [ ] Continuous Development: CI/CD, testing infra (incl. multi-site/HPC FL integration tests), release process, plugin/extension model, quality, security, and privacy in distributed dev
  - [ ] Risk Analysis & Security: FL threat model, identity & access management, secure modification/release, vulnerability patching, chain of custody (signed releases, SBOM, provenance)
  - [ ] Community Building: onboarding path (good-first-issues → contributor → maintainer), docs, workshops, hackathons, summer school, student programs, mentoring
  - [ ] Sustainability: concrete funding targets and sources after the award (fiscal sponsor donations, industry membership, follow-on grants, institutional support, service contracts)
  - [ ] Evaluation Plan: specific metrics and benchmarks with baselines, year-1/year-2 targets, and how they are measured (avoid vague "we will evaluate")
- [ ] Decide whether to include an AI-agent-protocol work package (special-interest area). Include only if it is real.
- [ ] Draft the Intellectual Merit angle (what new knowledge the ecosystem work produces: secure-FL plugin trust model, reproducible cross-facility FL benchmarks, etc.).
- [ ] Draft the Broader Impacts angle tied to the NSF BI goals (health and welfare, economic competitiveness, academia-industry partnership, STEM workforce).
- [ ] Milestone/Gantt chart by quarter with named owners. Use specific deliverables, not "planning" or "evaluating."

## Phase 4 — LaTeX project setup (`../write/`)

- [ ] Create the LaTeX skeleton: `main.tex`, `sections/` (one file per Project Description section), `supplementary/` (DMP, Mentoring Plan, letters list, facilities), `figures/`, `refs.bib`.
- [ ] Use NSF formatting (check PAPPG: font ≥10–11pt per allowed fonts, 1-inch margins, letter paper, no page numbers in uploaded PDF, no URLs in Project Description except where allowed).
- [ ] Add a page-count check (`make` target or script) against the solicitation's limit.
- [ ] Separate build targets per uploaded document (Project Summary, Project Description, References, DMP, Mentoring Plan, Facilities).

## Phase 5 — Drafting

- [ ] Project Summary (1 page; Overview / Intellectual Merit / Broader Impacts as separate headed sections; verify any PESOSE-specific required statements).
- [ ] Project Description sections (follow the solicitation's required headings exactly; reviewers score by criterion):
  - [ ] Introduction / problem and national need
  - [ ] Current status of APPFL: product, dev & testing model, dissemination, user base, contributor base (with evidence)
  - [ ] Vision and long-term impact of the APPFL OSE
  - [ ] Ecosystem Growth
  - [ ] Organization & Governance
  - [ ] Continuous Development
  - [ ] Risk Analysis & Security
  - [ ] Community Building
  - [ ] Sustainability
  - [ ] Evaluation Plan (metrics table)
  - [ ] Team qualifications and management plan
  - [ ] Timeline / milestones
  - [ ] Broader Impacts
  - [ ] Results from Prior NSF Support (required if any PI had NSF funding in the past 5 years)
- [ ] References Cited (include pointer to the public repo, docs, DOI; slide 16 says reviewers expect it in References)
- [ ] Data Management and Sharing Plan (2 pages; covers software, community data such as metrics, privacy of contributor data)
- [ ] Mentoring Plan (1 page; required if a postdoc or grad student is budgeted; mention annual IDPs)
- [ ] Facilities, Equipment & Other Resources (CI/HPC resources, Argonne/partner infrastructure)
- [ ] Biosketches (NSF common format via SciENcv) for all senior personnel
- [ ] Current & Pending (Other) Support (SciENcv) for all senior personnel
- [ ] Collaborators & Other Affiliations (COA) spreadsheets
- [ ] Letters of collaboration (uploaded as supplementary docs)
- [ ] Any other supplementary docs the solicitation requires (check: e.g., governance or security plan as separate doc)

## Phase 6 — Budget

- [ ] Draft the budget to the Track 2 cap ($1.5M / 2 years) with the sponsored-programs office.
- [ ] Budget lines that reviewers expect to back the plans: community manager / developer-advocate effort, external-contributor stipends or fellowships, workshop/hackathon costs (participant support), security audit, CI/infra, partner org fees (fiscal sponsor), travel to OSS/science conferences.
- [ ] Budget justification that maps each line to a work package and criterion.
- [ ] Subawards for out-of-Argonne co-PIs/partners.

## Phase 7 — Review & submit

- [ ] Internal "mock panel": have 2-3 people score the draft against the Track 2 criteria list and the HC/C/LC/NC scale. (Do not use reviewer contacts or content from your own panel service.)
- [ ] Criterion-coverage check: every Track 2 criterion appears as a clearly labeled heading.
- [ ] Specificity pass: remove generic "we will plan/evaluate" language and attach a metric, owner, and date to each claim.
- [ ] Compliance check against solicitation and PAPPG (page limits, fonts, required sections, no URLs where disallowed).
- [ ] Sponsored-programs routing complete.
- [ ] Submit in Research.gov ≥2 days before the deadline; verify PDF rendering in the submitted proposal.

## Pre-submission work on the repo itself (low cost, high credibility)

Doing these before submission shows reviewers the team is already moving toward an open ecosystem:
- [ ] Add `CODE_OF_CONDUCT.md` (GitHub community profile currently shows none).
- [ ] Add a draft `GOVERNANCE.md` and `MAINTAINERS.md`.
- [ ] Publish a public roadmap (GitHub Projects or `ROADMAP.md`).
- [ ] Label 10-20 `good first issue`s.
- [ ] Enable OpenSSF Scorecard and publish the badge.
- [ ] Start an ADOPTERS / users list in the README.
