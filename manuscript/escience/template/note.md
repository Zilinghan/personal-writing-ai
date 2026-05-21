# APPFLx Next-Generation Platform: Framework Design Note

This document describes the component architecture of the redesigned APPFLx platform for internal alignment. The platform is organized into five layers: **Roles**, **Authentication**, **Computing Resources**, **Applications**, and **Configuration & Result Tracking**.

---

## 1. Roles

The platform defines three roles in a strict hierarchy: Admin → Orchestrator → Client. Each role has a different scope of access, visibility, and responsibility within the system and within any given FL experiment.

---

### 1.1 Admin

**What the role is:**
The Admin is the platform operator — shortly, for now, the five of us in the trac meeting. There is a small number of admins. The Admin might not participate in FL experiments directly; their job is to manage who can use the platform and to monitor that usage remains reasonable.

**How the role is created:**
The first Admin account is bootstrapped at platform setup. Subsequent Admin accounts are granted by an existing Admin through the Keycloak admin console or the platform portal. There is no self-registration path to Admin.

**What the Admin can control:**
- Approve and grant the Orchestrator role to registered users. A user who signs up via Keycloak (through Globus, institutional login, or any other supported authentication method) does not automatically become an Orchestrator — an Admin must explicitly elevate them.
- Configure available compute backends: add NERSC Spin credentials, AWS IAM roles, or AmSC facility allocations that Orchestrators can choose from.
- Set per-Orchestrator resource limits: maximum number of concurrently running experiments, and maximum wall-clock duration per experiment.
- View the platform-wide usage dashboard and terminate runaway experiments.

**What data the Admin can see:**
The Admin sees only non-sensitive aggregate operational data:
- Which federations exist (name, creation date, Orchestrator)
- How many members each federation has
- How many experiments have been launched, their backend, duration, and status (running / completed / failed / timed out)
- Total compute time consumed per Orchestrator

The Admin does **not** see model architectures, training data descriptions, hyperparameters, training metrics, or any content-level information about experiments.

**Budget enforcement:**
The Admin sets per-Orchestrator limits. The platform enforces a maximum experiment wall-clock duration (auto-teardown when exceeded) and a maximum number of concurrent running experiments per Orchestrator. These are lightweight controls appropriate for a small trusted user base.

**Role in an FL experiment:**
None directly. The Admin is responsible only for platform health, not for any individual experiment.

---

### 1.2 Orchestrator

**What the role is:**
The Orchestrator is a researcher who wants to run a federated learning study with his/her own collaborators. They own the federation — they define who participates, what gets trained, and which compute infrastructure to use. This maps to the "federation admin" or "group admin" concept in the previous APPFLx system, but is now a formal platform role separate from the platform Admin.

**How the role is created:**
A user registers on the platform via Keycloak (using Globus, institutional LDAP, or another supported identity provider). The Admin then grants them the Orchestrator role. Without this explicit grant, a registered user can only be a Client.

**What the Orchestrator can control:**
- Create federations and choose the compute backend (AWS ECS, NERSC Spin, AmSC/HPC, or BYOC-Bring Your Own Compute). Each federation can host multiple experiments of different application types (see Section 4).
- Invite Clients to the federation by email or platform identity.
- Configure FL experiments: model, training algorithm, privacy settings, number of rounds, evaluation metrics, and whether to run AIDRIN data readiness inspection.
- Launch experiments and stop them early if needed.
- View and download experiment results.
- Manage federation membership (add or remove Clients at any time).

**What data the Orchestrator can see:**
- Full experiment configuration they specified.
- Per-round global model performance metrics (loss, accuracy, AUC, etc.) for the experiments they own.
- Per-client participation status per round: whether a client contributed an update and how long their local training took. The Orchestrator does **not** see individual client local loss or accuracy unless the client explicitly opts to share it.
- Server-side experiment logs.
- AIDRIN readiness report aggregated across clients (no individual client's raw data).
- Final global model artifact.

**Budget enforcement:**
Resource limits apply only to experiments using APPFLx-provided compute resources (ECS, Spin, AmSC). For those, the platform blocks new experiment launches if the Orchestrator has already reached their concurrent experiment cap, and automatically tears down experiments that exceed the maximum duration. For BYOC experiments, no platform resource limits are imposed — the Orchestrator is fully responsible for managing their own resource usage. The Orchestrator can see their own APPFLx-backed usage (total compute time this month, currently running experiments) in the portal.

**Role in an FL experiment:**
The Orchestrator configures and launches the FL server (through the platform portal). Once launched, the server handles the training orchestration. The Orchestrator monitors progress via the portal and can stop the experiment at any time. They collect and use the final global model.

---

### 1.3 Client

**What the role is:**
The Client is a data-holding participant invited into a federation by an Orchestrator. The Client contributes local private data to the FL experiment but never shares the raw data — only locally computed model updates leave their site. The Client uses their own compute resources; the platform does not provision anything on the Client's behalf.

**How the role is created:**
The Orchestrator sends an invitation (by email or platform identity) through the portal. The invited person follows the invite link, authenticates via Keycloak (Globus or institutional login), accepts the invitation, and appears in the federation as a Client. There is no Admin approval step for Client creation — the Orchestrator controls this entirely within their own federation.

**What the Client can control:**
- Accept or decline federation invitations.
- Register their local compute resource with the platform (either a Globus Compute endpoint UUID for GC-mode experiments, or simply download a JWT token and server address for gRPC-mode experiments).
- Upload a dataloader (a Python file describing how to load their local private dataset) for the federation.
- Run AIDRIN locally against their dataset and submit a privacy-preserving readiness summary to the platform.

**What data the Client can see:**
- The list of federations they belong to.
- The same set of FL experiment results as the Orchestrator: per-round global model metrics, per-client participation status per round, aggregated AIDRIN readiness reports, server-side experiment logs, and the final global model.
- Their own local training metrics per round (local loss, local accuracy) and whether their update was included in aggregation each round. They do **not** see other clients' local metrics.

**Budget enforcement:**
Clients use their own compute resources (their own HPC allocation, their own laptop or cluster). No platform compute budget is consumed by Client-side training. No budget controls are applied to the Client role.

**Role in an FL experiment:**
Once the experiment is launched by the Orchestrator, the Client either: (a) has a Globus Compute endpoint already running that the server calls into for each training round, or (b) starts the APPFL client agent on their machine and connects to the gRPC server. The Client's machine performs local training on private data each round and returns model updates to the server. Raw data never leaves the Client's site.

---

## 2. Authentication Layer

All identity and access management in the platform is handled through a self-hosted **Keycloak** instance, deployed as a containerized service on NERSC Spin or AWS.

### 2.1 Authentication

Users authenticate via Keycloak's standard OAuth2/OpenID Connect (OIDC) flow when they open the portal. Keycloak supports multiple identity sources, all normalized into a single platform user model:

- **Globus:** Keycloak is configured to accept Globus as a federated external identity provider (Globus supports OIDC). A user who logs in with their Globus account is authenticated through Keycloak transparently — from the platform's perspective, all users are Keycloak-managed regardless of which IdP they used.
- **Institutional LDAP / Active Directory:** Keycloak can connect directly to an institution's LDAP or AD server, allowing users to log in with their existing organizational credentials.
- **Standard OIDC:** Any organization that runs its own OIDC-compliant identity server can be registered as an external provider in Keycloak.

This means the platform is not locked to Globus — any researcher with an institutional account or an OIDC-compatible identity can participate, which addresses the key limitation of the original APPFLx.

### 2.2 Authorization

**Platform-level roles** (Admin, Orchestrator) are implemented as Keycloak realm roles. A user's role is encoded in the JWT token Keycloak issues, and the platform API reads it on every request.

**Federation membership** is implemented as Keycloak Groups. When an Orchestrator creates a federation, the platform creates a corresponding Keycloak Group. When a Client accepts an invitation, they are added to that group with a Client role. API endpoints and resource access are gated on group membership — a Client in Federation A cannot access Federation B's configuration or results.

**Experiment-level access** within a federation follows the same pattern: Orchestrators have read-write access to experiment config and results; Clients have read-only access to their own per-client result slice.

### 2.3 Token Flow

1. User opens the portal → Keycloak OIDC flow → Keycloak issues a signed JWT access token.
2. The portal sends the JWT on every API call → the platform API validates the JWT signature against Keycloak's public JWKS endpoint.
3. For gRPC-mode experiments: the platform generates a federation-scoped JWT (still signed by Keycloak) and makes it available for the Client to download from the portal. The Client's APPFL agent presents this token to the gRPC server, which validates it against Keycloak's JWKS endpoint. No callback to the portal is needed at runtime — JWT validation is stateless.
4. For Globus Compute-mode experiments: Globus tokens (obtained via the Globus OIDC flow inside Keycloak) are used to authorize calls to Globus Compute endpoints.

### 2.4 Keycloak Deployment

Keycloak runs as a containerized workload on the same infrastructure as the rest of the platform (NERSC Spin or AWS), backed by a PostgreSQL database. It is configured with the platform's domain and issues tokens scoped to the platform's API and gRPC services.

---

## 3. Computing Resource Layer

This layer abstracts over heterogeneous compute infrastructure. Its job is to take an application container image and a configuration, deploy it to the chosen backend, expose a network endpoint to Clients, monitor it, and tear it down when the experiment ends. The choice of backend is independent of the application type (with one exception noted below).

### 3.1 Supported Backends

**AWS ECS (existing)**
The platform uses its own AWS account with IAM roles scoped per federation to launch ECS Fargate tasks. ECS is the original APPFLx server backend. It integrates naturally with AWS S3 for model weight staging and CloudWatch for log collection. No NERSC account is required. Costs are charged to the research group's AWS account.

**NERSC Spin (Kubernetes)**
NERSC Spin is NERSC's containers-as-a-service platform, running on Rancher-managed Kubernetes clusters. The platform manages Spin deployments programmatically via the Kubernetes API:
- A **Deployment** is created to keep the application container running.
- A **Service** provides a stable internal network address.
- An **Ingress** exposes the endpoint externally with TLS termination.

Spin containers can mount NERSC filesystems directly (Community File System, scratch) as persistent storage, which is useful for writing model checkpoints or reading shared datasets. NERSC allocation is consumed. Compute costs are charged to the research group's NERSC project.

**AmSC / DOE HPC Facilities (future)**
The American Science Cloud (AmSC) provides a unified Python SDK for submitting batch jobs to DOE HPC systems — currently ALCF (Polaris, Aurora, Sophia via PBS) and NERSC (Perlmutter via Slurm), with more facilities planned. Using AmSC, the platform can submit the FL coordinator as an HPC batch job, giving access to leadership-class GPU allocations. AmSC uses Globus authentication, which integrates naturally with the platform's Keycloak + Globus IdP setup.

AmSC also contributes two additional integrations beyond server-side compute:
- **Catalog API:** Orchestrators can search and link DOE-hosted scientific datasets to a federation from within the portal. AIDRIN can assess the readiness of catalog-registered datasets.
- **Filesystem API:** Provides programmatic file operations across ALCF and NERSC storage, useful for staging model weights between rounds or writing experiment outputs to a shared project directory.

Note: HPC systems at ALCF and NERSC do not accept inbound network connections from outside the facility. The AmSC backend is therefore only compatible with **Globus Compute-based applications** (where the server makes outbound calls to Globus cloud), not with gRPC-based applications (which require Clients to connect inbound to the server). AmSC also requires IRI API allowlist approval at the target facility in addition to a standard HPC account.

**Bring Your Own Compute (BYOC)**
For Orchestrators who have their own cloud or facility resources, the platform can deploy into their infrastructure rather than the research group's:
- **AWS BYOC:** The Orchestrator provides a cross-account IAM role ARN. The platform assumes that role to launch ECS tasks in their account; costs are charged to them.
- **NERSC Spin BYOC:** The Orchestrator provides credentials for their own Spin namespace. The platform deploys into their namespace using their NERSC allocation.
- **AmSC BYOC:** The Orchestrator registers their own facility allocation through AmSC. Jobs are submitted under their allocation.

BYOC removes compute cost from the research group entirely and is the recommended path for Orchestrators running regular large-scale experiments.

### 3.2 Budget Enforcement at This Layer

- **Maximum experiment duration:** Each experiment has a configurable wall-clock time limit. The platform sets a timer at launch and calls the backend's teardown operation when the limit is reached, regardless of whether training has finished. This is the most important safeguard against forgotten running experiments consuming resources indefinitely.
- **Concurrent experiment cap:** The platform checks the Orchestrator's currently running experiment count before provisioning a new one and blocks the launch if the cap is exceeded.
- **For BYOC backends:** No platform budget is consumed and no platform resource limits are imposed. The Orchestrator is fully responsible for managing their own resource usage.

---

## 4. Application Layer

An "application" is a deployable unit that combines a specific server-side container image with a corresponding client-side interaction pattern. The platform currently defines four applications. A federation is not tied to a single application type — the Orchestrator can launch experiments of different application types within the same federation. The application type is chosen per experiment, not per federation; the choice determines what gets deployed on the server side and what the Client needs to do.

---

### Application 1: Globus Compute FL Orchestrator *(currently supported by APPFLx)*

**What it is:** A production FL application where the server acts as a coordinator that dispatches training function calls to Client-side Globus Compute endpoints. Each FL round is a remote Python function call: the server submits a `local_train` function to each Client's endpoint, the Client executes it on their local compute, and returns model updates. The Globus cloud infrastructure relays these calls, so Clients only need outbound internet access to Globus — no inbound ports are required on the Client side.

**Server side:** An APPFL coordinator container deployed on any supported backend (ECS, Spin, AmSC/HPC, or BYOC). The container runs the chosen FL aggregation algorithm and manages the round-by-round training loop by issuing Globus Compute function calls.

**Client side:** The Client installs the `globus-compute-endpoint` agent on their target compute resource (laptop, HPC cluster, cloud VM), configures it for their local scheduler (SLURM, PBS, or local), and registers the endpoint UUID in the platform portal. The Client also uploads a `dataloader.py` that describes how to load their private local dataset.

**Best suited for:** Production FL experiments on HPC clients already in the Globus ecosystem; asynchronous FL algorithms (FedCompass, FedBuff) where Clients do not need to be simultaneously online; heterogeneous Client compute environments.

**Compatible backends (server-side):** All (ECS, Spin, Generic K8s, AmSC/HPC, BYOC). Note: "compatible backends" throughout this section refers to where the FL server or coordinator service is deployed, not the client's compute environment.

---

### Application 2: gRPC FL Server

**What it is:** A production FL application where the server runs a persistent gRPC service and Clients connect to it directly. FL rounds proceed as structured message exchanges over bidirectional HTTP/2 streams. Clients authenticate to the server using a JWT token issued by the platform's Keycloak instance. The gRPC server endpoint is exposed publicly via a Kubernetes Ingress (with TLS) or an ECS load balancer.

**Server side:** An APPFL gRPC server container deployed on a backend that can expose a public network endpoint (ECS, Spin, Generic K8s, or BYOC). In APPFL's gRPC implementation, the **client** controls the training loop — the server is reactive and only responds to client requests. Clients decide when to pull the global model, when to push local updates, and what types of requests to send. For large model weights that do not fit in a single gRPC message, the server issues pre-signed download URLs (S3 or Globus Transfer) for out-of-band weight transfer.

**Client side:** The Client downloads a client template script from the portal — containing the gRPC server URI and a JWT token scoped to their federation. The template is customizable: Clients can configure options such as whether to run AIDRIN data readiness inspection before training, local training hyperparameters, and so on. The client script drives the training loop, sending requests to the server (ai readiness result update, model update push, etc.) according to the configured FL algorithm. No Globus account or endpoint daemon is required. The Client provides a local `dataloader.py` pointing to their private data.

**Best suited for:** Production FL experiments at sites that cannot use Globus but have standard outbound HTTPS/443 access (e.g., hospital environments with strict but standard firewall rules); synchronous and asynchronous FL algorithms; scenarios where clients need fine-grained control over the training loop.

**Compatible backends (server-side):** ECS, NERSC Spin, Generic K8s, BYOC. Not compatible with AmSC/HPC (HPC nodes do not accept inbound connections).

---

### Application 3: Jupyter Server — Globus Compute Notebooks

**What it is:** An onboarding and pre-experimentation environment. The platform deploys a JupyterHub instance with all necessary packages pre-installed (`appfl`, `globus-compute-endpoint`, and dependencies). Users access it via SSO through Keycloak and get their own isolated notebook server — no local installation required. The hub comes pre-loaded with tutorial notebooks that walk through the Globus Compute-based FL workflow interactively.

**What the notebooks cover:**
- Setting up and registering a Globus Compute endpoint from within the notebook environment
- Writing and testing a dataloader for a local or sample dataset
- Configuring and launching a small-scale Globus Compute-based FL experiment using the APPFL Python API
- Interpreting training metrics and model outputs

**Server side:** A Jupyter server container deployed on ECS or Spin, with all required packages pre-installed (`appfl`, `globus-compute-endpoint`, and dependencies). After deployment, the platform provides the Orchestrator with a direct link and a token to access the notebook interface — no Keycloak SSO login is involved in accessing the Jupyter server itself.

**Client side:** Clients do not access the Jupyter server directly. They only need to start their Globus Compute endpoints on their own compute resources and provide the endpoint UUID to the Orchestrator, who enters it into the notebook cells to configure and run the FL experiment.

**Best suited for:** New users learning the Globus Compute path before running production experiments; workshops and tutorials; testing that a dataloader works correctly; prototyping model architectures interactively. Once the user is confident in their setup, they transition to Application 1 for real experiments.

**Compatible backends (server-side):** ECS, NERSC Spin, BYOC (AWS and Spin). Not compatible with AmSC/HPC (HPC nodes cannot expose a web-accessible Jupyter interface).

---

### Application 4: Jupyter Server — gRPC Notebooks

**What it is:** An onboarding and pre-experimentation environment for the gRPC-based FL workflow. The platform deploys a Jupyter server with gRPC-themed notebooks for the Orchestrator, alongside a gRPC FL server endpoint that clients can connect to during the tutorial. Unlike Application 3 where clients do not interact with the online Jupyter server — the clients are provided a pre-configured notebook file to download and run in their own local Jupyter environment.

**What the Orchestrator's notebooks cover:**
- Configuring and launching a small-scale gRPC FL server from the notebook
- Monitoring per-round global metrics inline
- Interpreting training results and model outputs

**What the client notebook covers:**
- Obtaining the gRPC server URI and JWT token from the platform portal
- Testing connectivity to the gRPC server
- Writing and validating a local dataloader
- Running the gRPC client training loop locally using the APPFL gRPC client API
- Inspecting per-round results from the client perspective

**Server side:** A Jupyter server container deployed on ECS or Spin for the Orchestrator's use, plus a gRPC FL server endpoint for clients to connect to. The Orchestrator accesses the Jupyter server via a link and token provided by the platform portal.

**Client side:** Clients download a pre-configured notebook file (`.ipynb`) from the platform portal and run it in their own local Jupyter environment. The notebook provides step-by-step guidance for acting as a gRPC FL client — no access to the online server is needed.

**Best suited for:** New users learning the gRPC path; sites where Globus Compute is not an option; users who need hands-on experience with the gRPC client workflow before running production experiments with Application 2.

**Compatible backends (server-side):** ECS, NERSC Spin, BYOC (AWS and Spin). Not compatible with AmSC/HPC (HPC nodes cannot expose a web-accessible Jupyter interface).

---

## 5. Configuration and Result Tracking Layer

This layer manages all inputs needed to run an experiment and all outputs produced by it. Configuration is collected through the portal at experiment creation time and stored persistently. Results are tracked in real time during training and retained after completion, with visibility scoped by role.

### 5.1 Configuration

**Common configuration - just name a few (required for Applications 1 and 2; pre-filled in Applications 3 and 4):**

| Parameter | Description |
|---|---|
| Number of FL rounds | How many global aggregation rounds to run |
| Model definition | Model architecture (uploaded as a Python file or selected from a registry) |
| Trainer | Local training procedure (optimizer, loss function, local epochs, batch size) |
| FL algorithm | Aggregation strategy: FedAvg, FedProx, FedAdam, FedCompass, FedBuff, etc. |
| Evaluation metric | Metric to report per round: accuracy, AUC, MSE, F1, etc. |
| Privacy settings | Differential privacy (ε, clipping norm, noise mechanism); secure aggregation on/off |
| AIDRIN inspection | Whether to run data readiness inspection before launching; which dimensions to assess |

**Application 1 (Globus Compute) — additional configuration:**

| Parameter | Description |
|---|---|
| Per-client GC endpoint UUID | Each Client's registered Globus Compute endpoint identifier |
| Per-client dataloader | Python file uploaded by each Client describing how to load their local dataset |
| GC worker settings | Number of workers, local batch config (configured by each Client on their endpoint) |

**Application 2 (gRPC) — additional information surfaced to Clients:**

| Parameter | Description |
|---|---|
| gRPC server URI | Auto-generated by the platform after deployment (e.g., `fed-grpc-42.trac.appflx.link`) |
| Client JWT token | Per-Client auth token issued by Keycloak, scoped to this federation and experiment; downloadable from the portal |

Applications 3 and 4 (Jupyter) use simplified configuration: the notebooks themselves guide users through the relevant settings interactively. The Orchestrator only needs to choose the application and the compute backend; detailed experiment config is handled inside the notebook cells.

All configurations are stored in the platform database versioned by experiment, so that experiments can be reproduced or re-run with the same settings.

---

### 5.2 Result Tracking

Results are tracked at multiple granularities during and after the experiment, and are exposed to different roles according to the following access policy.

**During the experiment:**

The FL server reports results to the platform API at the end of each round. The portal displays live metrics via WebSocket streaming. Roles see:

- **Admin:** Experiment status (running / completed / failed), current round number, elapsed time, backend. No model metrics.
- **Orchestrator:** All of the above plus per-round global model metric (loss, accuracy, or other configured metric), plotted as a curve. Per-client participation status per round (contributed / timed out / skipped) — without the Client's local metric values.
- **Client:** The same live global metrics as the Orchestrator: per-round global model performance (loss, accuracy, or other configured metric) plotted as a curve, and per-client participation status per round. Also their own local training metric per round (local loss, local accuracy) and whether their update was accepted into aggregation. They do not see other clients' local metrics.

**After the experiment:**

| Artifact | Admin | Orchestrator | Client |
|---|---|---|---|
| Experiment duration and status | Yes | Yes | Yes |
| Per-round global metric curve | No | Yes | Yes |
| Per-client participation log | No | Yes (status only) | Yes (status only) |
| AIDRIN readiness report | No | Aggregated | Aggregated |
| Server-side training logs | No | Yes | Yes |
| Final global model | No | Yes (download) | Yes (download) |
| Per-client local metric history | No | No | Own history only |

**Storage:**
- Metric time series (per-round loss, accuracy, participation flags) are stored in the platform database.
- Model artifacts (checkpoints, final model) are stored in object storage: S3 for ECS-backed experiments, NERSC filesystem for Spin-backed experiments.
- Results are retained for a configurable retention period (e.g., 90 days) after experiment completion, after which artifacts are deleted but metadata (duration, status, member count) is kept for Admin audit purposes.

**For Jupyter applications:**
Results are surfaced inline within the notebook cells as the experiment runs. There is no separate portal results view for Jupyter-based experiments — the notebook is the interface. Users can export results (metrics, model weights) from the notebook environment manually.
