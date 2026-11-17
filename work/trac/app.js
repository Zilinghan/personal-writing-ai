// APPFL landing page: mode switch, config copy button, and the MNIST demo.
// Front-end only; sign-in buttons show a placeholder toast until auth is wired up.
(function () {
    const toastEl = document.querySelector(".toast");
    let toastTimer;

    function toast(msg) {
        toastEl.textContent = msg;
        toastEl.classList.add("show");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1800);
    }

    async function copy(text) {
        try {
            await navigator.clipboard.writeText(text);
            toast("Copied to clipboard");
        } catch {
            toast("Couldn't copy. Select the text instead.");
        }
    }

    // ---------- gRPC / Globus Compute switch in the hero card ----------
    const modeBtns = document.querySelectorAll(".seg-btn[data-mode]");
    modeBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
            const mode = btn.dataset.mode;
            modeBtns.forEach((b) => {
                const on = b === btn;
                b.classList.toggle("active", on);
                b.setAttribute("aria-selected", on);
            });
            document.querySelectorAll("[data-mode-panel]").forEach((panel) => {
                panel.hidden = panel.dataset.modePanel !== mode;
            });
        });
    });

    // ---------- copy button on the config snippet ----------
    document.querySelectorAll("[data-copy-target]").forEach((btn) => {
        btn.addEventListener("click", () => copy(document.getElementById(btn.dataset.copyTarget).innerText));
    });

    // ---------- sign-in placeholder ----------
    document.querySelectorAll('[data-action="signin"]').forEach((el) => {
        el.addEventListener("click", (e) => {
            e.preventDefault();
            toast("Sign-in isn't connected yet in this front-end mock.");
        });
    });
    // ---------- MNIST demo: scripted server notebook + two clients ----------
    // Numbers are illustrative: each client holds five digits, so neither can
    // classify all ten alone, and the global model improves round by round.
    const demo = document.getElementById("demo");
    if (demo) {
        const ROUNDS = 5;
        const TEST_ACC = [71.9, 88.4, 94.2, 96.5, 97.6];
        const CLIENTS = [
            { id: "Client1", digits: "0–4", samples: "30,596", loss: [0.212, 0.088, 0.061, 0.047, 0.039], acc: [98.9, 99.1, 99.3, 99.4, 99.5] },
            { id: "Client2", digits: "5–9", samples: "29,404", loss: [0.274, 0.117, 0.079, 0.063, 0.052], acc: [97.6, 98.4, 98.8, 99.0, 99.2] },
        ];
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        const playBtn = document.getElementById("demoPlay");
        const replayBtn = document.getElementById("demoReplay");
        const nbBody = document.getElementById("nbBody");
        const kernel = document.getElementById("nbKernel");
        const steps = demo.querySelectorAll(".demo-steps li");
        const cells = [...demo.querySelectorAll(".nb-cell")];
        const terms = [...demo.querySelectorAll(".term")];
        const wires = [...demo.querySelectorAll(".wire")];

        let runId = 0;
        let paused = false;
        let state = "idle"; // idle | playing | paused | done
        let instant = false;

        class Aborted extends Error {}

        // Pause-aware sleep; a Replay bumps runId so the old run throws out.
        async function wait(ms, id) {
            if (instant) { if (id !== runId) throw new Aborted(); return; }
            while (ms > 0) {
                await new Promise((r) => setTimeout(r, 40));
                if (id !== runId) throw new Aborted();
                if (!paused) ms -= 40;
            }
        }

        function setButtons() {
            playBtn.textContent = { idle: "Play", playing: "Pause", paused: "Resume", done: "Play again" }[state];
        }

        function setStage(i) {
            steps.forEach((li, k) => {
                li.classList.toggle("active", k === i);
                li.classList.toggle("done", k < i);
            });
        }

        function setKernel(busy) {
            kernel.classList.toggle("busy", busy);
            kernel.lastChild.textContent = busy ? "Python 3 · busy" : "Python 3 · idle";
        }

        function setCell(n, phase) {
            const cell = cells[n - 1];
            cells.forEach((c) => c.classList.toggle("active", c === cell && phase !== "reset"));
            cell.querySelector(".nb-prompt").textContent =
                phase === "run" ? "In [*]:" : phase === "done" ? `In [${n}]:` : "In [ ]:";
            if (phase === "run") nbBody.scrollTop = cell.offsetTop - 8;
        }

        function nbLine(n, html, cls) {
            const div = document.createElement("div");
            div.className = "ln" + (cls ? " " + cls : "");
            div.innerHTML = html;
            cells[n - 1].querySelector(".nb-out-body").appendChild(div);
            nbBody.scrollTop = nbBody.scrollHeight;
        }

        function termLine(t, html, cls) {
            const body = terms[t].querySelector(".term-body");
            const div = document.createElement("div");
            div.className = "ln" + (cls ? " " + cls : "");
            div.innerHTML = html;
            body.appendChild(div);
            body.scrollTop = body.scrollHeight;
            return div;
        }

        function termState(t, label, cls) {
            const el = terms[t].querySelector(".term-state");
            el.textContent = label;
            el.className = "term-state" + (cls ? " " + cls : "");
        }

        async function typeCmd(t, text, id) {
            const div = termLine(t, "", "cmd");
            const cursor = document.createElement("span");
            cursor.className = "cursor";
            for (let i = 1; i <= text.length; i++) {
                div.textContent = text.slice(0, i);
                div.appendChild(cursor);
                await wait(22, id);
            }
            cursor.remove();
        }

        function send(dir, label) {
            if (instant) return;
            wires.forEach((w) => {
                w.classList.remove("to-server", "to-client");
                void w.offsetWidth; // restart the animation
                w.classList.add(dir);
                w.querySelector(".wire-label").textContent = label;
            });
        }

        function plot(n) {
            const W = 360, H = 170, L = 38, R = 44, T = 26, B = 28;
            const x = (r) => L + (r - 1) * (W - L - R) / (ROUNDS - 1);
            const y = (v) => T + (100 - v) * (H - T - B) / 40; // 60–100 %
            let svg = `<svg class="acc-plot" viewBox="0 0 ${W} ${H}" role="img" aria-label="Global model test accuracy rises from ${TEST_ACC[0]}% after round 1 to ${TEST_ACC[ROUNDS - 1]}% after round ${ROUNDS}">`;
            svg += `<text class="ttl" x="${L}" y="14">Global model test accuracy (%)</text>`;
            [60, 80, 100].forEach((v) => {
                svg += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/>`;
                svg += `<text x="${L - 8}" y="${y(v) + 3}" text-anchor="end">${v}</text>`;
            });
            for (let r = 1; r <= ROUNDS; r++) svg += `<text x="${x(r)}" y="${H - 10}" text-anchor="middle">${r}</text>`;
            svg += `<text x="${W - R + 10}" y="${H - 10}">round</text>`;
            svg += `<polyline class="line" points="${TEST_ACC.map((v, i) => `${x(i + 1)},${y(v)}`).join(" ")}"/>`;
            TEST_ACC.forEach((v, i) => {
                svg += `<circle class="hit" cx="${x(i + 1)}" cy="${y(v)}" r="12"><title>Round ${i + 1}: ${v}%</title></circle>`;
                svg += `<circle class="pt" cx="${x(i + 1)}" cy="${y(v)}" r="4"/>`;
            });
            const last = TEST_ACC[ROUNDS - 1];
            svg += `<text class="val" x="${x(ROUNDS) + 8}" y="${y(last) + 4}">${last}%</text>`;
            svg += "</svg>";
            const out = cells[n - 1].querySelector(".nb-out-body");
            out.insertAdjacentHTML("beforeend", svg);
            nbBody.scrollTop = nbBody.scrollHeight;
        }

        function reset() {
            setStage(-1);
            setKernel(false);
            cells.forEach((c, i) => { setCell(i + 1, "reset"); c.querySelector(".nb-out-body").innerHTML = ""; });
            terms.forEach((t, i) => { t.querySelector(".term-body").innerHTML = ""; termState(i, "idle"); });
            wires.forEach((w) => { w.classList.remove("to-server", "to-client"); w.querySelector(".wire-label").textContent = ""; });
            nbBody.scrollTop = 0;
        }

        async function script(id) {
            reset();

            // 1. configure
            setStage(0);
            setKernel(true);
            setCell(1, "run");
            await wait(900, id);
            nbLine(1, "FedAvg aggregator · CNN model for MNIST · 2 clients · 5 rounds");
            setCell(1, "done");
            await wait(600, id);

            // 2. start the gRPC server
            setStage(1);
            setCell(2, "run");
            await wait(700, id);
            nbLine(2, "gRPC server started");
            nbLine(2, "Waiting for 2 clients…");
            await wait(700, id);

            // 3. clients join
            setStage(2);
            for (let t = 0; t < 2; t++) {
                const c = CLIENTS[t];
                termState(t, "starting", "busy");
                await typeCmd(t, `python run_client.py --config client_${t + 1}.yaml`, id);
                termLine(t, `Loaded MNIST · digits ${c.digits} · ${c.samples} images`, "dim");
                termLine(t, "Connecting to APPFL server…", "dim");
                await wait(400, id);
                termLine(t, `✓ Connected as ${c.id}`, "ok");
                nbLine(2, `${c.id} connected (${t + 1}/2)`, "hl");
                termState(t, "connected", "ok");
                await wait(400, id);
            }
            nbLine(2, "All clients joined · starting training", "ok");
            await wait(600, id);

            // 4. federated rounds
            setStage(3);
            for (let r = 0; r < ROUNDS; r++) {
                CLIENTS.forEach((c, t) => {
                    termLine(t, `Round ${r + 1}/${ROUNDS} · training on local data…`);
                    termState(t, "training", "busy");
                });
                await wait(1000, id);
                CLIENTS.forEach((c, t) => {
                    termLine(t, `  loss ${c.loss[r].toFixed(3)} · local acc ${c.acc[r].toFixed(1)}%`, "dim");
                    termLine(t, "  ↑ sent local update", "up");
                    termState(t, "sending", "busy");
                });
                send("to-server", "local update");
                await wait(900, id);
                nbLine(2, `Round ${r + 1}/${ROUNDS} · aggregated 2 updates · test acc <span class="acc">${TEST_ACC[r]}%</span>`);
                await wait(400, id);
                send("to-client", "global model");
                await wait(800, id);
                CLIENTS.forEach((c, t) => {
                    termLine(t, "  ↓ received global model", "up");
                    termState(t, "connected", "ok");
                });
                await wait(500, id);
            }
            CLIENTS.forEach((c, t) => {
                termLine(t, `✓ Finished ${ROUNDS} rounds · data never left this machine`, "ok");
                termState(t, "done", "ok");
            });
            nbLine(2, `✓ Training complete · final test acc ${TEST_ACC[ROUNDS - 1]}%`, "ok");
            setCell(2, "done");
            await wait(700, id);

            // 5. results
            setStage(4);
            setCell(3, "run");
            await wait(600, id);
            plot(3);
            setCell(3, "done");
            setKernel(false);
            setStage(5); // every step marked done
            cells.forEach((c) => c.classList.remove("active"));
        }

        async function start() {
            const id = ++runId;
            paused = false;
            state = "playing";
            setButtons();
            try {
                await script(id);
                state = "done";
                setButtons();
            } catch (e) {
                if (!(e instanceof Aborted)) throw e;
            }
        }

        playBtn.addEventListener("click", () => {
            if (state === "idle" || state === "done") start();
            else if (state === "playing") { paused = true; state = "paused"; setButtons(); }
            else { paused = false; state = "playing"; setButtons(); }
        });
        replayBtn.addEventListener("click", start);

        if (reduce) {
            // No motion: show the finished run straight away.
            instant = true;
            start();
        } else if ("IntersectionObserver" in window) {
            const io = new IntersectionObserver((entries) => {
                if (entries.some((e) => e.isIntersecting) && state === "idle") { start(); io.disconnect(); }
            }, { threshold: 0.35 });
            io.observe(demo.querySelector(".demo"));
        }
    }
})();
