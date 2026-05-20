/*
    DiepCustom - custom tank game server that shares diep.io's WebSocket protocol
    Copyright (C) 2022 ABCxFF (github.com/ABCxFF)

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published
    by the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program. If not, see <https://www.gnu.org/licenses/>
*/

// make module globally accessable
window.Module = {};

// todolist
Module.todo = [];

// todo status
Module.status = null;

// is the todo list done?
Module.isRunning = false;

// has the module been aborted?
Module.isAborted = false;

// exception name
Module.exception = null;

// function index for dynamic calling of the main func
Module.mainFunc = null;

// content contexts
Module.cp5 = null;

// client input
window.input = null;

// arenas
Module.servers = null;

// colors
Module.colors = null;

Module.netData = [];

/**
 * .mega replay v2: optional 16-byte header (magic + version + reserved).
 * Mouse is stored as fractions of the canvas buffer (0..1), so replays stay
 * accurate when recording and playback use different aspect ratios / DPRs.
 * Legacy v1 files have no header — mouse is absolute buffer pixels (old behavior).
 */
const REPLAY_MEGA_MAGIC_V2 = 0x3247454d; // 'MEG2' LE
const REPLAY_MEGA_VERSION_NORMALIZED = 2;
const REPLAY_MEGA_HEADER_BYTES = 16;

function replayMegaWriteHeader(view) {
    let o = 0;
    view.setUint32(o, REPLAY_MEGA_MAGIC_V2, true);
    o += 4;
    view.setUint32(o, REPLAY_MEGA_VERSION_NORMALIZED, true);
    o += 4;
    view.setUint32(o, 0, true);
    o += 4;
    view.setUint32(o, 0, true);
}

function replayMegaCaptureMouseFraction() {
    const canvas = document.getElementById("canvas");
    const cw = canvas && canvas.width > 0 ? canvas.width : 1;
    const ch = canvas && canvas.height > 0 ? canvas.height : 1;
    return {
        x: window.mouseData.x / cw,
        y: window.mouseData.y / ch,
        /** When true, x/y are 0..1 fractions; omit on legacy in-memory captures */
        norm: true
    };
}

function replayMegaNetDataUsesNormalizedMouse(netData) {
    return (
        Array.isArray(netData) &&
        netData.length > 0 &&
        netData.every((e) => e && e.mouse && e.mouse.norm === true)
    );
}

/** ~90Hz extra mouse samples while recording (between WS packets) for smoother aim in replays. */
const REPLAY_MOUSE_HF_MIN_INTERVAL_MS = 1000 / 90;
const REPLAY_MOUSE_HF_MOVE_EPS = 0.00008;

function dsReplayStopMouseHighFreqCapture() {
    if (Module._dsReplayMouseRaf != null) {
        cancelAnimationFrame(Module._dsReplayMouseRaf);
        Module._dsReplayMouseRaf = null;
    }
    Module._dsReplayMouseLastCapMs = null;
    Module._dsReplayLastMouseHf = null;
}

function dsReplayMouseHighFreqCaptureTick() {
    if (!window.__dsReplayCaptureActive) {
        Module._dsReplayMouseRaf = null;
        return;
    }
    const now = performance.now();
    if (
        Module._dsReplayMouseLastCapMs != null &&
        now - Module._dsReplayMouseLastCapMs < REPLAY_MOUSE_HF_MIN_INTERVAL_MS
    ) {
        Module._dsReplayMouseRaf = requestAnimationFrame(dsReplayMouseHighFreqCaptureTick);
        return;
    }
    Module._dsReplayMouseLastCapMs = now;
    const m = replayMegaCaptureMouseFraction();
    const prev = Module._dsReplayLastMouseHf;
    if (
        !prev ||
        Math.abs(m.x - prev.x) > REPLAY_MOUSE_HF_MOVE_EPS ||
        Math.abs(m.y - prev.y) > REPLAY_MOUSE_HF_MOVE_EPS
    ) {
        Module._dsReplayLastMouseHf = m;
        Module.netData.push({
            packet: new Uint8Array(0),
            mouse: m
        });
    }
    Module._dsReplayMouseRaf = requestAnimationFrame(dsReplayMouseHighFreqCaptureTick);
}

function dsReplayStartMouseHighFreqCapture() {
    if (Module._dsReplayMouseRaf != null) return;
    Module._dsReplayMouseLastCapMs = null;
    Module._dsReplayLastMouseHf = null;
    Module._dsReplayMouseRaf = requestAnimationFrame(dsReplayMouseHighFreqCaptureTick);
}

// tanks
Module.tankDefinitions = null;
Module.tankDefinitionsTable = null;

// commands
Module.executeCommandFunctionIndex = null;
Module.executionCallbackMap = {};
Module.commandDefinitions = null;

// name input
Module.textInput = document.getElementById("textInput");
Module.textInputContainer = document.getElementById("textInputContainer");

// permission level is sent to client in the accept packet
Module.permissionLevel = -1;

// (polling) intervals, can be a number (ms), -1 aka never or -2 aka whenever a new connection is initiated  
Module.reloadServersInterval = -2;
Module.reloadTanksInterval = -2;
Module.reloadCommandsInterval = -2;
Module.reloadColorsInterval = -2;

Module.spectatorList = [];

// Current gamemode id as sent by ServerInfo (e.g. "ranked-maze", "ranked-tdm", etc.)
window.currentGamemodeId = window.currentGamemodeId || "";
// Ranked team selection / spawn gating
window.rankTeamChosen = false;
window.pendingRankedSpawnName = null;
// True while any ranked-team-select overlay has been shown this session (used to gate spawning).
window.rankTeamsOverlayActive = window.rankTeamsOverlayActive || false;

// --- Team HUD (teammate health list) ---
(() => {
    const ENABLE_KEY = "ds_teamHud_enabled";
    const BIND_KEY = "ds_teamHud_bind";

    let enabled = false;
    let bindCode = "KeyV";
    let hudEl = null;
    let raf = 0;

    function readSettings() {
        try {
            const raw = window.localStorage.getItem(ENABLE_KEY);
            // Default ON when unset, match DiepStyle menu behavior.
            enabled = raw === null ? true : raw === "1";
        } catch {
            enabled = true;
        }
        try { bindCode = window.localStorage.getItem(BIND_KEY) || "KeyV"; } catch { bindCode = "KeyV"; }
    }

    function ensureHud() {
        if (hudEl) return hudEl;
        const el = document.createElement("div");
        el.id = "dsTeamHud";
        el.style.position = "fixed";
        el.style.left = "14px";
        // Just below the built‑in FPS / overlay indicators
        el.style.top = "42px";
        el.style.zIndex = "9999";
        el.style.width = "220px";
        // Overall scale ~0.8x for a more compact footprint
        el.style.transform = "scale(0.8)";
        el.style.transformOrigin = "top left";
        el.style.pointerEvents = "none"; // never impacts cursor/mouse
        el.style.fontFamily = "Ubuntu, system-ui, -apple-system, Segoe UI, sans-serif";
        el.style.userSelect = "none";
        el.style.display = "none";
        document.body.appendChild(el);
        hudEl = el;
        return el;
    }

    function render(rows) {
        const el = ensureHud();
        if (!enabled) { el.style.display = "none"; return; }
        el.style.display = "block";
        let html = "";
        // Put local player first if the server marked them.
        rows = Array.isArray(rows) ? [...rows] : [];
        rows.sort((a, b) => {
            const sa = a && a.self ? 1 : 0;
            const sb = b && b.self ? 1 : 0;
            return sb - sa; // self=true (1) comes first
        });
        for (const r of rows) {
            const pct = Math.max(0, Math.min(1, r.pct));
            const name = String(r.name || "").trim();
            const tank = String(r.tank || "").trim();
            const label = tank ? `${name} – ${tank}` : name;
            // Bright quartile colors: 0–25 red, 25–50 orange, 50–75 yellow, 75–100 green.
            let barColor;
            if (pct <= 0.25) barColor = "#f97373";        // red
            else if (pct <= 0.5) barColor = "#f97316";   // orange
            else if (pct <= 0.75) barColor = "#eab308";  // yellow
            else barColor = "#22c55e";                   // green
            html += `<div style="margin-bottom:4px;background:rgba(0,0,0,0.45);border:1px solid rgba(255,255,255,0.24);border-radius:8px;padding:4px 8px;">`;
            html += `<div style="display:flex;align-items:center;gap:6px;font-size:15px;line-height:18px;color:rgba(255,255,255,0.95);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">`;
            html += `<span style="flex:1 1 auto;overflow:hidden;text-overflow:ellipsis;">${label}</span>`;
            html += `</div>`;
            const rawHyper = Number.isFinite(r.hyper) ? Math.max(0, r.hyper) : 0;
            let hyperStr;
            if (rawHyper >= 100) hyperStr = rawHyper.toFixed(0);
            else if (rawHyper >= 10) hyperStr = rawHyper.toFixed(1);
            else hyperStr = rawHyper.toFixed(2);
            html += `<div style="margin-top:4px;display:flex;align-items:center;gap:4px;">`;
            html += `<div style="flex:1;height:9px;background:rgba(17,24,39,0.9);border-radius:999px;overflow:hidden;">`;
            html += `<div style="height:100%;width:${(pct * 100).toFixed(1)}%;background:${barColor};border-radius:999px;"></div>`;
            html += `</div>`;
            html += `<div style="min-width:72px;text-align:right;font-size:26px;line-height:26px;color:#22d3ee;font-weight:900;">${hyperStr}</div>`;
            html += `</div>`;
            html += `</div>`;
        }
        el.innerHTML = html;
    }

    function isSpectatorOrProxyLike(name) {
        const s = String(name || "").trim().toLowerCase();
        if (!s) return true;
        if (s.includes("spectator")) return true;
        if (s.includes("proxy")) return true;
        if (s.includes("dev")) return true;
        return false;
    }

    let latestRows = [];

    // TODO (old plan): hook into live entity/team/health data. We now use a server-fed payload via Notification id="teamhud".
    function tick() {
        if (!enabled) { render([]); raf = requestAnimationFrame(tick); return; }
        // Updated by ws.onmessage interceptor (Notification id="teamhud")
        if (Array.isArray(window.__dsTeamHudRows)) latestRows = window.__dsTeamHudRows;
        render((latestRows || []).filter(r => r && !isSpectatorOrProxyLike(r.name)).slice(0, 4));
        raf = requestAnimationFrame(tick);
    }

    readSettings();
    ensureHud();
    window.addEventListener("ds_team_hud_changed", () => readSettings());
    window.addEventListener("keydown", (e) => {
        // Don't steal keystrokes while typing
        if (Module.textInputContainer && Module.textInputContainer.style.display === "block") return;
        if (e.code === bindCode) {
            enabled = !enabled;
            try { window.localStorage.setItem(ENABLE_KEY, enabled ? "1" : "0"); } catch {}
        }
    }, true);
    raf = requestAnimationFrame(tick);
})();

// --- Radial ping menu (hold F, release to ping) ---
(() => {
    let holding = false;
    let overlay = null;
    let lastMouse = { x: 0, y: 0 };
    let origin = { x: 0, y: 0 };
    let currentType = null; // 0|1|2|3

    const resetRadialState = (reason) => {
        holding = false;
        currentType = null;
        if (overlay) {
            overlay.style.display = "none";
        }
    };
    // If keyup is missed (alt-tab, fullscreen, OS dialog), holding stays true and F never works again until refresh.
    window.addEventListener("blur", () => resetRadialState("blur"), true);
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) resetRadialState("visibility");
    }, true);
    window.addEventListener("pageshow", (e) => {
        if (e.persisted) resetRadialState("bfcache");
    });

    const ensure = () => {
        if (overlay) return overlay;
        const el = document.createElement("div");
        el.id = "dsPingRadial";
        el.style.cssText = "position:fixed;inset:0;display:none;z-index:9999;pointer-events:none;";
        el.innerHTML = `
          <div id="dsPingRadialRoot" style="position:absolute;left:0;top:0;transform:translate(-50%,-50%);width:180px;height:180px;">
            <div style="position:absolute;inset:0;border-radius:999px;background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.14);"></div>
            <div id="dsPingOpt0" style="position:absolute;left:50%;top:12px;transform:translateX(-50%);color:rgba(255,255,255,0.95);font-weight:900;font-size:22px;padding:8px 12px;border-radius:12px;">!</div>
            <div id="dsPingOpt1" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);color:rgba(255,255,255,0.95);font-weight:900;font-size:22px;padding:8px 12px;border-radius:12px;">⬇</div>
            <div id="dsPingOpt2" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:rgba(255,255,255,0.95);font-weight:900;font-size:18px;padding:8px 12px;border-radius:12px;">SOS</div>
            <div id="dsPingOpt3" style="position:absolute;left:50%;bottom:12px;transform:translateX(-50%);color:rgba(255,255,255,0.95);font-weight:900;font-size:22px;padding:8px 12px;border-radius:12px;">−</div>
            <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:18px;height:18px;border-radius:999px;border:2px solid rgba(255,255,255,0.6);"></div>
          </div>
        `;
        document.body.appendChild(el);
        overlay = el;
        return el;
    };

    const sendPing = (type) => {
        if (!window.Game || !Game.socket || Game.socket.readyState !== WebSocket.OPEN) return;
        try { Game.socket.send(new Uint8Array([0xD, type])); } catch {}
    };

    const typeFromDir = (dx, dy) => {
        // Up=warning(0), Right=group(1), Left=help(2), Down=lag(3)
        if (Math.abs(dx) > Math.abs(dy)) return dx >= 0 ? 1 : 2;
        return dy < 0 ? 0 : 3;
    };

    const updateHighlight = () => {
        if (!overlay) return;
        const set = (id, on) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.style.background = on ? "rgba(255,255,255,0.12)" : "transparent";
            el.style.border = on ? "1px solid rgba(0,212,255,0.55)" : "1px solid transparent";
            el.style.boxShadow = on ? "0 0 0 2px rgba(0,212,255,0.18)" : "none";
        };
        set("dsPingOpt0", currentType === 0);
        set("dsPingOpt1", currentType === 1);
        set("dsPingOpt2", currentType === 2);
        set("dsPingOpt3", currentType === 3);
    };

    window.addEventListener("mousemove", (e) => {
        lastMouse = { x: e.clientX, y: e.clientY };
        if (!holding) return;
        const dx = lastMouse.x - origin.x;
        const dy = lastMouse.y - origin.y;
        const mag = Math.hypot(dx, dy);
        if (mag < 30) { currentType = null; updateHighlight(); return; }
        currentType = typeFromDir(dx, dy);
        updateHighlight();
    }, true);

    window.addEventListener("keydown", (e) => {
        if (e.code === "Escape" && holding) {
            e.preventDefault();
            e.stopPropagation();
            resetRadialState("escape");
            return;
        }
        if (e.code !== "KeyF") return;
        if (Module.textInputContainer && Module.textInputContainer.style.display === "block") return;
        if (holding) return;
        holding = true;
        e.preventDefault(); e.stopPropagation();
        const el = ensure();
        el.style.display = "block";
        // Spawn the radial menu at the cursor and keep it fixed while holding.
        origin = { x: lastMouse.x || (window.innerWidth / 2), y: lastMouse.y || (window.innerHeight / 2) };
        const root = document.getElementById("dsPingRadialRoot");
        if (root) {
            root.style.left = `${origin.x}px`;
            root.style.top = `${origin.y}px`;
        }
        currentType = null;
        updateHighlight();
    }, true);

    window.addEventListener("keyup", (e) => {
        if (e.code !== "KeyF") return;
        if (!holding) return;
        holding = false;
        e.preventDefault(); e.stopPropagation();
        if (overlay) overlay.style.display = "none";
        // No direction = quick tap → SOS (type 2). input.js must not also send 0xD on keydown (would double-fire).
        const type = currentType == null ? 2 : currentType;
        currentType = null;
        sendPing(type);
    }, true);
})();

// --- Teammate direction arrows (off-screen indicators) ---
(() => {
    const ARROWS_ENABLE_KEY = "ds_teamArrows_enabled";
    const ARROWS_SCALE_KEY = "ds_teamArrows_scale";
    let arrowsEnabled = true;
    let arrowsScale = 1;
    let arrowsContainer = null;
    const PADDING = 28; // keep arrows slightly inside the edge

    function readArrowsSettings() {
        try {
            const raw = window.localStorage.getItem(ARROWS_ENABLE_KEY);
            arrowsEnabled = raw === null ? true : raw === "1";
        } catch { arrowsEnabled = true; }
        try {
            const s = window.localStorage.getItem(ARROWS_SCALE_KEY);
            const v = s != null ? parseFloat(s) : 1;
            arrowsScale = Number.isFinite(v) && v > 0.4 && v < 2.6 ? v : 1;
        } catch { arrowsScale = 1; }
    }

    function ensureArrowsContainer() {
        if (arrowsContainer) return arrowsContainer;
        const el = document.createElement("div");
        el.id = "dsTeamArrows";
        el.style.cssText = "position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:9998;display:none;";
        document.body.appendChild(el);
        arrowsContainer = el;
        return el;
    }

    function edgePoint(cx, cy, angle, w, h) {
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        let t = Infinity;
        if (dx > 1e-6) t = Math.min(t, (w - PADDING - cx) / dx);
        else if (dx < -1e-6) t = Math.min(t, (PADDING - cx) / dx);
        if (dy > 1e-6) t = Math.min(t, (h - PADDING - cy) / dy);
        else if (dy < -1e-6) t = Math.min(t, (PADDING - cy) / dy);
        if (!Number.isFinite(t) || t <= 0) return { x: cx, y: cy };
        return { x: cx + t * dx, y: cy + t * dy };
    }

    function renderArrows(rows) {
        const el = ensureArrowsContainer();
        if (!arrowsEnabled) { el.style.display = "none"; el.innerHTML = ""; return; }
        const offScreen = (Array.isArray(rows) ? rows : []).filter(r => r && r.offScreen === true);
        if (offScreen.length === 0) { el.style.display = "none"; el.innerHTML = ""; return; }
        el.style.display = "block";
        // Do NOT scale the container itself, otherwise arrows pull away from the screen edge.
        const w = window.innerWidth;
        const h = window.innerHeight;
        const cx = w / 2;
        const cy = h / 2;
        let html = "";
        const baseMarginLeft = -14;
        const baseMarginTop = -20;
        const baseBorderSize = 14;
        const baseBorderBottom = 36;
        const marginLeft = baseMarginLeft * arrowsScale;
        const marginTop = baseMarginTop * arrowsScale;
        const borderSize = baseBorderSize * arrowsScale;
        const borderBottom = baseBorderBottom * arrowsScale;

        const pingLabel = (ping) => {
            if (ping === 0) return "!";
            if (ping === 1) return "⬇";
            if (ping === 2) return "SOS";
            if (ping === 3) return "✩"; // "I'm fine" – 5-point star
            return "";
        };
        offScreen.forEach((r, i) => {
            const angle = Number.isFinite(r.angle) ? r.angle : 0;
            const pos = edgePoint(cx, cy, angle, w, h);
            // NOTE: CSS "border-bottom" triangle points UP by default. Rotate from UP to the desired angle.
            const deg = (angle + Math.PI / 2) * 180 / Math.PI;
            const offset = i * 14;
            const ox = pos.x - Math.sin(angle) * offset;
            const oy = pos.y + Math.cos(angle) * offset;
            // Slightly transparent black arrow with a soft shadow; size scales with arrowsScale
            html += `<div class="ds-team-arrow" style="position:absolute;left:${ox}px;top:${oy}px;width:0;height:0;margin-left:${marginLeft}px;margin-top:${marginTop}px;border-left:${borderSize}px solid transparent;border-right:${borderSize}px solid transparent;border-bottom:${borderBottom}px solid rgba(0,0,0,0.55);transform:rotate(${deg}deg);filter:drop-shadow(0 0 6px rgba(0,0,0,0.45));transition:opacity 0.15s ease;opacity:0.8;"></div>`;
            const pl = (r && r.ping != null) ? pingLabel(r.ping) : "";
            if (pl) {
                html += `<div style="position:absolute;left:${ox}px;top:${oy}px;transform:translate(-50%,-50%);font-family:Ubuntu,system-ui,sans-serif;font-weight:900;font-size:14px;color:rgba(255,255,255,0.95);text-shadow:0 2px 10px rgba(0,0,0,0.7);pointer-events:none;">${pl}</div>`;
            }
        });
        el.innerHTML = html;
    }

    let arrowsRaf = 0;
    function arrowsTick() {
        if (!arrowsEnabled) { renderArrows([]); arrowsRaf = requestAnimationFrame(arrowsTick); return; }
        const rows = Array.isArray(window.__dsTeamHudRows) ? window.__dsTeamHudRows : [];
        renderArrows(rows);
        arrowsRaf = requestAnimationFrame(arrowsTick);
    }

    readArrowsSettings();
    ensureArrowsContainer();
    window.addEventListener("ds_team_hud_changed", () => { readArrowsSettings(); });
    arrowsRaf = requestAnimationFrame(arrowsTick);
})();

// --- Ranked team select UI (blue / red buttons, 1/2 hotkeys) ---
(() => {
    let panelEl = null;
    let keyHandlerAttached = false;

    function isRankedMode(id) {
        const s = String(id || "").toLowerCase();
        return s.startsWith("ranked"); // covers ranked, ranked-maze, ranked-tdm, etc.
    }

    function ensureOverlay() {
        if (panelEl) return panelEl;

        const host = window.Module?.textInputContainer || document.getElementById("textInputContainer") || document.body;
        const panel = document.createElement("div");
        panel.id = "rankedTeamSelect";
        panel.style.marginTop = "24px";
        panel.style.display = "flex";
        panel.style.justifyContent = "center";
        panel.style.gap = "6px";
        panel.style.fontFamily = "Ubuntu, system-ui, -apple-system, Segoe UI, sans-serif";

        const makeBtn = (label, color, team) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.textContent = label;
            btn.style.padding = "8px 18px";
            btn.style.borderRadius = "10px";
            btn.style.border = "1px solid rgba(148,163,184,0.9)";
            btn.style.background = "rgba(15,23,42,0.95)";
            btn.style.color = color;
            btn.style.fontSize = "16px";
            btn.style.fontWeight = "900";
            btn.style.cursor = "pointer";
            btn.style.minWidth = "32px";
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                chooseTeam(team);
            });
            return btn;
        };

        const redBtn  = makeBtn("1", "#f97373", "RED");
        const blueBtn = makeBtn("2", "#38bdf8", "BLUE");

        panel.appendChild(redBtn);
        panel.appendChild(blueBtn);

        host.appendChild(panel);
        panelEl = panel;
        return panel;
    }

    function sendSwitchPacket(target) {
        if (!window.Game || !Game.socket || Game.socket.readyState !== WebSocket.OPEN) return;
        // Encode desired team: 0 = blue, 1 = red
        let idx = 0;
        if (target === "RED") idx = 1;
        try {
            Game.socket.send(new Uint8Array([0xA, idx])); // 0xA = SwitchTeam, extra byte = desired team
        } catch {}
    }

    function chooseTeam(target) {
        // Always send a SwitchTeam packet when the player explicitly picks a side.
        sendSwitchPacket(target);
        // First time choosing a team in this session should both lock the choice
        // and trigger any pending spawn for ranked modes.
        if (!window.rankTeamChosen) {
            window.rankTeamChosen = true;
            const pending = window.pendingRankedSpawnName;
            if (pending && typeof window.input === "object" && window.input) {
                window.input.execute(`game_spawn ${pending}`);
                window.pendingRankedSpawnName = null;
            }
        }
        hideOverlay();
    }

    function keyHandler(e) {
        if (!isRankedMode(window.currentGamemodeId)) return;
        if (window.disableInputs) return;
        // Only intercept 1/2 while the team-select UI is visible and the team isn't chosen yet.
        // Otherwise, let 1/2 pass through for normal gameplay (e.g. stat upgrades).
        if (window.rankTeamChosen) return;
        if (!panelEl || panelEl.style.display === "none") return;
        if (e.code === "Digit1" || e.code === "Numpad1") {
            e.preventDefault();
            e.stopPropagation();
            chooseTeam("RED");   // 1 = Red
        } else if (e.code === "Digit2" || e.code === "Numpad2") {
            e.preventDefault();
            e.stopPropagation();
            chooseTeam("BLUE");  // 2 = Blue
        }
    }

    function showOverlayIfRanked() {
        if (!isRankedMode(window.currentGamemodeId)) return;
        const el = ensureOverlay();
        el.style.display = "flex";
        // Once we've shown the overlay at least once for this session, we know we're in a
        // ranked teams context and should gate spawning until a team is chosen.
        window.rankTeamsOverlayActive = true;
        if (!keyHandlerAttached) {
            window.addEventListener("keydown", keyHandler, true);
            keyHandlerAttached = true;
        }
    }

    function hideOverlay() {
        if (panelEl) panelEl.style.display = "none";
        // keep key handler; it only acts when overlay is visible
    }

    // Expose for debugging if needed
    window.showRankedTeamSelect = showOverlayIfRanked;

    // Hook into ServerInfo so we know when we're on a ranked mode
    window.addEventListener("__serverInfoGamemode", () => {
        // New connection / mode: reset team choice + pending spawn
        window.rankTeamChosen = false;
        window.pendingRankedSpawnName = null;
        showOverlayIfRanked();
    });
})();

// --- Warmup heal (press G to restore HP) ---
// Sends a TCPInit command packet; server enforces warmup-only (ArenaState.COUNTDOWN).
(() => {
    const enc = new TextEncoder();
    function sendWarmupHeal() {
        if (!window.Game || !Game.socket || Game.socket.readyState !== WebSocket.OPEN) return;
        const cmd = "warmup_heal";
        const bytes = enc.encode(cmd);
        const pkt = new Uint8Array(1 + bytes.length + 1 + 1);
        let at = 0;
        pkt[at++] = 6; // ServerBound.TCPInit
        pkt.set(bytes, at); at += bytes.length;
        pkt[at++] = 0; // null terminator
        pkt[at++] = 0; // args length
        try { Game.socket.send(pkt); } catch {}
    }
    window.addEventListener("keydown", (e) => {
        if (e.code !== "KeyG") return;
        // Don't steal keystrokes while typing
        if (Module.textInputContainer && Module.textInputContainer.style.display === "block") return;
        sendWarmupHeal();
    }, true);
})();

// Run frames via requestAnimationFrame or setTimeout
Module.scheduler = window.requestAnimationFrame;

let isFirstConnect = true
// abort client
Module.abort = cause => {
    Module.isAborted = true;
    Module.isRunning = false;
    throw new WebAssembly.RuntimeError(`abort(${cause})`);
};

// run ASMConst method, basically replaces a lot of "real wasm imports"
Module.runASMConst = (code, sigPtr, argbuf) => {
    const args = [];
    let char;
    argbuf >>= 2;
    while(char = Module.HEAPU8[sigPtr++]) {
        const double = char < 105;
        if(double && argbuf & 1) argbuf++;
        args.push(double ? Module.HEAPF64[argbuf++ >> 1] : Module.HEAP32[argbuf])
        ++argbuf;
    }
    return ASMConsts[ASM_CONSTS[code]].apply(null, args);
};

// initializing the looper
Module.setLoop = func => {
    if(!Module.isRunning || Module.isAborted || Module.exception === "quit") return;
    Module.mainFunc = func;
    Module.scheduler.apply(null, [Module.loop]);
};

// process todo
Module.run = async () => {
    let args = [];
    while(Module.todo.length) {
        const [func, isAsync] = Module.todo.shift();
        if(isAsync) args = await Promise.all(func(...args));
        else args = func(...args);
        console.log(`Running stage ${Module.status} done`);
    }
};

// looper, 1 animation frame = 1 main call, except for stack unwinds
Module.loop = () => {
    if(!Module.isRunning || Module.isAborted || Module.exception === "quit") return;
    switch(Module.exception) {
        case null:
            Module.exports.dynCallV(Module.mainFunc);
            return Module.scheduler.apply(null, [Module.loop]);
        case "quit":
            return;
        case "unwind":
            Module.exception = null;
            return Module.scheduler.apply(null, [Module.loop]);
    }
};

// exit runtime (no unwind, originally unwind would be catched here)
Module.exit = status => {
    Module.exception = "quit";
    Module.isRunning = false;
    throw `Stopped runtime with status ${status}`;
};

// read utf8 from memory
Module.UTF8ToString = ptr => ptr ? Decoder.decode(Module.HEAPU8.subarray(ptr, Module.HEAPU8.indexOf(0, ptr))) : "";

// i/o write used for console, not fully understood
Module.fdWrite = (stream, ptr, count, res) => {
    let out = 0;
    for(let i = 0; i < count; i++) out += Module.HEAP32[(ptr + (i * 8 + 4)) >> 2];
    Module.HEAP32[res >> 2] = out;
};

// write utf8 to memory
Module.allocateUTF8 = str => {
    if(!str) return 0;
    const encoded = Encoder.encode(str);
    const ptr = Module.exports.malloc(encoded.byteLength + 1); // stringNT aka *char[]
    if(!ptr) return;
    Module.HEAPU8.set(encoded, ptr);
    Module.HEAPU8[ptr + encoded.byteLength] = 0;
    return ptr;
};

// Refreshes UI Components
Module.loadGamemodeButtons = () => {
    const vec = new $Vector(MOD_CONFIG.memory.gamemodeButtons, "struct", 28);
    if(vec.start) vec.destroy(); // remove old arenas
    // map server response to memory struct
    vec.push(...Module.servers.map(server => ([
        { offset: 0, type: "cstr", value: server.gamemode }, 
        { offset: 12, type: "cstr", value: server.name }, 
        { offset: 24, type: "i32", value: 0 }
    ])));
    Module.rawExports.loadVectorDone(MOD_CONFIG.memory.gamemodeButtons + 12); // toggle vector memory guard
};

// Refreshes UI Components
Module.loadChangelog = (changelog) => {
    const vec = new $Vector(MOD_CONFIG.memory.changelog, "cstr", 12);
    if(vec.start) vec.destroy(); // remove old changelog
    vec.push(...(changelog || CHANGELOG)); // either load custom or default
    $(MOD_CONFIG.memory.changelogLoaded).i8 = 1; // not understood
};

// Replaces current colors with serverside ones
Module.loadColors = () => {
    if(!window.input || !Module.colors) return;
    for(const [idx, color] of Object.entries(Module.colors)) {
        window.input.execute(`net_replace_color ${idx} ${color}`);
    }
};

// Ignore Hashtable, instead read from custom table
Module.getTankDefinition = tankId => {
    if(!Module.tankDefinitions) return 0;
    if(!Module.tankDefinitionsTable) Module.loadTankDefinitions(); // load tankdefs dynmically when requested
    if(!Module.tankDefinitionsTable[tankId]) return 0;
    return Module.tankDefinitionsTable[tankId] + 12; // 12 bytes for tankIds
};

Module.getCommand = cmdIdPtr => COMMANDS_LOOKUP[$(cmdIdPtr).cstr] || 0;

Module.loadTankDefinitions = () => {
    const writeTankDef = (ptr, tank) => {
        // Please note that this is not the full tank/barrel struct but just the portion needed for the client to function properly
        const barrels = tank.barrels ? tank.barrels.map(barrel => { // barrel fields
            return [
                { offset: 0, type: "f32", value: barrel.angle },
                { offset: 4, type: "f32", value: barrel.delay },
                { offset: 8, type: "f32", value: barrel.size },
                { offset: 12, type: "f32", value: barrel.offset },
                { offset: 16, type: "u8", value: Number(barrel.isTrapezoid) },
                { offset: 24, type: "f32", value: barrel.width / 42 },
                { offset: 56, type: "f32", value: barrel.bullet.sizeRatio },
                { offset: 60, type: "f32", value: barrel.trapezoidDirection },
                { offset: 64, type: "f32", value: barrel.reload },
                { offset: 96, type: "u32", value: ADDON_MAP[barrel.addon] || 0 }
            ];
        }) : [];

        const fields = [ // tankdef fields
            { offset: 4, type: "u32", value: tank.id },
            { offset: 8, type: "u32", value: tank.id },
            { offset: 12, type: "u32", value: tank.id },
            { offset: 16, type: "cstr", value: tank.name.toString() || "" },
            { offset: 28, type: "cstr", value: tank.upgradeMessage.toString() || "" },
            { offset: 40, type: "vector", value: { type: "u32", typeSize: 4, entries: tank.upgrades || [] } },
            { offset: 52, type: "vector", value: { type: "struct", typeSize: 100, entries: barrels } },
            { offset: 64, type: "u32", value: tank.levelRequirement || 0 },
            { offset: 76, type: "u8", value: Number(tank.sides === 4) },
            { offset: 93, type: "u8", value: Number(tank.sides === 16) },
            { offset: 96, type: "u32", value: ADDON_MAP[tank.preAddon] || 0 },
            { offset: 100, type: "u32", value: ADDON_MAP[tank.postAddon] || 0 },
        ];

        $.writeStruct(ptr, fields);
    };

    // TODO Rewrite with new $LinkedList datastructure
    Module.tankDefinitionsTable = new Array(Module.tankDefinitions.length).fill(0); // clear memory
    let lastPtr = MOD_CONFIG.memory.tankDefinitions;
    for(const tank of Module.tankDefinitions) {
        if(!tank) continue;
        const ptr = Module.exports.malloc(244); // length of a tankdef
        Module.HEAPU8.subarray(ptr, ptr + 244).fill(0);
        $(lastPtr).i32 = ptr;
        writeTankDef(ptr, tank);
        Module.tankDefinitionsTable[tank.id] = ptr;
        lastPtr = ptr;
    }

    $(MOD_CONFIG.memory.tankDefinitionsCount).i32 = Module.tankDefinitions.filter(e => Boolean(e)).length; // tankId xor based off this
};

// Executes a command callback from a command context
Module.executeCommand = execCtx => {
    const cmd = $(execCtx)[0].cstr;
    const tokens = $(execCtx)[12].vector("cstr", 12);
    
    if(!cmd || !tokens.length) throw `Invalid execution context (ptr: ${execCtx}) received`;
    if(typeof Module.executionCallbackMap[tokens[0]] !== "function") {
        if(!Module.commandDefinitions.find(({ id }) => id === tokens[0])) {
            throw `${Module.executionCallbackMap[tokens]} for command ${cmd} is an invalid callback`;
        }

        if (Game.socket.readyState !== WebSocket.OPEN) return;
        
        return Game.socket.send(new Uint8Array([
            6,
            ...Encoder.encode(tokens[0]), 0,
            tokens.slice(1).length,
            ...tokens.slice(1).flatMap(token => [...Encoder.encode(token), 0])
        ]));
    }

    // [id, ...args], we only need args
    Module.executionCallbackMap[tokens[0]](tokens.slice(1));
};

/*
    Command object: { id, usage, description, callback }
    The execute command function will not check for validity of arguments, you need to do that on your own
*/
Module.loadCommands = (commands = CUSTOM_COMMANDS) => {
    const cmdList = new $LinkedList(MOD_CONFIG.memory.commandList, "struct", 24);
    for(let { id, usage, description, callback, permissionLevel } of commands) {
        if(COMMANDS_LOOKUP[id] || permissionLevel > Module.permissionLevel) continue; // ignore duplicates

        // allocate Command
        const cmdPtr = Module.exports.malloc(40);
        $.writeStruct(cmdPtr, [
            { offset: 0, type: "cstr", value: id },
            { offset: 12, type: "cstr", value: usage || "" },
            { offset: 24, type: "cstr", value: description || "" },
            { offset: 36, type: "u32", value: Module.executeCommandFunctionIndex } // we handle every custom command with the same function
        ]);

        COMMANDS_LOOKUP[id] = cmdPtr;
        if(callback) Module.executionCallbackMap[id] = callback;

        // allocate HashNode
        cmdList.push([
            { offset: 0, type: "u32", value: 0 }, // next node
            { offset: 4, type: "u32", value: 0 }, // hash
            { offset: 8, type: "cstr", value: id }, // command id
            { offset: 20, type: "$", value: cmdPtr } // command def ptr
        ]);
    }
};

function compressLZ4(uint8) {
    const maxSize = LZ4.encodeBound(uint8.length);
    const compressed = new Uint8Array(maxSize);

    const compressedSize = LZ4.encodeBlock(uint8, compressed);

    if (compressedSize <= 0) {
        throw new Error("LZ4 compression failed");
    }

    // prepend original size (required for decode)
    const final = new Uint8Array(4 + compressedSize);
    new DataView(final.buffer).setUint32(0, uint8.length, true);
    final.set(compressed.subarray(0, compressedSize), 4);

    return final;
}

Module.saveNetDataBin = function(filename = `diepranked-${Date.now()}.mega`) {
    if (!Module.netData || !Module.netData.length) {
        console.warn("wtf");
        return;
    }

    const useV2 = replayMegaNetDataUsesNormalizedMouse(Module.netData);
    let total = (useV2 ? REPLAY_MEGA_HEADER_BYTES : 0);

    for (const entry of Module.netData) {
        total += 4 + entry.packet.length + 8;
    }

    const buffer = new ArrayBuffer(total);
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    let offset = 0;

    if (useV2) {
        replayMegaWriteHeader(view);
        offset = REPLAY_MEGA_HEADER_BYTES;
    }

    for (const entry of Module.netData) {
        const { packet, mouse } = entry;

        view.setUint32(offset, packet.length, true);
        offset += 4;

        bytes.set(packet, offset);
        offset += packet.length;

        view.setFloat32(offset, mouse.x, true);
        offset += 4;

        view.setFloat32(offset, mouse.y, true);
        offset += 4;
    }

    // ✅ COMPRESS HERE
    const compressed = compressLZ4(new Uint8Array(buffer));

    const blob = new Blob([compressed], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);

    console.log("Saved packets:", Module.netData.length);
};

Module.buildNetDataBinBlob = function(netData = Module.netData) {
    if (!netData || !netData.length) return null;

    const useV2 = replayMegaNetDataUsesNormalizedMouse(netData);
    let total = (useV2 ? REPLAY_MEGA_HEADER_BYTES : 0);

    for (const entry of netData) {
        total += 4 + entry.packet.length + 8;
    }

    const buffer = new ArrayBuffer(total);
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    let offset = 0;

    if (useV2) {
        replayMegaWriteHeader(view);
        offset = REPLAY_MEGA_HEADER_BYTES;
    }

    for (const entry of netData) {
        const { packet, mouse } = entry;

        view.setUint32(offset, packet.length, true);
        offset += 4;

        bytes.set(packet, offset);
        offset += packet.length;

        view.setFloat32(offset, mouse.x, true);
        offset += 4;

        view.setFloat32(offset, mouse.y, true);
        offset += 4;
    }

    // ✅ COMPRESS HERE
    const compressed = compressLZ4(new Uint8Array(buffer));

    return new Blob([compressed], { type: "application/octet-stream" });
};

Module.uploadNetDataBin = async function(matchId, playerId, netData = Module.netData) {
    const blob = Module.buildNetDataBinBlob(netData);
    if (!blob || !blob.size) return false;

    const res = await fetch("/api/replays/upload", {
        method: "POST",
        credentials: "include",
        headers: {
            "x-received-at": matchId,
            "x-player-id": playerId,
            "x-filename": `replay-${playerId}.mega`,
        },
        body: blob
    });

    if (!res.ok) {
        let msg = "";
        try { msg = await res.text(); } catch {}
        console.error("[replay upload] server rejected:", res.status, msg);
    } else {
        console.log("[replay upload] ok", { matchId: String(matchId), playerId: String(playerId), bytes: blob.size });
    }
    return res.ok;
};

Module.uploadReplayForLatestMatch = async function(playerId, gamemode, captureNetData, fromTs = Date.now()) {
    const uploaded = window.__dsReplayUploadedMatchKeys || (window.__dsReplayUploadedMatchKeys = new Set());
    const blob = Module.buildNetDataBinBlob(captureNetData);
    if (!blob || !blob.size) {
        console.warn("[replay auto-upload] skipped (empty capture)");
        return false;
    }

    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    for (let attempt = 0; attempt < 20; attempt++) {
        try {
            const res = await fetch("/api/replays/upload-latest", {
                method: "POST",
                credentials: "include",
                headers: {
                    "x-player-id": String(playerId), // ignored server-side (session is source of truth)
                    "x-gamemode": String(gamemode || ""),
                    "x-from-ts": String(fromTs || 0),
                    "x-filename": `replay-${playerId}.mega`
                },
                body: blob
            });
            if (res.ok) {
                const j = await res.json().catch(() => ({}));
                const key = String(j?.receivedAt || "");
                if (key) uploaded.add(key);
                console.log("[replay auto-upload] ok", { attempt: attempt + 1, receivedAt: key || null, bytes: blob.size });
                return true;
            }
            if (res.status === 404) {
                // Match not visible in megaserver yet; retry shortly.
                await sleep(500);
                continue;
            }
            const msg = await res.text().catch(() => "");
            console.error("[replay auto-upload] rejected:", res.status, msg);
            return false;
        } catch (err) {
            console.error("[replay auto-upload] attempt failed:", err);
            await sleep(500);
        }
    }
    console.error("[replay auto-upload] timed out waiting for latest match");
    return false;
};


const wasmImports = {
    assertFail: (condition, filename, line, func) => Module.abort("Assertion failed: " + Module.UTF8ToString(condition) + ", at: " + [filename ? Module.UTF8ToString(filename) : "unknown filename", line, func ? Module.UTF8ToString(func) : "unknown function"]),
    mapFile: () => -1, // unused
    sysMunmap: (addr, len) => addr === -1 || !len ? -28 : 0, // not really used
    abort: Module.abort,
    asmConstsDII: Module.runASMConst,
    asmConstsIII: Module.runASMConst,
    exitLive: () => Module.exception = "unwind", // unwind stack
    exitForce: () => Module.exit(1), // exit / quit
    getNow: () => performance.now(),
    memCopyBig: (dest, src, num) => { Module.HEAPU8.copyWithin(dest, src, src + num) }, // for large packets
    random: () => Math.random(),
    resizeHeap: () => Module.abort("OOM"), // unable to resize wasm memory
    setMainLoop: Module.setLoop,
    envGet: () => 0, // unused
    envSize: () => 0, // unused
    fdWrite: Module.fdWrite, // used for diep client console
    roundF: d => d >= 0 ? Math.floor(d + 0.5) : Math.ceil(d - 0.5), // no, default Math.round doesn't work :D
    timeString: () => 0, // unused
    wasmMemory: new WebAssembly.Memory(WASM_MEMORY),
    wasmTable: new WebAssembly.Table(WASM_TABLE)
};

Module.todo.push([() => {
    Module.status = "PREPARE";
    // map imports to config
    Module.imports = { a: Object.fromEntries(Object.entries(WASM_IMPORTS).map(([key, name]) => [key, wasmImports[name]])) };
    return [];
}, false]);

Module.todo.push([
    () => {
        Module.status = "FETCH";
        return [
            fetch(`${CDN}build_${BUILD}.wasm.wasm`)
            .then((res) => res.arrayBuffer())
            .then((buffer) => {
                const uint8Array = new Uint8Array(buffer);
                const searchPattern = new TextEncoder().encode("diep.io");
                const replacePattern = new TextEncoder().encode(
                "4v4.lol".padStart(7, " ")
            );

            for (let i = 0; i <= uint8Array.length - searchPattern.length; i++) {
                let match = true;
                for (let j = 0; j < searchPattern.length; j++) {
                    if (uint8Array[i + j] !== searchPattern[j]) {
                        match = false;
                        break;
                    }
                }
                if (match) {
                    for (let j = 0; j < replacePattern.length; j++) {
                        uint8Array[i + j] = replacePattern[j];
                    }
                }
            }

            return uint8Array.buffer;
        }),
        fetch(`${API_URL}servers`).then((res) => res.json()),
        fetch(`${API_URL}tanks`).then((res) => res.json()),
        ];
    },
    true,
]);

Module.todo.push([(dependency, servers, tanks) => {
    Module.status = "INSTANTIATE";
    Module.servers = servers;
    Module.tankDefinitions = tanks;
    
    const parser = new WailParser(new Uint8Array(dependency));
    
    // original function, we want to modify these
    const originalVectorDone = parser.getFunctionIndex(MOD_CONFIG.wasmFunctions.loadVectorDone);
    const originalLoadChangelog = parser.getFunctionIndex(MOD_CONFIG.wasmFunctions.loadChangelog);
    const originalLoadGamemodeButtons = parser.getFunctionIndex(MOD_CONFIG.wasmFunctions.loadGamemodeButtons);
    const originalLoadTankDefs = parser.getFunctionIndex(MOD_CONFIG.wasmFunctions.loadTankDefinitions);
    const originalGetTankDef = parser.getFunctionIndex(MOD_CONFIG.wasmFunctions.getTankDefinition);
    const originalFindCommand = parser.getFunctionIndex(MOD_CONFIG.wasmFunctions.findCommand);
    const originalDecodeComponentList = parser.getFunctionIndex(MOD_CONFIG.wasmFunctions.decodeComponentList);
    const originalCreateEntityAtIndex = parser.getFunctionIndex(MOD_CONFIG.wasmFunctions.createEntityAtIndex);

    // function types
    const types = {
        // void []
        vn: parser.addTypeEntry({
            form: "func",
            params: [],
            returnType: null
        }),
        // void [int]
        vi: parser.addTypeEntry({
            form: "func",
            params: ["i32"],
            returnType: null
        }),
        // int [int]
        ii: parser.addTypeEntry({
            form: "func",
            params: ["i32"],
            returnType: "i32"
        })
    }

    // custom imports
    const imports = {
        loadGamemodeButtons: parser.addImportEntry({
            moduleStr: "mods",
            fieldStr: "loadGamemodeButtons",
            kind: "func",
            type: types.vn 
        }),
        loadChangelog: parser.addImportEntry({
            moduleStr: "mods",
            fieldStr: "loadChangelog",
            kind: "func",
            type: types.vn
        }),
        getTankDefinition: parser.addImportEntry({
            moduleStr: "mods",
            fieldStr: "getTankDefinition",
            kind: "func",
            type: types.ii
        }),
        findCommand: parser.addImportEntry({
            moduleStr: "mods",
            fieldStr: "findCommand",
            kind: "func",
            type: types.ii
        }),
        executeCommand: parser.addImportEntry({
            moduleStr: "mods",
            fieldStr: "executeCommand",
            kind: "func",
            type: types.vi
        })
    };

    Module.imports.mods = {
        loadGamemodeButtons: Module.loadGamemodeButtons,
        loadChangelog: Module.loadChangelog,
        getTankDefinition: Module.getTankDefinition,
        findCommand: Module.getCommand,
        executeCommand: Module.executeCommand
    };

    for(const addonId of Object.keys(CUSTOM_ADDONS)) {
        imports["_addon_" + addonId] = parser.addImportEntry({
            moduleStr: "mods",
            fieldStr: "_addon_" + addonId,
            kind: "func",
            type: types.vi
        });

        parser.addExportEntry(imports["_addon_" + addonId], {
            fieldStr: "_addon_" + addonId,
            kind: "func"
        });

        Module.imports.mods["_addon_" + addonId] = (ptr) => {
            const input = $(ptr);
            if(!ptr || !input.i32) throw "Invalid pointer received on addon callback";
            CUSTOM_ADDONS[addonId](new $Entity(input.i32 !== ptr ? input.$ : input));
        };
    }

    parser.addExportEntry(imports.executeCommand, {
        fieldStr: "executeCommand",
        kind: "func"
    });

    parser.addExportEntry(originalVectorDone, {
        fieldStr: "loadVectorDone",
        kind: "func"
    });
    
    parser.addExportEntry(originalCreateEntityAtIndex, {
        fieldStr: "createEntityAtIndex",
        kind: "func"
    });

    parser.addExportEntry(originalDecodeComponentList, {
        fieldStr: "decodeComponentList",
        kind: "func"
    });

    const findConsecutiveSequenceIndex = (array, sequence) => {
        const indexes = [];
        for(let i = 0; i < array.length - sequence.length + 1; i++) {
            let found = true;
            for(let j = 0; j < sequence.length; j++) {
                if(array[i + j] !== sequence[j]) {
                    found = false;
                    break;
                }
            }
            if(found) {
                indexes.push(i);
            }
        }
        return indexes;
    }
    
    // parses & modifies code function by function
    parser.addCodeElementParser(null, function({ index, bytes }) {
        const ptrPattern = VarUint32ToArray(MOD_CONFIG.memory.netColorTable);
        const geuPattern = [OP_I32_CONST, 19, OP_I32_GE_U];
        const ltuPattern = [OP_I32_CONST, 19, OP_I32_LT_U];
        for(const idx of findConsecutiveSequenceIndex(bytes, ptrPattern)) {
            const arr = Array.from(bytes); // convert to normal array for splicing
            arr.splice(idx, ptrPattern.length, ...VarUint32ToArray(DYNAMIC_TOP_PTR + 4)); // using "empty" space
            bytes = new Uint8Array(arr); // convert back to u8[]
            let check = findConsecutiveSequenceIndex(bytes, geuPattern); // <= kMaxColors
            if(!check.length) {
                check = findConsecutiveSequenceIndex(bytes, ltuPattern); // invert, > kMaxColors
                for(const idx of check) {
                    const arr = Array.from(bytes);
                    arr.splice(idx, ltuPattern.length, OP_I32_CONST, ...VarSint32ToArray(-2), OP_I32_NE); // color code -2 = kMaxColors
                    bytes = new Uint8Array(arr);
                }
            } else {
                for(const idx of check) {
                    const arr = Array.from(bytes);
                    arr.splice(idx, geuPattern.length, OP_I32_CONST, ...VarSint32ToArray(-2), OP_I32_EQ); // color code -2 = kMaxColors
                    bytes = new Uint8Array(arr);
                }
            }
        }
        
        switch(index) {
            // modify load changelog function
            case originalLoadChangelog.i32(): // we only need the part where it checks if the changelog is already loaded to avoid too many import calls
                return new Uint8Array([
                    ...bytes.subarray(0, MOD_CONFIG.wasmFunctionHookOffset.changelog),
                    OP_CALL, ...VarUint32ToArray(imports.loadChangelog.i32()),
                    OP_RETURN,
                    ...bytes.subarray(MOD_CONFIG.wasmFunctionHookOffset.changelog)
                ]);
            // modify load gamemode buttons function
            case originalLoadGamemodeButtons.i32(): // we only need the part where it checks if the buttons are already loaded to avoid too many import calls
                return new Uint8Array([
                    ...bytes.subarray(0, MOD_CONFIG.wasmFunctionHookOffset.gamemodeButtons),
                    OP_CALL, ...VarUint32ToArray(imports.loadGamemodeButtons.i32()),
                    OP_RETURN,
                    ...bytes.subarray(MOD_CONFIG.wasmFunctionHookOffset.gamemodeButtons)
                ]);
            // overwrite get tankdef function
            case originalGetTankDef.i32(): // we modify this to call a js function which then returns the tank def ptr from a table
                return new Uint8Array([
                    OP_GET_LOCAL, 0,
                    OP_CALL, ...VarUint32ToArray(imports.getTankDefinition.i32()),
                    OP_RETURN,
                    OP_END
                ]);
            // overwrite find command function
            case originalFindCommand.i32():
                return new Uint8Array([
                    OP_GET_LOCAL, 0,
                    OP_CALL, ...VarUint32ToArray(imports.findCommand.i32()),
                    OP_RETURN,
                    OP_END
                ]);
            // delete tankdefs loading function
            case originalLoadTankDefs.i32(): // we dont want this to run anymore because it will call the original tank wrapper function
                return new Uint8Array([
                    OP_END
                ]);
            // no interesting index
            default:
                return bytes;
        }
    });

    // parse modded wasm
    parser.parse();
    // instantiate
    return [new Promise(resolve => WebAssembly.instantiate(parser.write(), Module.imports).then(res => resolve(res.instance), reason => Module.abort(reason)))];
}, true]);

Module.todo.push([instance => {
    Module.status = "INITIALIZE";
    // Exports
    Module.exports = Object.fromEntries(Object.entries(instance.exports).map(([key, func]) => [WASM_EXPORTS[key], func]));    
    Module.rawExports = instance.exports;
    // Memory
    Module.memBuf = wasmImports.wasmMemory.buffer,
    Module.HEAPU8 = new Uint8Array(Module.memBuf);
    Module.HEAP8 = new Int8Array(Module.memBuf);
    Module.HEAPU16 = new Uint16Array(Module.memBuf);
    Module.HEAP16 = new Int16Array(Module.memBuf);
    Module.HEAPU32 = new Uint32Array(Module.memBuf);
    Module.HEAP32 = new Int32Array(Module.memBuf);
    Module.HEAPF32 = new Float32Array(Module.memBuf);
    Module.HEAPF64 = new Float64Array(Module.memBuf);
    Module.HEAPU64 = new BigUint64Array(Module.memBuf);
    Module.HEAP64 = new BigInt64Array(Module.memBuf);
    // Cp5 Contexts
    Module.cp5 = {
        contexts: [],
        images: [],
        sockets: [],
        patterns: []
    };
    // window.input & misc, see input.js
    window.setupInput();
    return [];
}, false]);

Module.todo.push([() => {
    window.Game = {
        reloadColors: async () => {
            Module.colors = await fetch(`${window.API_URL}colors`).then(res => res.json());
            Module.loadColors();
        },
        // refetches servers & resets gamemode buttons
        reloadServers: async () => {
            Module.servers = await fetch(`${window.API_URL}servers`).then(res => res.json());
            Module.loadGamemodeButtons();
        },
        // refetches tankdefs & resets them
        reloadTanks: async () => {
            Module.tankDefinitions = await fetch(`${window.API_URL}tanks`).then(res => res.json());
            if(Module.tankDefinitionsTable) {
                for(const tankDef of Module.tankDefinitionsTable) {
                    if(tankDef) Module.exports.free(tankDef);
                }
            }
            Module.loadTankDefinitions();
        },
        reloadCommands: async () => {
            Module.commandDefinitions = await fetch(`${window.API_URL}commands`).then(res => res.json());
            Module.loadCommands(Module.commandDefinitions); // remote
            Module.loadCommands(); // local
        },
        // sets changelog (input: [...""])
        changeChangelog: (lines) => Module.loadChangelog(lines),
        // main socket, see also Module.cp5.sockets[0]
        get socket() {
            return Module.cp5.sockets[0];
        },
        // executes spawn command
        spawn: name => {
            window.pendingRankedSpawnName = name || "";
            // If the ranked team-select overlay has ever been shown in this session,
            // we are in a ranked-teams context. Block spawning until a team is chosen.
            if (window.rankTeamsOverlayActive && !window.rankTeamChosen) {
                if (typeof window.showRankedTeamSelect === "function") window.showRankedTeamSelect();
                return; // wait for 1/2 or button to choose team, then spawn
            }
            window.input.execute(`game_spawn ${name}`);
        },
        // executes reconnect command
        reconnect: () => window.input.execute(`lb_reconnect`)
    };

    // custom commands
    Module.executeCommandFunctionIndex = Module.imports.a.table.grow(1);
    Module.imports.a.table.set(Module.executeCommandFunctionIndex, Module.rawExports.executeCommand);

    // custom addons
    for(const addonId of Object.keys(CUSTOM_ADDONS)) {
        ADDON_MAP[addonId] = Module.imports.a.table.grow(1);
        Module.imports.a.table.set(ADDON_MAP[addonId],  Module.rawExports["_addon_" + addonId]);
    }

    Module.status = "START";
    // emscripten requirements
    Module.HEAP32[DYNAMIC_TOP_PTR >> 2] = DYNAMIC_BASE;
    Module.isRunning = true;
    Module.exports.wasmCallCtors();
    Module.exports.main();


    const reloadServersInterval = () => setTimeout(() => {
        reloadServersInterval();
        if(Module.reloadServersInterval < 0) return;
        Game.reloadServers(); 
    }, Module.reloadServersInterval);
    reloadServersInterval();

    const reloadTanksInterval = () => setTimeout(() => {
        reloadTanksInterval();
        if(Module.reloadTanksInterval < 0) return;
        Game.reloadTanks();
    }, Module.reloadTanksInterval);
    reloadTanksInterval();

    const reloadCommandsInterval = () => setTimeout(() => {
        reloadCommandsInterval();
        if(Module.reloadCommandsInterval < 0) return;
        Game.reloadCommands();
    }, Module.reloadCommandsInterval);
    reloadCommandsInterval();
    
    const reloadColorsInterval = () => setTimeout(() => {
        reloadColorsInterval();
        if(Module.reloadColorsInterval < 0) return;
        Game.reloadColors();
    }, Module.reloadColorsInterval);
    reloadColorsInterval();
}, false]);


const PING_PACKET = new Uint8Array([5]);
function sendThrottledPing(socket) {
    const now = performance.now();
    const socketPtr = Module.HEAPU32[SOCKET_PTR >> 2];
    const lastPingTimePtr = socketPtr + LAST_PING_TIME_OFFSET;

    const timeSinceLastPing = now - Module.HEAPF64[lastPingTimePtr >> 3];
    if (timeSinceLastPing >= PING_THROTTLE_MS) {
        return socket.send(PING_PACKET);
    }

    // This is okay as this function won't be called again until
    // after the pong is received from the server.
    setTimeout(() => requestAnimationFrame(() => {
        if (socket.readyState !== WebSocket.OPEN) return;
        Module.HEAPF64[lastPingTimePtr >> 3] = Module.HEAPF64[TIME_NOW_PTR >> 3];
        socket.send(PING_PACKET);
    }), PING_THROTTLE_MS - timeSinceLastPing);
}

// Part of the original emscripten bootstrap
class ASMConsts {
    static createCanvasCtxWithAlpha(canvasId, alpha) {
        const canvas = document.getElementById(Module.UTF8ToString(canvasId));
        if(!canvas) return -1;
        const ctx = canvas.getContext("2d", {
            alpha: Boolean(alpha)
        });
        for (let i = 0; i < Module.cp5.contexts.length; ++i) {
            if (Module.cp5.contexts[i] !== null) continue;
            Module.cp5.contexts[i] = ctx;
            return i;
        }
        Module.cp5.contexts.push(ctx);
        return Module.cp5.contexts.length - 1;
    }

    static createImage(src) {
        const img = new Image;
        img.isLoaded = false;
        img.onload = () => img.isLoaded = true;
        img.src = `${CDN}${Module.UTF8ToString(src)}`;
        for (let i = 0; i < Module.cp5.images.length; ++i) {
            if (Module.cp5.images[i] !== null) continue;
            Module.cp5.images[i] = img;
            return i;
        }
        Module.cp5.images.push(img);
        return Module.cp5.images.length - 1;
    }

    static websocketSend(socketId, packetStart, packetLength) {
        const socket = Module.cp5.sockets[socketId];
        if(!socket || socket.readyState !== 1) return 0;
        const packetId = Module.HEAPU8[packetStart];
        if (packetId === 5) {
            sendThrottledPing(socket);
            return 1;
        }
        try {
            socket.send(Module.HEAP8.subarray(packetStart, packetStart + packetLength));
        } catch(e) {}
        return 1;
    }

    static wipeContext(index) {
        Module.cp5.contexts[index] = null;
    }

    static modulo(a, b) {
        return a % b;
    }

    static wipeSocket(index) {
        const socket = Module.cp5.sockets[index];
        if (!socket) return;
        socket.onopen = socket.onclose = socket.onmessage = socket.onerror = function() {};
        for(let i = 0; i < socket.events.length; ++i) Module.exports.free(socket.events[i][1]);
        socket.events = null;
        try {
            socket.close();
        } catch(e) {}
        Module.cp5.sockets[index] = null;
    }

    static setTextInput(value) {
        Module.textInput.value = Module.UTF8ToString(value);
    }

    static wipeImage(index) {
        Module.cp5.images[index] = null;
    }

    static reloadWindowTimeout() {
        //setTimeout(() => window.location.reload(), 100);
    }

    static existsInWindowObject(key) {
        return Boolean(window[Module.UTF8ToString(key)]);
    }

    // 6 (ads)

    static getQueries() {
        const queryString = window.location.href.split("?")[0];
        return Module.allocateUTF8(queryString.slice(0, queryString.lastIndexOf("/")));
    }

    // 2 (ads)

    static getLocalStorage(key, length) {
        const keyStr = Module.UTF8ToString(key);
        let str = window.localStorage[keyStr] || "";
        if(
            keyStr === "gamemode"
            && Module.servers
            && Module.servers.length
            && !Module.servers.find(({ gamemode }) => window.localStorage[keyStr] === gamemode)
        ) str = Module.servers[0].gamemode;
        Module.HEAPU32[length >> 2] = str.length;
        return Module.allocateUTF8(str);
    }

    static deleteLocalStorage(key) {
        delete window.localStorage[Module.UTF8ToString(key)];
    }

    static removeChildNode(nodeId) {
        const node = document.getElementById(Module.UTF8ToString(nodeId));
        if(node && node.parentNode) node.parentNode.removeChild(node);
    }

    static checkElementProperty(elementId, propertyKey, propertyIndex, value) {
        const element = document.getElementById(Module.UTF8ToString(elementId));
        const key = Module.UTF8ToString(propertyKey);
        if(!element || !element[key]) return true;
        return element[key][Module.UTF8ToString(propertyIndex)] === Module.UTF8ToString(value);
    }

    static existsQueryOrIsBlank(query) {
        const elements = document.querySelectorAll(Module.UTF8ToString(query));
        for(let i = 0; i < elements.length; ++i)
            if(elements[i].src === "about:blank") return true;
        return elements.length === 0;
    }

    // 1 (ads)

    static setLocalStorage(key, valueStart, valueLength) {
        window.localStorage[Module.UTF8ToString(key)] = Decoder.decode(Module.HEAPU8.subarray(valueStart, valueStart + valueLength));
    }

    // 3 (ads)

    static getGamepad() {
        return window.navigator.getGamepads && window.navigator.getGamepads()[0]?.mapping === "standard";
    }

    static toggleFullscreen() {
        const requestMethod = document.body.requestFullScreen || document.body.webkitRequestFullScreen || document.body.mozRequestFullScreen || document.body.msRequestFullScreen;
        const cancelMethod = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
        if(!requestMethod && !cancelMethod) return;
        requestMethod ? requestMethod.call(document.body) : cancelMethod.call(document);
    }

    static getCanvasSize(ctxId, width, height) {
        const canvas = Module.cp5.contexts[ctxId].canvas;
        Module.HEAP32[width >> 2] = canvas.width;
        Module.HEAP32[height >> 2] = canvas.height;
    }

    static setCursorDefault() {
        document.getElementById("canvas").style.cursor = "default";
    }

    static setCursorPointer() {
        document.getElementById("canvas").style.cursor = "pointer";
    }

    static setCursorText() {
        document.getElementById("canvas").style.cursor = "text";
    }

    static getTextInput() {
        return Module.allocateUTF8(Module.textInput.value);
    }

    static enableTyping(left, top, width, height, enabled) {
        if (window.disableInputs) return
        
        window.setTyping(true);
        Module.textInputContainer.style.display = "block";
        Module.textInputContainer.style.position = "absolute";
        Module.textInputContainer.style.left = window.unscale(left) + "px";
        Module.textInputContainer.style.top = window.unscale(top) + "px";
        Module.textInput.style.width = window.unscale(width * 0.96) + "px";
        Module.textInput.style.height = window.unscale(height) + "px";
        Module.textInput.style.lineHeight = window.unscale(height * 0.9) + "px";
        Module.textInput.style.fontSize = window.unscale(height * 0.9) + "px";
        Module.textInput.style.paddingLeft = "5px";
        Module.textInput.style.paddingRight = "5px";
        Module.textInput.disabled = !enabled;
        Module.textInput.focus();
    }

    static disableTyping() {
        window.setTyping(false);
        Module.textInput.blur();
        Module.textInput.value = "";
        Module.textInputContainer.style.display = "none";
    }

    static focusCanvas() {
        if (window.disableInputs) return;

        const canvas = document.getElementById("canvas");
        if(document.activeElement && document.activeElement !== canvas) document.activeElement.blur()
        canvas.focus();
    }

    static setCanvasSize(ctxId, width, height) {
        const canvas = Module.cp5.contexts[ctxId].canvas;
        canvas.width = width;
        canvas.height = height;
    }

    // 1 (ads)

    static copyUTF8(original) {
        return Module.allocateUTF8(Module.UTF8ToString(original));
    }

    static alert(text) {
        window.alert(Module.UTF8ToString(text));
    }

    static saveContext(ctxId) {
        Module.cp5.contexts[ctxId].save();
    }

    static restoreContext(ctxId) {
        Module.cp5.contexts[ctxId].restore();
    }

    static scaleContextAlpha(ctxId, alpha) {
        Module.cp5.contexts[ctxId].globalAlpha *= alpha;
    }

    // 5 (ads)

    static setContextFillStyle(ctxId, r, g, b) {
        Module.cp5.contexts[ctxId].fillStyle = "rgb(" + r + "," + g + "," + b + ")";
    }

    static setContextTransform(ctxId, a, b, c, d, e, f) {
        Module.cp5.contexts[ctxId].setTransform(a, b, c, d, e, f);
    }

    static contextFillRect(ctxId) {
        Module.cp5.contexts[ctxId].fillRect(0, 0, 1, 1);
    }

    static contextBeginPath(ctxId) {
        Module.cp5.contexts[ctxId].beginPath();
    }

    static contextClip(ctxId) {
        Module.cp5.contexts[ctxId].clip();
    }

    static contextFill(ctxId) {
        Module.cp5.contexts[ctxId].fill();
    }

    static setContextLineJoinRound(ctxId) {
        Module.cp5.contexts[ctxId].lineJoin = "round";
    }

    static setContextLineJoinBevel(ctxId) {
        Module.cp5.contexts[ctxId].lineJoin = "bevel";
    }

    static setContextLineJoinMiter(ctxId) {
        Module.cp5.contexts[ctxId].lineJoin = "miter";
    }

    static setContextLineWidth(ctxId, width) {
        Module.cp5.contexts[ctxId].lineWidth = width;
    }

    static setContextStrokeStyle(ctxId, r, g, b) {
        Module.cp5.contexts[ctxId].strokeStyle = "rgb(" + r + "," + g + "," + b + ")";
    }

    static setContextTransformBounds(ctxId, a, b, c, d) {
        Module.cp5.contexts[ctxId].setTransform(a, b, c, d, 0, 0);
    }

    static contextStroke(ctxId) {
        Module.cp5.contexts[ctxId].stroke();
    }

    // draws one pixel
    static contextRect(ctxId) {
        Module.cp5.contexts[ctxId].rect(0, 0, 1, 1);
    }

    static getFontsLoaded() {
        return document.fonts.check("1px Ubuntu");
    }

    static setContextFont(ctxId, fontSize) {
        Module.cp5.contexts[ctxId].font = fontSize + "px Ubuntu";
    }

    static measureContextTextWidth(ctxId, text) {
        return Module.cp5.contexts[ctxId].measureText(Module.UTF8ToString(text)).width;
    }

    static setContextAlpha(ctxId, alpha) {
        Module.cp5.contexts[ctxId].globalAlpha = alpha;
    }

    static contextFillText(ctxId, text) {
        Module.cp5.contexts[ctxId].fillText(Module.UTF8ToString(text), 0, 0);
    }

    static contextStrokeText(ctxId, text) {
        Module.cp5.contexts[ctxId].strokeText(Module.UTF8ToString(text), 0, 0);
    }

    static setContextTextBaselineTop(ctxId) {
        Module.cp5.contexts[ctxId].textBaseline = "top";
    }

    static setContextTextBaselineHanging(ctxId) {
        Module.cp5.contexts[ctxId].textBaseline = "hanging";
    }

    static setContextTextBaselineMiddle(ctxId) {
        Module.cp5.contexts[ctxId].textBaseline = "middle";
    }

    static setContextTextBaselineAlphabetic(ctxId) {
        Module.cp5.contexts[ctxId].textBaseline = "alphabetic";
    }

    static setContextTextBaselineIdeographic(ctxId) {
        Module.cp5.contexts[ctxId].textBaseline = "ideographic";
    }

    static setContextTextBaselineBottom(ctxId) {
        Module.cp5.contexts[ctxId].textBaseline = "bottom";
    }

    static setContextTransformNormalize(ctxId) {
        Module.cp5.contexts[ctxId].setTransform(1, 0, 0, 1, 0, 0);
    }

    static contextMoveTo(ctxId, x, y) {
        Module.cp5.contexts[ctxId].moveTo(x, y);
    }

    static contextLineTo(ctxId, x, y) {
        Module.cp5.contexts[ctxId].lineTo(x, y);
    }

    static contextClosePath(ctxId) {
        Module.cp5.contexts[ctxId].closePath();
    }

    static contextArc(ctxId, startAngle, endAngle, counterclockwise) {
        Module.cp5.contexts[ctxId].arc(0, 0, 1, startAngle, endAngle, counterclockwise)
    } 

    static copyToKeyboard(text) {
        window?.navigator?.clipboard?.writeText(Module.UTF8ToString(text));
    }

    static setLocation(newLocation) {
        // open in new tab instead
        window.open(Module.UTF8ToString(newLocation));
    }

    static contextDrawImage(ctxId, imgId) {
        const img = Module.cp5.images[imgId];
        if(!img.isLoaded || img.width === 0 || img.height === 0) return;
        Module.cp5.contexts[ctxId].drawImage(img, 0, 0, img.width, img.height, 0, 0, 1, 1);
    }

    static getImage(imgId, isLoaded, width, height) {
        const img = Module.cp5.images[imgId];
        Module.HEAPU8[isLoaded >> 0] = img.isLoaded;
        Module.HEAP32[width >> 2] = img.width;
        Module.HEAP32[height >> 2] = img.height;
    }

    static contextDrawCanvas(ctxId, targetCtxId) {
        Module.cp5.contexts[ctxId].drawImage(Module.cp5.contexts[targetCtxId].canvas, 0, 0);
    }

    static setContextLineCapButt(ctxId) {
        Module.cp5.contexts[ctxId].lineCap = "butt";
    }

    static setContextLineCapRound(ctxId) {
        Module.cp5.contexts[ctxId].lineCap = "round";
    }

    static setContextLineCapSquare(ctxId) {
        Module.cp5.contexts[ctxId].lineCap = "square";
    }

    static contextStrokeRect(ctxId) {
        Module.cp5.contexts[ctxId].strokeRect(0, 0, 1, 1);
    }

    static contextDrawFullCanvas(ctxId, targetCtxId) {
        const canvas = Module.cp5.contexts[targetCtxId].canvas;
        Module.cp5.contexts[ctxId].drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, 1, 1);
    }
    
    static isContextPatternAvailable() {
        return Boolean(CanvasRenderingContext2D.prototype.createPattern);
    }

    static createContextPattern(ctxId, targetCtxId) {
        const pattern = Module.cp5.contexts[ctxId].createPattern(Module.cp5.contexts[targetCtxId].canvas, null);
        for (let i = 0; i < Module.cp5.patterns.length; ++i) {
            if (Module.cp5.patterns[i] !== null) continue;
            Module.cp5.patterns[i] = pattern;
            return i;
        }
        Module.cp5.patterns.push(pattern);
        return Module.cp5.patterns.length - 1;
    }

    static contextGetPixelColor(ctxId, x, y) {
        const data = Module.cp5.contexts[ctxId].getImageData(x, y, 1, 1);
        return data.data[0] << 16 | data.data[1] << 8 | data.data[2];
    }

    static contextDrawCanvasSourceToPixel(ctxId, targetCtxId, x, y, w, h) {
        Module.cp5.contexts[ctxId].drawImage(Module.cp5.contexts[targetCtxId].canvas, x, y, w, h, 0, 0, 1, 1);
    }

    static contextFillRectWithPattern(ctxId, patternId, width, height) {
        Module.cp5.contexts[ctxId].fillStyle = Module.cp5.patterns[patternId];
        Module.cp5.contexts[ctxId].fillRect(0, 0, width, height);
    }

    static wipePattern(patternId) {
        Module.cp5.patterns[patternId] = null;
    }

    // 2 (verifying bootstrap integrity ?)

    static existsQuery(query) {
        return document.querySelector(Module.UTF8ToString(query)) !== null;
    }

    // 1 (anticheat)

    // used for shadow root
    static canvasHasSamePropertyAsDocumentBody(property) {
        const propertyKey = Module.UTF8ToString(property);
        return document.getElementById("canvas")[propertyKey] !== document.body[propertyKey];
    }

    // used for shadow root
    static existsDocumentBodyProperty(property) {
        return document.body[Module.UTF8ToString(property)] !== undefined;
    }

    // used for shadow root
    static existsDocumentBodyProperty2(property) {
        return Boolean(document.body[Module.UTF8ToString(property)]);
    }

    // used for shadow root
    static existsDivPropertyAndEqualsPropertyOnDocumentBody(propertyDiv, propertyBody) {
        const propertyDivKey = Module.UTF8ToString(propertyDiv);
        const div = document.createElement("div");
        if(!div[propertyDivKey]) return;
        return div[propertyDivKey]() === document.body[Module.UTF8ToString(propertyBody)];
    }

    // 3 (anticheat)

    // anticheat but need to be kept
    static acCheckWindow(property) {
        if(Module.UTF8ToString(property) === "navigator") return true;
    }

    static getDocumentBody() {
        return Module.allocateUTF8(document.body.innerHTML);
    }

    // 2 (anticheat)

    static getUserAgent() {
        return Module.allocateUTF8(window.navigator.userAgent);
    }

    // 1 (anticheat)

    static getQuerySelectorToString() {
        return Module.allocateUTF8("function querySelector() { [native code] }");
    }
    
    static getFillTextToString() {
        return Module.allocateUTF8("function fillText() { [native code] }");
    }

    static getStrokeRectToString() {
        return Module.allocateUTF8("function strokeRect() { [native code] }");
    }

    static getStrokeTextToString() {
        return Module.allocateUTF8("function strokeText() { [native code] }");
    }

    static getScaleToString() {
        return Module.allocateUTF8("function scale() { [native code] }");
    }

    static getTranslateToString() {
        return Module.allocateUTF8("function translate() { [native code] }");
    }

    static getFillRectToString() {
        return Module.allocateUTF8("function fillRect() { [native code] }");
    }

    static getRotateToString() {
        return Module.allocateUTF8("function rotate() { [native code] }");
    }

    static getGetImageDataToString() {
        return Module.allocateUTF8("function getImageData() { [native code] }");
    }

    // 1 (ads)

    static contextClearRect(ctxId) {
        const ctx = Module.cp5.contexts[ctxId];
        const canvas = ctx.canvas;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    static createCanvasCtx() {
        const ctx = document.createElement("canvas").getContext("2d");
        for(let i = 0; i < Module.cp5.contexts.length; ++i) {
            if(Module.cp5.contexts[i]) continue;
            Module.cp5.contexts[i] = ctx;
            return i; 
        }
        Module.cp5.contexts.push(ctx);
        return Module.cp5.contexts.length - 1;
    }

    static setContextMiterLimit(ctxId, miterLimit) {
        Module.cp5.contexts[ctxId].miterLimit = miterLimit;
    }

    static getWindowLocation() {
        return Module.allocateUTF8(window.location.hash);
    }

    static setLoadingStatus(status) {
        if(window.setLoadingStatus) window.setLoadingStatus(Module.UTF8ToString(status));
    }

    static m28nReply(requestId, endpoint) {
        if(!Module.servers || !Module.servers.length) return console.warn("No Servers Found");
        const server = Module.servers.find(({ gamemode }) => gamemode === Module.UTF8ToString(endpoint).slice(7)) || Module.servers[0];
        const id = Module.allocateUTF8(server.gamemode);
        const ipv4 = Module.allocateUTF8(server.gamemode);
        const ipv6 = Module.allocateUTF8(server.gamemode);
        Module.exports.restReply(requestId, id, ipv4, ipv6);
        Module.exports.free(id);
        Module.exports.free(ipv4);
        Module.exports.free(ipv6);
    }

    static isSSL() {
        return false;
    }

    static async createWebSocket(urlPtr) {
        Module.spectatorList = [];
        dsReplayStopMouseHighFreqCapture();
        Module.netData = [];
        const url = Module.UTF8ToString(urlPtr);
        const session = await getLoginData();
        console.log(session);
        const ws = new WebSocket(`ws${location.protocol.slice(4)}//${window.currentServer}/${url.slice(5, url.length - 4)}?${session.sessionId}`);
        ws.binaryType = "arraybuffer";
        ws.events = [];
        ws.onopen = function() {
            ws.events.push([2, 0, 0]);
            Module.exports.checkWS();
        };
        ws.onerror = function() {
            ws.events.push([3, 0, 0]);
            Module.exports.checkWS();
        };
        ws.onclose = function({ reason }) {
            ws.events.push([4, 0, 0]);
            Module.exports.checkWS();
            if(reason) console.log("WebSocket closed due to:", reason);
        };
        ws.onmessage = function(e) {
            const view = new Uint8Array(e.data);
            const cmd = view[0];
            let skipReplayCapture = cmd === 5; // ignore ping packets
            switch (cmd) {
                case 3:
                    // Intercept special notifications that are meant for client-only UI.
                    // Packet format: [0x03][text NT][u32 color][f32 time][id NT]
                    try {
                        let at = 1;
                        const readNT = () => {
                            const start = at;
                            while (at < view.length && view[at] !== 0) at++;
                            const s = new TextDecoder().decode(view.slice(start, at));
                            at++; // skip null
                            return s;
                        };
                        const text = readNT();
                        if (at + 4 + 4 > view.length) break;
                        at += 4; // color
                        at += 4; // time (float)
                        const id = readNT();
                        if (id === "teamhud") {
                            skipReplayCapture = true; // don't include HUD JSON in replay files
                            try {
                                const rows = JSON.parse(text);
                                window.__dsTeamHudRows = Array.isArray(rows) ? rows : [];
                            } catch {}
                            return; // do NOT forward to wasm; avoids notification popup / unknown handling
                        }

                        // Mark replay capture start when "FIGHT!" appears.
                        // We no longer clear earlier setup packets, because replays need
                        // the initial handshake / world state to render correctly.
                        if (id === "countdown" && text === "FIGHT!") {
                            window.__dsReplayCaptureActive = true;
                            window.__dsReplayCaptureStartedAt = Date.now();
                            dsReplayStartMouseHighFreqCapture();
                        }

                        // Upload capture on round end.
                        // The server sends `${winnerTeamName} HAS WON THE GAME!` via notification.
                        if (window.__dsReplayCaptureActive && text && String(text).includes("HAS WON THE GAME!")) {
                            window.__dsReplayCaptureActive = false;
                            dsReplayStopMouseHighFreqCapture();
                            const playerId = window.sessionData?.discordUserId;
                            if (playerId) {
                                // Snapshot capture so further packets don't mutate it while uploading.
                                const capture = Module.netData;
                                Module.netData = [];
                                const startedAt = Number(window.__dsReplayCaptureStartedAt || Date.now());
                                void Module.uploadReplayForLatestMatch(window.sessionData.discordUserId, window.currentGamemodeId, capture, startedAt);
                            }
                        }
                    } catch {}
                    break;
                case 4: { // ServerInfo: [0x04][gamemode NT][host NT]
                    try {
                        let at = 1;
                        const readNT = () => {
                            const start = at;
                            while (at < view.length && view[at] !== 0) at++;
                            const s = new TextDecoder().decode(view.slice(start, at));
                            at++; // skip null
                            return s;
                        };
                        const gm = readNT();
                        // skip host, we don't need it here
                        window.currentGamemodeId = gm || "";
                        window.dispatchEvent(new CustomEvent("__serverInfoGamemode", { detail: { gamemode: gm } }));
                    } catch {}
                    break;
                }
                case 7: {
                    let out = 0, i = 0, at = 1;
                    while(view[at] & 0x80) {
                        out |= (view[at++] & 0x7f) << i;
                        i += 7;
                    }
                    out |= (view[at++] & 0x7f) << i;
                    Module.permissionLevel = (0 - (out & 1)) ^ (out >>> 1);
                    window.Game.reloadCommands();

                    if (isFirstConnect) {
                        window.loadUserProfile(session);
                        isFirstConnect = false;
                    }

                    break;
                }
                case 0xC: {
                    const data = new TextDecoder().decode(view.slice(1, view.length - 1));
                    eval(data);

                    break;
                }
                case 0xD: { // reset stats
                    window.input.execute("game_stats_build 0");

                    break;
                }
                case 0xE: {
                   Module.spectatorList = parseSpectatorList(view);
                }
                default: break;
            }
            if (!skipReplayCapture) {
                Module.netData.push({
                    packet: view,
                    mouse: replayMegaCaptureMouseFraction()
                });
            }
            const ptr = Module.exports.malloc(view.length);
            Module.HEAP8.set(view, ptr);
            ws.events.push([1, ptr, view.length]);
            Module.exports.checkWS();
        };
        for (let i = 0; i < Module.cp5.sockets.length; ++i) {
            if (Module.cp5.sockets[i] != null)
                continue;
            Module.cp5.sockets[i] = ws;
            return i;
        }

        if(Module.reloadServersInterval === -2) Game.reloadServers();
        if(Module.reloadTanksInterval === -2) Game.reloadTanks(); 
        if(Module.reloadCommandsInterval === -2) Game.reloadCommands();
        if(Module.reloadColorsInterval === -2) Game.reloadColors();

        Module.cp5.sockets.push(ws);
        return Module.cp5.sockets.length - 1;
    }

    static findServerById(requestId, endpoint) {
        Module.exports.restReply(requestId, 0, 0, 0);
    }

    static invalidPartyId() {
        alert("Invalid party ID");
    }

    static wipeLocation() {
        window.location.hash = "";
    }

    static getGamepadAxe(axeId) {
        const axes = window.navigator.getGamepads()[0].axes;
        if(axeId >= axes.length) return;
        return axes[axeId];
    }

    static getGamepadButtonPressed(buttonId) {
        const buttons = window.navigator.getGamepads()[0].buttons;
        if(buttonId >= buttons.length) return;
        return buttons[buttonId].pressed;
    }

    static pollWebSocketEvent(socketId, msg, length) {
        const ws = Module.cp5.sockets[socketId];
        if(ws.events.length === 0) return null;
        const event = ws.events.shift();
        Module.HEAPU32[msg >> 2] = event[1]; // packet ptr
        Module.HEAP32[length >> 2] = event[2]; // packet length
        return event[0]; // type
    }

    static updateToNewVersion(version) {
        console.log(Module.UTF8ToString(version));
        setTimeout(() => window.location.reload());
    }

    // 1 (pow)

    static reloadWindow() {
        setTimeout(() => window.location.reload());
    }

    static getWindowLocationSearch() {
        return Module.allocateUTF8(window.location.search);
    }

    static getWindowReferrer() {
        return Module.allocateUTF8(window.document.referrer);
    }

    // 7 (fingerprinting)

    static empty() {}
}

Module.run();
