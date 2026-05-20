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

window.disableInputs = false;
window.mouseData = { x: 0, y: 0 };
const keyDownMap = new Map(); // For 1-tap only keys

window.setupInput = () => {
    window.input = {
        mouse: Module.exports.mouse,
        keyDown: Module.exports.keyDown,
        keyUp: Module.exports.keyUp,
        blur: Module.exports.resetKeys,
        wheel: Module.exports.mouseWheel,
        prevent_right_click: Module.exports.preventRightClick,
        flushInputHooks: Module.exports.flushInputHooks,
        print_convar_help: Module.exports.printConsoleHelp,
        should_prevent_unload: Module.exports.hasTank,
        get_convar: key => {
            const keyPtr = Module.allocateUTF8(key.toString());
            const res = Module.exports.getConvar(keyPtr);
            Module.exports.free(keyPtr);
            return res ? Module.UTF8ToString(res) : null;
        },
        set_convar: (key, val) => {
            const keyPtr = Module.allocateUTF8(key.toString());
            const valPtr = Module.allocateUTF8(val.toString());
            const res = Boolean(Module.exports.setConvar(keyPtr, valPtr));
            Module.exports.free(keyPtr);
            Module.exports.free(valPtr);
            return res;
        },
        execute: cmd => {
            const cmdPtr = Module.allocateUTF8(cmd.toString());
            Module.exports.execute(cmdPtr);
            Module.exports.free(cmdPtr);
        }
    };

    const onMouseWheel = (e) => {
        window.input.wheel(e.wheelDelta / -120);
        Game.socket.send(new Uint8Array([0xE, e.deltaY > 0 ? 1 : 0]));
    }

    /firefox/i.test(navigator.userAgent) ? document.addEventListener("DOMMouseScroll", onMouseWheel) : document.body.onmousewheel = onMouseWheel;

    let isTyping = false;

    const scale = window.localStorage.getItem("no_retina") ? 1 : window.devicePixelRatio;
    const canvas = document.getElementById("canvas");
    const loading = document.getElementById('loading');

    canvas.onmousemove = (e) => {
        const mouseX = e.clientX * scale;
        const mouseY = e.clientY * scale;
        window.mouseData.x = mouseX;
        window.mouseData.y = mouseY;
        window.input.mouse(mouseX, mouseY);
    }
    
    canvas.onmousedown = e => {
        if (window.disableInputs) return;
        window.input.flushInputHooks();
        window.input.keyDown(e.button + 1);
    }

    canvas.onmouseup = e => {
        if (window.disableInputs) return;
        window.input.flushInputHooks();
        window.input.keyUp(e.button + 1);
    }

    window.onkeydown = e => {
        if (window.disableInputs) return;
        if (e.repeat) return;

        // Completely disable TAB-based team switching; team is selected via UI instead.
        if (e.keyCode === 9) {
            e.preventDefault();
            return;
        }

        // Spectating (no tank): Left/Right arrow cycle spectate target — server ignores when alive.
        if (typeof Game !== "undefined" && Game.socket && (e.keyCode === 37 || e.keyCode === 39) && !isTyping) {
            if (!window.input.should_prevent_unload()) {
                e.preventDefault();
                const dirByte = e.keyCode === 37 ? 1 : 0; // 1 = previous, 0 = next (matches ServerBound.Spectate)
                Game.socket.send(new Uint8Array([0xB, dirByte]));
                keyDownMap.set(e.keyCode, true);
                return;
            }
        }

        window.input.flushInputHooks();
        if(e.keyCode >= 112 && e.keyCode <= 130 && e.keyCode !== 113) return;
        window.input.keyDown(e.keyCode);
    
        if (e.keyCode === 32 && !keyDownMap.get(e.keyCode) && !isTyping) { // Spectate (SPACE key)
            Game.socket.send(new Uint8Array([0xB]));
        }
        
        if (e.keyCode === 66 && !keyDownMap.get(e.keyCode) && !isTyping) { // Reset stats (B key)
            Game.socket.send(new Uint8Array([0xC]));
        }

        // F / distress: handled only by loader.js radial (keyup sends [0xD, type]) so we never double-send with hold-release.

        keyDownMap.set(e.keyCode, true);
    }

    window.onkeyup = e => {
        if (window.disableInputs) return;

        // Ignore TAB on keyup as well so it never reaches the game.
        if (e.keyCode === 9) {
            e.preventDefault();
            return;
        }

        window.input.flushInputHooks();
        if(e.keyCode >= 112 && e.keyCode <= 130 && e.keyCode !== 113) return;
        window.input.keyUp(e.keyCode);
        if(!isTyping && e.ctrlKey && e.metaKey) e.preventDefault();
        
        keyDownMap.set(e.keyCode, false);
    }

    canvas.onclick = window.onclick = () => window.input.flushInputHooks();

    canvas.ondragstart = e => e.preventDefault();

    canvas.oncontextmenu = e => window.input.prevent_right_click() ? e.preventDefault() : null;
    
    window.setLoadingStatus = str => loading.innerText = str;

    window.setTyping = val => isTyping = val;

    window.unscale = val => val / scale;

    window.onresize = () => {
        canvas.width = window.innerWidth * scale;
        canvas.height = window.innerHeight * scale;
    }

    window.onresize()
}
