# Next-Generation APPFLx: Hybrid, Multi-Auth, Multi-Mode FL Platform

## 1. Current APPFLx Baseline

The existing APPFLx is organized into four layers:

| Layer | What it does | Technology used |
|---|---|---|
| Authentication | Identity + federation membership | Globus Auth + Globus Groups |
| Web Configuration | Dashboard for server/client setup | Flask + React |
| Execution | Client-side training dispatch | Globus Compute (FaaS) |
| Communication | Model weight transfer | AWS S3 |

A "federation" is a Globus Group. The orchestrator invites collaborators by email. Each client installs a Globus Compute endpoint on their compute resource and registers it with the platform. When an experiment is launched, the platform optionally deploys an APPFL server as an AWS ECS container, which then drives training by submitting function calls to each client's Globus Compute endpoint.

**Key limitations to address:**
- Server is AWS-only; no alternative for NERSC or other institutional compute.
- Tightly coupled to Globus, excluding organizations that cannot use it.
- No standard OAuth2/OIDC path for institutions with their own identity systems.

---

## 2. New System Goals

1. Support **multiple server backends**: AWS ECS, NERSC Spin, and extensible to any Kubernetes cluster.
2. Support **multiple auth methods** under a unified provider (Keycloak), including Globus as a federated identity source.
3. Support **two production communication modes**: Globus Compute (existing FaaS) and gRPC (persistent server).
4. Provide a **Jupyter-based onboarding environment** separate from the production FL modes, for tutorials and pre-experiments.
5. Expose well-defined **roles**: admin, user (orchestrator), and client.
6. Keep all dimensions pluggable so new backends, auth providers, or communication modes can be added independently.

---

## 3. Roles

There are three roles in a strict hierarchy: Admin → Orchestrator → Client.

### Admin
Platform-level operator (the research group running the platform).

- **Access control:** Invite and approve Orchestrators — only users explicitly granted the Orchestrator role by an Admin can create federations. Regular sign-ups via Keycloak/Globus do not automatically get this privilege.
- **Oversight (non-sensitive):** View all federations across the platform with aggregate metadata only: federation name, member count, number of experiments launched, total compute time consumed, and current resource usage. Admins do not see model architectures, training data descriptions, experiment results, or any content-level information.
- **Resource governance:** Set per-Orchestrator quotas (compute hours, concurrent experiments, max experiment duration). Receive alerts when usage approaches thresholds. Terminate runaway experiments.
- **Platform configuration:** Configure available server backends (NERSC credentials, AWS IAM roles), manage Keycloak realm settings, and access system-level audit logs (who launched what, when, for how long — not what was trained).

### Orchestrator
A researcher authorized by an Admin to create and manage federations.

- Create a federation: choose server backend and communication mode
- Invite Clients to the federation by email or identity; view all members and their status
- Configure the FL experiment: model, algorithm, DP budget, hyperparameters
- Run AIDRIN data readiness check across client sites before launching
- Launch experiments and monitor training progress (metrics, logs)
- Download or deploy the final global model
- Cannot exceed their assigned resource quota

### Client
A data-holding site invited into a federation by an Orchestrator.

- View federations they have been invited to
- Complete the setup required by the chosen communication mode:
  - **Globus Compute:** register a Globus Compute endpoint UUID and upload a dataloader via the portal
  - **gRPC:** download a JWT auth token and server address from the portal; run the APPFL client agent locally
- View their own local training metrics privately
- Run AIDRIN locally and submit a privacy-preserving readiness summary to the platform

---

## 4. Authentication: Keycloak as the Unified Layer

Rather than maintaining two separate auth stacks, Keycloak serves as the single authentication and authorization layer for the entire platform. Keycloak is an open-source identity and access management server that supports standard OAuth2/OIDC flows and can federate with external identity providers.

**Globus is integrated as an identity provider within Keycloak.** Keycloak can accept a Globus login (via OIDC brokering), map the Globus identity to a platform user record, and issue platform-native JWTs. From the platform's perspective, all users — whether they authenticate via Globus, institutional LDAP, or any other method — are normalized into the same user model. This solves the Globus-exclusivity problem without abandoning Globus users.

**What Keycloak provides:**
- Standard OAuth2/OIDC: any client that speaks standard auth protocols works without a Globus SDK
- LDAP/Active Directory integration: users can log in with existing institutional credentials
- External IdP federation: Globus, Google, GitHub, SAML-based institutional portals — all accepted and normalized
- Standard JWT issuance with a JWKS endpoint, which gRPC servers and the API gateway can validate locally without calling back to an external service
- Fine-grained authorization policies manageable by the platform team

**Federation membership** is implemented as Keycloak Groups. Creating a federation creates a group; inviting a client adds them to the group with a client role.

**Deployment:** Keycloak runs as a containerized service on the platform itself (on NERSC Spin or AWS), with a persistent database backend.

---

## 5. Server Backend

The server backend controls *where and how* the FL aggregator runs. This is independent of the communication mode chosen for a given experiment.

### Abstraction

The platform defines a `ServerBackend` module with operations: deploy a server container given a configuration, query its status, stream its logs, and tear it down when the experiment ends. Each backend implements these operations against its target infrastructure.

### Option A: AWS ECS (existing)

Runs the FL server container as an ECS Task (Fargate). Integrates naturally with AWS S3 for model weight storage and CloudWatch for logs. No NERSC account required.

**Best for:** users without NERSC access; general availability.

**Limitation:** per-experiment cost; no direct access to NERSC storage.

### Option B: NERSC Spin

NERSC Spin is NERSC's containers-as-a-service (CaaS) platform, built on **Rancher** managing **Kubernetes** clusters. Understanding the key concepts helps:

**What is Kubernetes?** Kubernetes (K8s) is a cluster manager for containers. Instead of manually starting containers on servers, you describe what you want (which container image, how many replicas, what network access) and K8s figures out the rest — where to run it, how to restart it if it crashes, and how to expose it to the network.

**Key Kubernetes concepts relevant here:**

| Concept | What it does |
|---|---|
| **Pod** | The smallest unit: one or more containers running together on one node |
| **Deployment** | Declares "keep N replicas of this Pod alive; restart if any crash" |
| **Service** | Gives a stable internal DNS name and IP to a set of Pods, even as they restart |
| **Ingress** | Routes external network traffic (HTTP/gRPC) into Services, with TLS termination |
| **Namespace** | Logical partition within a cluster; different projects use different namespaces |
| **ConfigMap / Secret** | Inject configuration and credentials into containers at runtime |

When the platform deploys an FL server to Spin, it creates a Deployment (the server container), a Service (stable internal address), and an Ingress (public external endpoint with TLS). The platform manages all of this programmatically via the Kubernetes API. The Rancher web UI at NERSC can be used for manual inspection.

**Why Spin is especially well-suited for FL servers:**
- Spin containers can mount NERSC filesystems directly, so logs and model checkpoints go to NERSC storage without data movement.
- NERSC users already have accounts; no separate cloud credentials needed.
- Spin is in the same network domain as NERSC HPC systems (Perlmutter, etc.), so Globus Compute endpoints on those systems communicate with the FL server at very low latency.
- No per-experiment cloud cost.

### Option C: Generic Kubernetes

Identical to the Spin backend but pointed at any user-provided Kubernetes cluster — institutional K8s, regional cloud (GKE, AKS, EKS), or self-managed. The user supplies credentials for a namespace on their cluster; the platform deploys the server there using the same mechanism as Spin.

This makes the platform extensible to any institution running Kubernetes without code changes.

### Option D: AmSC / DOE HPC Facilities

The American Science Cloud (AmSC) provides a unified Python SDK for submitting batch jobs to DOE national laboratory HPC systems — currently ALCF (Polaris, Aurora, Sophia) and NERSC (Perlmutter), with more facilities planned. It standardizes job submission across different schedulers (PBS at ALCF, Slurm at NERSC) through a single Facility API. Auth is Globus-based, which integrates naturally with the Keycloak + Globus IdP setup already in the platform.

Using the AmSC backend, the platform submits the FL server (or coordinator) as a batch HPC job on leadership-class systems, giving access to large GPU allocations that neither ECS nor Spin can match. This is the right backend when the FL task itself is computationally intensive on the server side — large model aggregation, server-side fine-tuning, or server-side inference.

**Important constraint:** HPC systems at ALCF and NERSC generally allow outbound connections but do not expose public inbound ports. This means gRPC mode (which requires clients to connect inbound to the server) is not straightforward for an AmSC-launched job. The AmSC backend is therefore best paired with **Globus Compute mode**, where the server only needs outbound connectivity to Globus cloud to dispatch function calls to client endpoints.

**Beyond server-side compute — three additional AmSC integrations:**

- **Client-side HPC provisioning.** AmSC's Facility API also gives FL clients a standardized way to submit training jobs to DOE facilities. Rather than manually configuring a Globus Compute endpoint on Polaris or Perlmutter, a client with AmSC access can register their facility allocation in the platform portal, and the platform manages job submission for each FL round through AmSC automatically. This significantly lowers the barrier for DOE facility users to participate as FL clients.

- **Data catalog.** AmSC provides a Catalog API for discovering and accessing DOE scientific datasets (FAIR-ready, AI-ready). For FL experiments using DOE-hosted data, the platform can integrate with the AmSC catalog to let orchestrators search for and link datasets to a federation directly from the portal. AIDRIN readiness assessments can then be run against catalog-registered datasets without manual data staging.

- **Filesystem access.** AmSC's Filesystem API supports standard file operations (list, copy, move, stat) across ALCF and NERSC storage systems. This provides a clean path for staging model weights to facility storage between FL rounds, or for writing experiment artifacts (logs, checkpoints, final models) to a shared project directory accessible to all DOE-facility-based participants.

**Auth:** AmSC requires a Globus account plus IRI API allowlist approval at the target facility (separate from having an HPC account — users must request this from facility support). Since the platform already integrates Globus through Keycloak, the AmSC credential flow reuses the same auth path with no additional login.

### Option E: Local / Manual

The user runs the APPFL server locally (as a Docker container or Python process) and registers the endpoint address manually in the portal. The platform does not manage the lifecycle but distributes the endpoint to clients. Useful for testing and air-gapped environments.

---

## 6. Client Communication Modes

The communication mode controls *how* the FL server and clients exchange training signals during an experiment. The choice is independent of the server backend.

### Mode A: Globus Compute (FaaS — existing)

**Pattern:** Function-as-a-Service. The server never maintains a persistent connection to clients. Instead, each training round is a remote Python function call submitted to the client's Globus Compute endpoint. The server dispatches the `local_train` function with the current global model; the client executes it on their local compute and returns the updated weights. Globus cloud infrastructure relays these calls, so the client only needs outbound internet access to Globus — no inbound ports required.

**Model weight transfer:** Globus Compute payloads are size-limited for large models; weights are staged through AWS S3 or Globus Transfer (better for NERSC-based clients).

**Client setup:** Install the Globus Compute endpoint agent on the target compute resource, configure it (scheduler settings, allocation), register the endpoint UUID and upload a `dataloader.py` via the portal.

**Best for:**
- HPC clients (SLURM, PBS) already in the Globus ecosystem
- Asynchronous FL algorithms (FedCompass, FedBuff) where clients do not need to be simultaneously online
- Heterogeneous client compute (laptop, cluster, cloud VM)

**Limitation:** Requires outbound connectivity to Globus cloud. Some secured clinical environments block this.

### Mode B: gRPC

**Pattern:** Persistent bidirectional streaming. The server runs a long-lived gRPC service with a public endpoint (provided by K8s Ingress or ECS load balancer). Clients connect, authenticate using a JWT token issued by Keycloak (downloaded from the portal), and participate in FL rounds via structured message exchange. gRPC uses HTTP/2 under the hood — efficient, binary-framed, and standard enough to work through most enterprise firewalls on port 443.

For large model weights that do not fit in a single message, the server issues pre-signed download URLs (pointing to S3 or Globus Transfer) instead of sending weights inline.

**Client setup:** Download the auth config (server address + JWT token) from the portal. Run the APPFL client agent with one command, pointing it at the local dataloader and the server address. No Globus account or endpoint daemon required.

**Best for:**
- Clients that cannot install Globus but have standard outbound HTTPS/443 access
- Real-time synchronous FL where per-round latency matters
- Hospital or enterprise environments with standard but strict firewall rules

**Limitation:** Server must have a stable public hostname and TLS certificate — handled automatically by K8s Ingress with cert-manager, or by ECS load balancer.

---

## 7. Jupyter Onboarding Environment

The Jupyter environment is **not** a third production communication mode. It is a separate, standalone onboarding and pre-experimentation tool deployed by the platform.

**What it is:** A JupyterHub instance deployed as a **container with all necessary packages pre-installed** — including `appfl`, `globus-compute-endpoint`, and related dependencies. Users access it via SSO through the platform's Keycloak auth and get their own isolated notebook server without installing anything locally. Because the container already has everything set up, users can run actual FL experiments directly from notebook cells — registering a Globus Compute endpoint, writing and testing a dataloader, launching a small-scale FL run against a gRPC server, or inspecting model outputs interactively.

The hub comes pre-loaded with tutorial notebooks covering:
- How to set up and register a Globus Compute endpoint from within the notebook
- How to write and test a dataloader for your local dataset
- How to configure and run a small FL experiment via the Globus Compute path
- How to configure and connect to an FL server via gRPC
- How to interpret training metrics and model outputs

**What it is for:**
- New users who want a zero-setup entry point — open a browser, log in, and run
- Testing that a dataloader works correctly before committing to a full-scale experiment
- Prototyping model architectures interactively
- Running small-scale trial experiments to validate the end-to-end flow before switching to a production run
- Workshops and tutorials where participants need immediate, friction-free access

**What it is not for:** Large-scale or long-running production FL experiments. Once users have validated their setup in the Jupyter environment, they move to the Globus Compute or gRPC mode for real experiments via the main portal.

**Auth:** SSO via Keycloak — the same login as the main portal, no separate account.

---

## 8. AIDRIN Integration

AIDRIN runs at each client site (never at the server), so no raw data leaves the institution. The integration flow:

1. Before launching an experiment, the orchestrator triggers a data readiness check from the portal.
2. Each client runs AIDRIN locally against their dataset. AIDRIN evaluates: completeness (missing values, label coverage), harmonization readiness (OMOP/FHIR alignment), cohort representation (demographic distributions, computed with differential privacy noise before upload), and AI-suitability for the configured model.
3. Each client submits a privacy-preserving summary (statistics, not raw data) to the platform API.
4. The platform aggregates the summaries and shows the orchestrator a readiness dashboard: which sites are ready, which have issues, and AIDRIN's recommended remediation steps.
5. The orchestrator decides whether to proceed or ask specific clients to address issues first.

CADRE is the in-workflow extension: it performs the same readiness checks at the start of each FL round, allowing the server to detect data drift or site-level issues mid-experiment without ever seeing raw data.

---

## 9. System Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Web Portal                                   │
│         Admin View   │   Orchestrator View   │   Client View         │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────────────┐
│                       Platform Backend (API)                         │
│                                                                      │
│  ┌─────────────────────┐   ┌─────────────────┐   ┌───────────────┐  │
│  │   Auth (Keycloak)   │   │   Federation    │   │  Experiment   │  │
│  │                     │   │   Manager       │   │  Manager      │  │
│  │  - Globus (via IdP) │   │  - create       │   │  - launch     │  │
│  │  - LDAP / OIDC      │   │  - invite       │   │  - monitor    │  │
│  │  - JWT issuance     │   │  - list         │   │  - teardown   │  │
│  └─────────────────────┘   └─────────────────┘   └───────────────┘  │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                  Server Backend Manager                        │  │
│  │                                                                │  │
│  │  AWS ECS │ NERSC Spin (K8s) │ Generic K8s │ AmSC/HPC │ Manual  │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────┐   ┌────────────────────────────┐  │
│  │  Communication Mode Manager  │   │  AIDRIN / Readiness        │  │
│  │                              │   │  Aggregation Service       │  │
│  │  Globus Compute  │  gRPC     │   │  (receives privacy-safe    │  │
│  └──────────────────────────────┘   │   summaries from clients)  │  │
│                                     └────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
         │ deploy & manage              │ onboarding (separate)
┌────────▼─────────┐          ┌─────────▼────────────────┐
│  FL Server       │          │  Jupyter Onboarding Hub  │
│  Container       │          │  (pre-loaded tutorials   │
│  (one per expt)  │          │   for GC and gRPC setup) │
└────────┬─────────┘          └──────────────────────────┘
         │
         │ ← GC function calls OR gRPC streams
         │
┌────────▼──────────────────────────────────────────────┐
│                    Client Sites                        │
│                                                       │
│  Site A                         Site B               │
│  (Globus Compute endpoint        (gRPC client agent  │
│   on HPC / SLURM)                on hospital server) │
└───────────────────────────────────────────────────────┘
```

---

## 10. Decision Matrix

When a user creates a federation, they choose two things independently:

| | **Globus Compute** | **gRPC** |
|---|---|---|
| **AWS ECS** | Existing; server on AWS, clients use GC | New; gRPC server on ECS behind load balancer |
| **NERSC Spin (K8s)** | New; GC coordinator runs as K8s Pod on Spin | New; gRPC server on Spin with K8s Ingress |
| **Generic K8s** | New; same as Spin but on user's cluster | New; same pattern |
| **AmSC / DOE HPC** | New; FL coordinator as HPC batch job via AmSC | Not recommended (HPC inbound firewall) |
| **Local / Manual** | Existing manual setup | Existing (APPFL already supports gRPC locally) |

AmSC also contributes two cross-cutting integrations that apply regardless of backend/mode choice:
- **Client-side:** AmSC Facility API as an alternative to manual GC endpoint setup for DOE facility users
- **Data layer:** AmSC Catalog + Filesystem API for dataset discovery and model weight staging across DOE facilities

---

## 11. Resource Governance

Since the platform is small and trusted, lightweight controls are sufficient:

- **Max experiment duration:** Enforce a configurable wall-clock limit per experiment (e.g., 48 hours) with automatic teardown. This prevents abandoned experiments from consuming resources indefinitely and is the single most impactful safeguard.
- **Concurrent experiment limit per Orchestrator:** Cap how many experiments an Orchestrator can have running simultaneously (e.g., 2). Simple to implement and effective for a small user base.
- **Admin usage dashboard:** The Admin portal shows per-Orchestrator and platform-wide usage: active experiments, backend used, and cumulative compute time. No content-level visibility — just enough to spot anomalies.

These three controls are enough for a research-group-scale deployment. If the platform grows or opens to external users, BYOC (Bring Your Own Credentials — users supply their own AWS IAM role or NERSC allocation) is the cleanest path to removing the cost burden entirely from the research group.

---

## 12. Open Design Questions

1. **Keycloak + Globus integration details.** Keycloak can accept Globus as an external OIDC identity provider (Globus supports OIDC). The details of how Globus tokens are mapped to Keycloak sessions — and how Globus Compute tokens are obtained for GC-mode experiments when the user is authenticated through Keycloak — need to be worked out. This is the most technically uncertain part.

2. **NERSC Spin access model.** Spin requires NERSC accounts. For non-NERSC orchestrators choosing Spin as the server backend, the platform likely needs a shared NERSC service account that deploys on behalf of users. This simplifies UX but may hit resource quotas; quota management then becomes a platform concern.

3. **Model weight transfer for large models in gRPC mode.** For LLMs, inline gRPC streaming is too slow. Pre-signed S3 or Globus Transfer URLs are the cleanest solution but add a storage dependency to the gRPC path. The storage backend (S3 vs. Globus vs. NERSC filesystem) should probably be a separate pluggable module.

4. **gRPC + asynchronous FL.** Async algorithms (FedBuff, FedCompass) accept updates from clients as they finish rather than waiting for a full round. In Globus Compute mode, asynchrony is natural. In gRPC mode, the server needs to handle partial updates from persistent client connections while other clients are still training. This is architecturally doable but requires careful stateful server design.

5. **Experiment lifecycle and resource cleanup.** Server containers on Spin or ECS stay running until explicitly deleted. The platform needs automatic teardown on: experiment completion, configurable timeout, or missed heartbeat. Without this, idle containers accumulate and consume quota or cost.

6. **Federation-level vs. experiment-level resources.** Should one gRPC server serve multiple sequential experiments in the same federation, or is it one server per experiment? One-per-experiment is simpler and cleaner (no state leakage between runs) but incurs startup latency for each run. One-per-federation reduces overhead but complicates the server's internal state management.

9. **AmSC IRI API allowlist as a barrier.** AmSC requires per-facility allowlist approval beyond simply having an HPC account. The platform cannot provision this on behalf of users — each participant must request it from facility support themselves. This is a human process that could slow onboarding. The platform should detect whether a user's AmSC credentials have the required facility access and surface clear instructions if not.

10. **AmSC client-side vs. Globus Compute for DOE facility clients.** AmSC's Facility API and Globus Compute both provide ways to submit jobs to ALCF/NERSC, but via different abstractions. Globus Compute wraps individual Python function calls; AmSC submits full batch jobs. For FL training rounds, Globus Compute's function-level granularity fits more naturally. AmSC may be more appropriate for longer-running training jobs that benefit from full HPC node allocation. The platform should clarify when to recommend each path for DOE facility clients.
