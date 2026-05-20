// diepStyle.js - Diep Style Menu Logic

// Wait for page load
(function() {
    'use strict';

    // Wait for DOM and diepStyle.html to be loaded
    const waitForElements = setInterval(() => {
        const menuElement = document.getElementById('diepStyleMenu');
        if (menuElement && typeof input !== 'undefined') {
            clearInterval(waitForElements);
            console.log('Diep Style: Initializing...');
            initDiepStyle();
        }
    }, 100);
})();

function initDiepStyle() {
    'use strict';

    // Configuration
    const THEMES = {
        incantation: `[{"theme":{"name":"Incantation","author":"Razor"}},{"id":2,"value":"ffffff"},{"id":15,"value":"1f8585"},{"id":3,"value":"7efffc"},{"id":4,"value":"ff7f7f"},{"id":5,"value":"e97fff"},{"id":6,"value":"81ff81"},{"id":17,"value":"111111"},{"id":12,"value":"111111"},{"id":8,"value":"0f1c24"},{"id":7,"value":"89ff69"},{"id":16,"value":"fcc376"},{"id":9,"value":"112730"},{"id":10,"value":"121728"},{"id":11,"value":"421b53"},{"id":14,"value":"0a1923"},{"id":1,"value":"14222b"},{"cmd":"ren_bar_background_color","value":"111111"},{"cmd":"ren_stroke_solid_color","value":"999999"},{"id":13,"value":"133f5c"},{"cmd":"ren_xp_bar_fill_color","value":"234f65"},{"cmd":"ren_score_bar_fill_color","value":"274273"},{"cmd":"ren_health_fill_color","value":"9c9c9c"},{"cmd":"ren_health_background_color","value":"000000"},{"cmd":"ren_grid_color","value":"222222"},{"cmd":"ren_minimap_background_color","value":"999999"},{"cmd":"ren_minimap_border_color","value":"999999"},{"cmd":"ren_background_color","value":"08131a"},{"cmd":"ren_border_color","value":"000000"},{"cmd":"ui_replace_colors","value":["234f65","234f65","234f65","234f65","234f65","234f65","234f65","234f65"]},{"cmd":"grid_base_alpha","value":0},{"cmd":"stroke_soft_color_intensity","value":0},{"cmd":"stroke_soft_color","value":false},{"cmd":"border_color_alpha","value":0.1},{"cmd":"ui_scale","value":0.9},{"cmd":"ui","value":false},{"cmd":"fps","value":true},{"cmd":"raw_health_values","value":false},{"cmd":"names","value":false}]`,
        moomoo: `[{"theme":{"name":"Moomoo"}},{"id":2,"value":"847377"},{"id":15,"value":"7F4B63"},{"id":3,"value":"475F9E"},{"id":4,"value":"844052"},{"id":5,"value":"A330B1"},{"id":6,"value":"A66E4F"},{"id":17,"value":"6D6B84"},{"id":12,"value":"596B4A"},{"id":8,"value":"5b6b4d"},{"id":7,"value":"928150"},{"id":16,"value":"596B4A"},{"id":9,"value":"8c4256"},{"id":10,"value":"63647e"},{"id":11,"value":"5A5B72"},{"id":14,"value":"837752"},{"id":1,"value":"535377"},{"cmd":"ren_bar_background_color","value":"586B44"},{"cmd":"ren_stroke_solid_color","value":"35354E"},{"id":13,"value":"64ff8c"},{"cmd":"ren_xp_bar_fill_color","value":"FFFFFF"},{"cmd":"ren_score_bar_fill_color","value":"586B44"},{"cmd":"ren_health_fill_color","value":"8ECC51"},{"cmd":"ren_health_background_color","value":"3D3F42"},{"cmd":"ren_grid_color","value":"000000"},{"cmd":"ren_minimap_background_color","value":"586B44"},{"cmd":"ren_minimap_border_color","value":"586B44"},{"cmd":"ren_background_color","value":"768F5B"},{"cmd":"ren_border_color","value":"333333"},{"cmd":"ui_replace_colors","value":["5d4322","825d30","a8783e","bf8f54","c89e6a","d6b68f","e3ceb5","f1e7da"]},{"cmd":"grid_base_alpha","value":0.1},{"cmd":"stroke_soft_color_intensity","value":0.25},{"cmd":"stroke_soft_color","value":false},{"cmd":"border_color_alpha","value":0.1},{"cmd":"ui_scale","value":1},{"cmd":"ui","value":false},{"cmd":"fps","value":false},{"cmd":"raw_health_values","value":false},{"cmd":"names","value":false}]`,
        '80s': `[{"theme":{"name":"80s"}},{"id":2,"value":"00efff"},{"id":15,"value":"ff00ff"},{"id":3,"value":"00efff"},{"id":4,"value":"ff00ff"},{"id":5,"value":"ffaa00"},{"id":6,"value":"4FFFB0"},{"id":17,"value":"c6c6c6"},{"id":12,"value":"ffe869"},{"id":8,"value":"FFD800"},{"id":7,"value":"89ff69"},{"id":16,"value":"fcc376"},{"id":9,"value":"FF004F"},{"id":10,"value":"0000CD"},{"id":11,"value":"ffffff"},{"id":14,"value":"43197e"},{"id":1,"value":"999999"},{"cmd":"ren_bar_background_color","value":"1e0b38"},{"cmd":"ren_stroke_solid_color","value":"555555"},{"id":13,"value":"64ff8c"},{"cmd":"ren_xp_bar_fill_color","value":"ffde43"},{"cmd":"ren_score_bar_fill_color","value":"43ff91"},{"cmd":"ren_health_fill_color","value":"85e37d"},{"cmd":"ren_health_background_color","value":"555555"},{"cmd":"ren_grid_color","value":"ff00ff"},{"cmd":"ren_minimap_background_color","value":"CDCDCD"},{"cmd":"ren_minimap_border_color","value":"797979"},{"cmd":"ren_background_color","value":"1e0b38"},{"cmd":"ren_border_color","value":"000000"},{"cmd":"ui_replace_colors","value":["e69f6c","ff73ff","c980ff","71b4ff","ffed3f","ff7979","88ff41","41ffff"]},{"cmd":"grid_base_alpha","value":1.1},{"cmd":"stroke_soft_color_intensity","value":0.3},{"cmd":"stroke_soft_color","value":false},{"cmd":"border_color_alpha","value":0.6},{"cmd":"ui_scale","value":1},{"cmd":"ui","value":false},{"cmd":"fps","value":false},{"cmd":"raw_health_values","value":false},{"cmd":"names","value":false}]`,
        dark: `[{"theme":{"name":"Dark"}},{"id":2,"value":"001117"},{"id":15,"value":"140000"},{"id":3,"value":"005574"},{"id":4,"value":"540000"},{"id":5,"value":"090413"},{"id":6,"value":"00121a"},{"id":17,"value":"0D0D0D"},{"id":12,"value":"0D0D0D"},{"id":8,"value":"141400"},{"id":7,"value":"0d1500"},{"id":16,"value":"596B4A"},{"id":9,"value":"170606"},{"id":10,"value":"0a0016"},{"id":11,"value":"160517"},{"id":14,"value":"141414"},{"id":1,"value":"0f0f0f"},{"cmd":"ren_bar_background_color","value":"000000"},{"cmd":"ren_stroke_solid_color","value":"555555"},{"id":13,"value":"00bd88"},{"cmd":"ren_xp_bar_fill_color","value":"ffde43"},{"cmd":"ren_score_bar_fill_color","value":"43ff91"},{"cmd":"ren_health_fill_color","value":"85e37d"},{"cmd":"ren_health_background_color","value":"555555"},{"cmd":"ren_grid_color","value":"111111"},{"cmd":"ren_minimap_background_color","value":"323232"},{"cmd":"ren_minimap_border_color","value":"986895"},{"cmd":"ren_background_color","value":"000000"},{"cmd":"ren_border_color","value":"0f0f0f"},{"cmd":"ui_replace_colors","value":["ffe280","ff31a0","882dff","2d5aff","ffde26","ff2626","95ff26","17d2ff"]},{"cmd":"grid_base_alpha","value":2},{"cmd":"stroke_soft_color_intensity","value":-10},{"cmd":"stroke_soft_color","value":false},{"cmd":"border_color_alpha","value":0.5},{"cmd":"ui_scale","value":1},{"cmd":"ui","value":false},{"cmd":"fps","value":false},{"cmd":"raw_health_values","value":false},{"cmd":"names","value":false}]`,
        glass: `[{"theme":{"name":"Glass"}},{"id":2,"value":"00627D"},{"id":15,"value":"7E0000"},{"id":3,"value":"00627D"},{"id":4,"value":"7E0000"},{"id":5,"value":"3D007E"},{"id":6,"value":"007E00"},{"id":17,"value":"464646"},{"id":12,"value":"7E7E00"},{"id":8,"value":"7E7E00"},{"id":7,"value":"457E00"},{"id":16,"value":"795C00"},{"id":9,"value":"7C0320"},{"id":10,"value":"43397d"},{"id":11,"value":"7E037A"},{"id":14,"value":"252525"},{"id":1,"value":"464646"},{"cmd":"ren_bar_background_color","value":"191919"},{"cmd":"ren_stroke_solid_color","value":"555555"},{"id":13,"value":"008B54"},{"cmd":"ren_xp_bar_fill_color","value":"666600"},{"cmd":"ren_score_bar_fill_color","value":"008B54"},{"cmd":"ren_health_fill_color","value":"85e37d"},{"cmd":"ren_health_background_color","value":"555555"},{"cmd":"ren_grid_color","value":"373737"},{"cmd":"ren_minimap_background_color","value":"464646"},{"cmd":"ren_minimap_border_color","value":"676767"},{"cmd":"ren_background_color","value":"000000"},{"cmd":"ren_border_color","value":"454545"},{"cmd":"ui_replace_colors","value":["e69f6c","ff73ff","c980ff","71b4ff","ffed3f","ff7979","88ff41","41ffff"]},{"cmd":"grid_base_alpha","value":2},{"cmd":"stroke_soft_color_intensity","value":-9},{"cmd":"stroke_soft_color","value":false},{"cmd":"border_color_alpha","value":0.5},{"cmd":"ui_scale","value":1},{"cmd":"ui","value":false},{"cmd":"fps","value":false},{"cmd":"raw_health_values","value":false},{"cmd":"names","value":false}]`,
        juicebear: `[{"theme":{"name":"Juicebear 3.1","author":"Mr. Hacker"}},{"id":2,"value":"1963d0"},{"id":15,"value":"cd1d3d"},{"id":3,"value":"1963d0"},{"id":4,"value":"cd1d3d"},{"id":5,"value":"ae0e66"},{"id":6,"value":"239d23"},{"id":17,"value":"28286b"},{"id":12,"value":"ffff7c"},{"id":8,"value":"e19c9c"},{"id":7,"value":"4ad8cc"},{"id":16,"value":"af7979"},{"id":9,"value":"b28484"},{"id":10,"value":"867272"},{"id":11,"value":"d4aab2"},{"id":14,"value":"512c4a"},{"id":1,"value":"603359"},{"cmd":"ren_bar_background_color","value":"000000"},{"cmd":"ren_stroke_solid_color","value":"000000"},{"id":13,"value":"239d23"},{"cmd":"ren_xp_bar_fill_color","value":"e19c9c"},{"cmd":"ren_score_bar_fill_color","value":"239d23"},{"cmd":"ren_health_fill_color","value":"952727"},{"cmd":"ren_health_background_color","value":"000000"},{"cmd":"ren_grid_color","value":"5c3251"},{"cmd":"ren_minimap_background_color","value":"5c3251"},{"cmd":"ren_minimap_border_color","value":"000000"},{"cmd":"ren_background_color","value":"5c3251"},{"cmd":"ren_border_color","value":"000000"},{"cmd":"ui_replace_colors","value":["b28484","e19c9c","4ad8cc","239d23","ffff7c","cd1d3d","952727","1963d0"]},{"cmd":"grid_base_alpha","value":0},{"cmd":"stroke_soft_color_intensity","value":0},{"cmd":"stroke_soft_color","value":true},{"cmd":"border_color_alpha","value":0.1},{"cmd":"ui_scale","value":1},{"cmd":"ui","value":false},{"cmd":"fps","value":true},{"cmd":"raw_health_values","value":true},{"cmd":"names","value":false}]`,
        calm: `[{"theme":{"name":"Calm","author":"Fortune"}},{"id":2,"value":"d4d4d4"},{"id":15,"value":"f14e54"},{"id":3,"value":"00b1de"},{"id":4,"value":"bd3d42"},{"id":5,"value":"bf7ff5"},{"id":6,"value":"00e16e"},{"id":17,"value":"c6c6c6"},{"id":12,"value":"ffe869"},{"id":8,"value":"432969"},{"id":7,"value":"89ff69"},{"id":16,"value":"fcc376"},{"id":9,"value":"70b1c8"},{"id":10,"value":"200a3c"},{"id":11,"value":"f177dd"},{"id":14,"value":"bbbbbb"},{"id":1,"value":"b2dcff"},{"cmd":"ren_bar_background_color","value":"000000"},{"cmd":"ren_stroke_solid_color","value":"ff66ad"},{"id":13,"value":"000000"},{"cmd":"ren_xp_bar_fill_color","value":"528999"},{"cmd":"ren_score_bar_fill_color","value":"7cf0ff"},{"cmd":"ren_health_fill_color","value":"98b5ff"},{"cmd":"ren_health_background_color","value":"392121"},{"cmd":"ren_grid_color","value":"c70000"},{"cmd":"ren_minimap_background_color","value":"ffffff"},{"cmd":"ren_minimap_border_color","value":"000000"},{"cmd":"ren_background_color","value":"356466"},{"cmd":"ren_border_color","value":"000000"},{"cmd":"ui_replace_colors","value":["52c0ff","3ea4d5","3a83d3","3457b4","1e3a96","10217e","0a0b53","050d37"]},{"cmd":"grid_base_alpha","value":0},{"cmd":"stroke_soft_color_intensity","value":0.45},{"cmd":"stroke_soft_color","value":false},{"cmd":"border_color_alpha","value":0.24},{"cmd":"ui_scale","value":0.9},{"cmd":"ui","value":false},{"cmd":"fps","value":true},{"cmd":"raw_health_values","value":true},{"cmd":"names","value":false}]`,
        mania: `[{"theme":{"name":"Mania","author":"Mono"}},{"id":2,"value":"105eff"},{"id":15,"value":"be296d"},{"id":3,"value":"0067e0"},{"id":4,"value":"db1717"},{"id":5,"value":"ac92f5"},{"id":6,"value":"58d000"},{"id":17,"value":"c6c6c6"},{"id":12,"value":"ffe869"},{"id":8,"value":"62d7ff"},{"id":7,"value":"89ff69"},{"id":16,"value":"fcc376"},{"id":9,"value":"bc8afc"},{"id":10,"value":"f388fc"},{"id":11,"value":"27a5f1"},{"id":14,"value":"8d8d8d"},{"id":1,"value":"166c7e"},{"cmd":"ren_bar_background_color","value":"000000"},{"cmd":"ren_stroke_solid_color","value":"000000"},{"id":13,"value":"4a4749"},{"cmd":"ren_xp_bar_fill_color","value":"262c43"},{"cmd":"ren_score_bar_fill_color","value":"1a2f9d"},{"cmd":"ren_health_fill_color","value":"85e37d"},{"cmd":"ren_health_background_color","value":"000000"},{"cmd":"ren_grid_color","value":"48d4ff"},{"cmd":"ren_minimap_background_color","value":"394264"},{"cmd":"ren_minimap_border_color","value":"394264"},{"cmd":"ren_background_color","value":"394264"},{"cmd":"ren_border_color","value":"000000"},{"cmd":"ui_replace_colors","value":["1558ff","1148d2","0e3bab","0f3cb0","0d38a2","0c3494","0a2874","061948"]},{"cmd":"grid_base_alpha","value":0},{"cmd":"stroke_soft_color_intensity","value":0.05},{"cmd":"stroke_soft_color","value":true},{"cmd":"border_color_alpha","value":0.38},{"cmd":"ui_scale","value":0.56},{"cmd":"ui","value":false},{"cmd":"fps","value":false},{"cmd":"raw_health_values","value":false},{"cmd":"names","value":false}]`,
        defaultplus: `[{"theme":{"name":"defaultPlus","author":"Raxor"}},{"id":2,"value":"0067e0"},{"id":15,"value":"db1717"},{"id":3,"value":"0067e0"},{"id":4,"value":"db1717"},{"id":5,"value":"ac92f5"},{"id":6,"value":"58d000"},{"id":17,"value":"c6c6c6"},{"id":12,"value":"ffe869"},{"id":8,"value":"ffe869"},{"id":7,"value":"89ff69"},{"id":16,"value":"fcc376"},{"id":9,"value":"fc7677"},{"id":10,"value":"768dfc"},{"id":11,"value":"f177dd"},{"id":14,"value":"8d8d8d"},{"id":1,"value":"7e7e7e"},{"cmd":"ren_bar_background_color","value":"000000"},{"cmd":"ren_stroke_solid_color","value":"555555"},{"id":13,"value":"64ff8c"},{"cmd":"ren_xp_bar_fill_color","value":"ffde43"},{"cmd":"ren_score_bar_fill_color","value":"43ff91"},{"cmd":"ren_health_fill_color","value":"85e37d"},{"cmd":"ren_health_background_color","value":"000000"},{"cmd":"ren_grid_color","value":"000000"},{"cmd":"ren_minimap_background_color","value":"CDCDCD"},{"cmd":"ren_minimap_border_color","value":"797979"},{"cmd":"ren_background_color","value":"a5a5a5"},{"cmd":"ren_border_color","value":"000000"},{"cmd":"ui_replace_colors","value":["fcad76","f943ff","8543ff","437fff","ffde43","ff4343","82ff43","43fff9"]},{"cmd":"grid_base_alpha","value":0},{"cmd":"stroke_soft_color_intensity","value":1},{"cmd":"stroke_soft_color","value":false},{"cmd":"border_color_alpha","value":0.1},{"cmd":"ui_scale","value":0.8},{"cmd":"ui","value":false},{"cmd":"fps","value":true},{"cmd":"raw_health_values","value":true},{"cmd":"names","value":false}]`
    };

    const DEFAULT_COLORS = [
        { id: 2, name: "You FFA", color: "00B2E1" },
        { id: 15, name: "Other FFA", color: "F14E54" },
        { id: 3, name: "Blue Team", color: "00B2E1" },
        { id: 4, name: "Red Team", color: "F14E54" },
        { id: 5, name: "Purple Team", color: "BF7FF5" },
        { id: 6, name: "Green Team", color: "00E16E" },
        { id: 17, name: "Fallen team", color: "C0C0C0" },
        { id: 12, name: "Arena Closer", color: "FFE869" },
        { id: 8, name: "Square", color: "FFE869" },
        { id: 7, name: "Green Square?", color: "8AFF69" },
        { id: 16, name: "Necro Square", color: "FCC376" },
        { id: 9, name: "Triangle", color: "FC7677" },
        { id: 10, name: "Pentagon", color: "768DFC" },
        { id: 11, name: "Crasher", color: "F177DD" },
        { id: 14, name: "Waze Wall", color: "BBBBBB" },
        { id: 1, name: "Turret", color: "999999" },
        { id: 0, name: "Smasher", color: "555555" },
        { id: 50, name: "All Bars", color: "000000", cmd: "ren_bar_background_color" },
        { id: 51, name: "Outline", color: "555555", cmd: "ren_stroke_solid_color" },
        { id: 13, name: "Leader Board", color: "64ff8c" },
        { id: 52, name: "Xp Bar", color: "FFDE43", cmd: "ren_xp_bar_fill_color" },
        { id: 53, name: "Score Bar", color: "43FF91", cmd: "ren_score_bar_fill_color" },
        { id: 54, name: "Health Bar1", color: "85e37d", cmd: "ren_health_fill_color" },
        { id: 55, name: "Health Bar2", color: "555555", cmd: "ren_health_background_color" },
        { id: 56, name: "Grid Color", color: "000000", cmd: "ren_grid_color" },
        { id: 57, name: "Minimap 1", color: "CDCDCD", cmd: "ren_minimap_background_color" },
        { id: 58, name: "Minimap 2", color: "555555", cmd: "ren_minimap_border_color" },
        { id: 59, name: "Background 1", color: "CCCCCC", cmd: "ren_background_color" },
        { id: 60, name: "Background 2", color: "000000", cmd: "ren_border_color" },
        { id: 110, name: "UI Color1", color: "43FFF9", cmd: "ui_replace_colors" },
        { id: 111, name: "UI Color2", color: "82FF43", cmd: "ui_replace_colors" },
        { id: 112, name: "UI Color3", color: "FF4343", cmd: "ui_replace_colors" },
        { id: 113, name: "UI Color4", color: "FFDE43", cmd: "ui_replace_colors" },
        { id: 114, name: "UI Color5", color: "437FFF", cmd: "ui_replace_colors" },
        { id: 115, name: "UI Color6", color: "8543ff", cmd: "ui_replace_colors" },
        { id: 116, name: "UI Color7", color: "F943FF", cmd: "ui_replace_colors" },
        { id: 117, name: "UI Color8", color: "FCAD76", cmd: "ui_replace_colors" }
    ];

    const DEFAULT_RENDERS = [
        { name: "Grid Alpha", value: 0.1, cmd: "grid_base_alpha" },
        { name: "Outline Intensity", value: 0.25, cmd: "stroke_soft_color_intensity" },
        { name: "Show Outline", value: false, cmd: "stroke_soft_color", reverse: true },
        { name: "Border Alpha", value: 0.1, cmd: "border_color_alpha" },
        { name: "UI Scale", value: 1, cmd: "ui_scale" }
    ];

    // State
    let currentSetting = null;
    let saveSlots = [];
    let isMenuOpen = false;

    // DOM Elements
    let menuElement;

    console.log('Diep Style: Starting initialization...');
    setupMenu();

    function setupMenu() {
        menuElement = document.getElementById('diepStyleMenu');
        
        if (!menuElement) {
            console.error('Diep Style: Menu element not found!');
            return;
        }
        
        console.log('Diep Style: Menu element found');
        
        // Load settings from localStorage
        loadSettings();
        
        // Build UI
        renderUI();
        
        // Setup event listeners
        setupEventListeners();
        
        // Apply settings on load
        setTimeout(() => {
            console.log('Diep Style: Applying initial settings...');
            applyAllCommands();
        }, 2000);
    }

    function loadSettings() {
        // Force version check - clear old settings if version mismatch
        const stored = localStorage.getItem('diepStyle');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                // Check if version matches and has correct render count
                if (parsed.nowSetting?.version === 0.097 && parsed.nowSetting?.renders?.length === 5) {
                    currentSetting = parsed.nowSetting;
                    saveSlots = parsed.saveList || createDefaultSlots();
                } else {
                    // Old version - reset everything
                    console.log('Diep Style: Resetting due to version/structure change');
                    localStorage.removeItem('diepStyle');
                    currentSetting = createDefaultSetting();
                    saveSlots = createDefaultSlots();
                }
            } catch (e) {
                currentSetting = createDefaultSetting();
                saveSlots = createDefaultSlots();
            }
        } else {
            currentSetting = createDefaultSetting();
            saveSlots = createDefaultSlots();
        }
        console.log('Diep Style: Settings loaded', currentSetting);
    }

    function createDefaultSetting() {
        return {
            version: 0.097,
            saveTH: 0,
            lock: false,
            colors: JSON.parse(JSON.stringify(DEFAULT_COLORS)),
            renders: JSON.parse(JSON.stringify(DEFAULT_RENDERS))
        };
    }

    function createDefaultSlots() {
        return Array(6).fill(null).map(() => createDefaultSetting());
    }

    function saveSettings() {
        saveSlots[currentSetting.saveTH] = { ...currentSetting };
        localStorage.setItem('diepStyle', JSON.stringify({
            nowSetting: currentSetting,
            saveList: saveSlots
        }));
    }

    function renderUI() {
        // Update theme info
        const themeInfo = document.getElementById('diepStyleThemeInfo');
        if (themeInfo) {
            if (currentSetting.theme) {
                if (currentSetting.theme.author) {
                    themeInfo.textContent = `${currentSetting.theme.name} by ${currentSetting.theme.author}`;
                } else {
                    themeInfo.textContent = currentSetting.theme.name;
                }
                themeInfo.style.display = 'block';
            } else {
                themeInfo.style.display = 'none';
            }
        }

        // Render colors
        const colorsContainer = document.getElementById('diepStyleColors');
        if (colorsContainer) {
            colorsContainer.innerHTML = '';
            currentSetting.colors.forEach(color => {
                const item = document.createElement('div');
                item.className = 'diep-style-color-item';
                item.innerHTML = `
                    <input type="color" 
                           class="diep-style-color-input" 
                           value="#${color.color}"
                           data-color-id="${color.id}"
                           ${currentSetting.lock ? 'disabled' : ''}>
                    <span class="diep-style-color-name">${color.name}</span>
                `;
                
                // Make entire item clickable to open color picker
                item.addEventListener('click', (e) => {
                    if (!currentSetting.lock) {
                        const colorInput = item.querySelector('.diep-style-color-input');
                        colorInput.click();
                    }
                });
                
                colorsContainer.appendChild(item);
            });
        }

        // Render settings
        const rendersContainer = document.getElementById('diepStyleRenderSettings');
        if (rendersContainer) {
            rendersContainer.innerHTML = '';
            currentSetting.renders.forEach(render => {
                const item = document.createElement('div');
                item.className = 'diep-style-render-item';
                
                if (typeof render.value === 'boolean') {
                    item.innerHTML = `
                        <label class="diep-style-render-label">${render.name}</label>
                        <input type="checkbox" 
                               class="diep-style-checkbox" 
                               data-render-cmd="${render.cmd}"
                               ${render.value ? 'checked' : ''}
                               ${currentSetting.lock ? 'disabled' : ''}>
                    `;
                } else {
                    item.innerHTML = `
                        <label class="diep-style-render-label">
                            ${render.name}
                            <span class="diep-style-render-value">${render.value.toFixed(2)}</span>
                        </label>
                        <input type="range" 
                               class="diep-style-slider" 
                               min="0" 
                               max="200" 
                               value="${render.value * 100}"
                               data-render-cmd="${render.cmd}"
                               ${currentSetting.lock ? 'disabled' : ''}>
                    `;
                }
                rendersContainer.appendChild(item);
            });
        }

        // Update slot buttons
        document.querySelectorAll('.diep-style-slot').forEach((btn, index) => {
            btn.classList.toggle('active', index === currentSetting.saveTH);
        });

        // Update lock button
        const lockBtn = document.getElementById('diepStyleLock');
        if (lockBtn) {
            lockBtn.textContent = currentSetting.lock ? 'Locked' : 'Unlocked';
            lockBtn.disabled = currentSetting.saveTH === 0;
        }

    }

    function setupEventListeners() {
        // Close button
        const closeBtn = document.getElementById('diepStyleClose');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                toggleMenu();
            });
        }

        // Theme buttons
        document.querySelectorAll('.diep-style-theme-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const theme = e.target.getAttribute('data-theme');
                if (theme) {
                    loadTheme(theme);
                }
            });
        });

        // Color inputs - use event delegation
        document.addEventListener('change', (e) => {
            if (e.target.classList && e.target.classList.contains('diep-style-color-input')) {
                const colorId = parseInt(e.target.getAttribute('data-color-id'));
                const newColor = e.target.value.slice(1);
                handleColorChange(colorId, newColor);
            }
        });

        // Render checkboxes - use event delegation
        document.addEventListener('change', (e) => {
            if (e.target.classList && e.target.classList.contains('diep-style-checkbox')) {
                const cmd = e.target.getAttribute('data-render-cmd');
                handleRenderChange(cmd, e.target.checked);
            }
        });

        // Render sliders - use event delegation
        document.addEventListener('input', (e) => {
            if (e.target.classList && e.target.classList.contains('diep-style-slider')) {
                const cmd = e.target.getAttribute('data-render-cmd');
                const value = parseInt(e.target.value) / 100;
                handleRenderChange(cmd, value);
                
                // Update display
                const label = e.target.parentElement.querySelector('.diep-style-render-value');
                if (label) label.textContent = value.toFixed(2);
            }
        });

        // Slot buttons
        document.querySelectorAll('.diep-style-slot').forEach((btn, index) => {
            btn.addEventListener('click', () => {
                loadSlot(index);
            });
        });

        // Action buttons
        const importBtn = document.getElementById('diepStyleImport');
        const exportBtn = document.getElementById('diepStyleExport');
        const lockBtn = document.getElementById('diepStyleLock');
        const resetBtn = document.getElementById('diepStyleReset');
        
        if (importBtn) importBtn.addEventListener('click', showImportModal);
        if (exportBtn) exportBtn.addEventListener('click', showExportModal);
        if (lockBtn) lockBtn.addEventListener('click', toggleLock);
        if (resetBtn) resetBtn.addEventListener('click', showResetModal);

        // Modal buttons
        setupModalListeners();
        
        console.log('Diep Style: Event listeners setup complete');
    }

    function setupModalListeners() {
        // Import modal
        const importModal = document.getElementById('diepStyleImportModal');
        const importCloseButtons = importModal?.querySelectorAll('.diep-style-modal-close');
        const importCancel = document.getElementById('diepStyleImportCancel');
        const importConfirm = document.getElementById('diepStyleImportConfirm');
        
        importCloseButtons?.forEach(btn => {
            btn.addEventListener('click', () => {
                importModal.classList.remove('active');
            });
        });
        importCancel?.addEventListener('click', () => {
            importModal.classList.remove('active');
        });
        importConfirm?.addEventListener('click', confirmImport);

        // Export modal
        const exportModal = document.getElementById('diepStyleExportModal');
        const exportCloseButtons = exportModal?.querySelectorAll('.diep-style-modal-close');
        const exportCancel = document.getElementById('diepStyleExportCancel');
        const exportConfirm = document.getElementById('diepStyleExportConfirm');
        
        exportCloseButtons?.forEach(btn => {
            btn.addEventListener('click', () => {
                exportModal.classList.remove('active');
            });
        });
        exportCancel?.addEventListener('click', () => {
            exportModal.classList.remove('active');
        });
        exportConfirm?.addEventListener('click', confirmExport);

        // Reset modal
        const resetModal = document.getElementById('diepStyleResetModal');
        const resetCloseButtons = resetModal?.querySelectorAll('.diep-style-modal-close');
        const resetCancel = document.getElementById('diepStyleResetCancel');
        const resetConfirm = document.getElementById('diepStyleResetConfirm');
        
        resetCloseButtons?.forEach(btn => {
            btn.addEventListener('click', () => {
                resetModal.classList.remove('active');
            });
        });
        resetCancel?.addEventListener('click', () => {
            resetModal.classList.remove('active');
        });
        resetConfirm?.addEventListener('click', confirmReset);
    }

    function toggleMenu() {
        isMenuOpen = !isMenuOpen;
        window.disableInputs = isMenuOpen;
        menuElement.style.display = isMenuOpen ? 'block' : 'none';
        
        console.log('Diep Style: Menu toggled', isMenuOpen ? 'OPEN' : 'CLOSED');
        
        if (isMenuOpen) {
            renderUI();
        }

    }

    function diep(command) {
        if (typeof input !== 'undefined' && typeof input.execute === 'function') {
            try {
                input.execute(command);
                console.log('Diep Style: Executed command:', command);
            } catch (error) {
                console.warn('Diep Style: Failed to execute command:', command, error);
            }
        } else {
            console.warn('Diep Style: input.execute not available');
        }
    }

    function executeGameCommand(color) {
        const { id, color: colorValue, cmd } = color;

        if (id >= 0 && id < 50) {
            diep(`net_replace_color ${id} 0x${colorValue}`);
        } else if (id >= 50 && id < 100 && cmd) {
            diep(`${cmd} 0x${colorValue}`);
        }
    }

    function executeRenderCommand(render) {
        let value = render.value;
        if (render.reverse) {
            value = !render.value;
        }
        diep(`ren_${render.cmd} ${value}`);
    }

    function executeUIColors(colors) {
        const uiColors = colors
            .filter(c => c.name && c.name.startsWith('UI Color'))
            .map(c => ` 0x${c.color}`)
            .join('');

        if (uiColors) {
            diep(`ui_replace_colors${uiColors}`);
        }
    }

    function applyAllCommands() {
        console.log('Diep Style: Applying all commands...');
        
        // Apply all colors
        currentSetting.colors.forEach(color => {
            executeGameCommand(color);
        });

        // Apply UI colors together
        executeUIColors(currentSetting.colors);

        // Apply all render settings
        currentSetting.renders.forEach(render => {
            executeRenderCommand(render);
        });
    }

    function handleColorChange(id, newColor) {
        const colorIndex = currentSetting.colors.findIndex(c => c.id === id);
        if (colorIndex >= 0) {
            currentSetting.colors[colorIndex].color = newColor;
            
            // Execute command immediately
            executeGameCommand(currentSetting.colors[colorIndex]);
            
            // If UI color, update all UI colors
            if (currentSetting.colors[colorIndex].cmd === 'ui_replace_colors') {
                executeUIColors(currentSetting.colors);
            }
            
            saveSettings();
        }
    }

    function handleRenderChange(cmd, value) {
        const renderIndex = currentSetting.renders.findIndex(r => r.cmd === cmd);
        if (renderIndex >= 0) {
            currentSetting.renders[renderIndex].value = value;
            
            // Execute command immediately
            executeRenderCommand(currentSetting.renders[renderIndex]);
            
            saveSettings();
        }
    }

    function loadTheme(themeName) {
        const themeData = JSON.parse(THEMES[themeName]);
        
        themeData.forEach(item => {
            if (item.theme) {
                currentSetting.theme = item.theme;
            } else if (item.id !== undefined) {
                const colorIndex = currentSetting.colors.findIndex(c => c.id === item.id);
                if (colorIndex >= 0) {
                    currentSetting.colors[colorIndex].color = item.value;
                }
            } else if (item.cmd) {
                if (item.cmd === 'ui_replace_colors' && Array.isArray(item.value)) {
                    item.value.forEach((color, i) => {
                        const uiColorIndex = currentSetting.colors.findIndex(c => c.name === `UI Color${i + 1}`);
                        if (uiColorIndex >= 0) {
                            currentSetting.colors[uiColorIndex].color = color;
                        }
                    });
                } else {
                    const renderIndex = currentSetting.renders.findIndex(r => r.cmd === item.cmd);
                    if (renderIndex >= 0) {
                        currentSetting.renders[renderIndex].value = item.value;
                    } else {
                        const colorIndex = currentSetting.colors.findIndex(c => c.cmd === item.cmd);
                        if (colorIndex >= 0) {
                            currentSetting.colors[colorIndex].color = item.value;
                        }
                    }
                }
            }
        });

        applyAllCommands();
        saveSettings();
        renderUI();
        showToast('Theme loaded successfully!');
    }

    function loadSlot(slotIndex) {
        saveSlots[currentSetting.saveTH] = { ...currentSetting };
        
        currentSetting = { ...saveSlots[slotIndex], saveTH: slotIndex };
        
        applyAllCommands();
        saveSettings();
        renderUI();
    }

    function toggleLock() {
        if (currentSetting.saveTH === 0) return;
        
        currentSetting.lock = !currentSetting.lock;
        saveSettings();
        renderUI();
    }

    function showImportModal() {
        const modal = document.getElementById('diepStyleImportModal');
        const textArea = document.getElementById('diepStyleImportText');
        if (textArea) textArea.value = '';
        textArea.focus();
        if (modal) modal.classList.add('active');
    }

    function confirmImport() {
        const json = document.getElementById('diepStyleImportText')?.value.trim();
        
        if (!json) {
            showToast('Please enter JSON configuration', 'error');
            return;
        }

        try {
            const data = JSON.parse(json);
            
            data.forEach(item => {
                if (item.theme) {
                    currentSetting.theme = item.theme;
                } else if (item.id !== undefined) {
                    const idx = currentSetting.colors.findIndex(c => c.id === item.id);
                    if (idx >= 0) currentSetting.colors[idx].color = item.value;
                } else if (item.cmd) {
                    if (item.cmd === 'ui_replace_colors' && Array.isArray(item.value)) {
                        item.value.forEach((color, i) => {
                            const idx = currentSetting.colors.findIndex(c => c.name === `UI Color${i + 1}`);
                            if (idx >= 0) currentSetting.colors[idx].color = color;
                        });
                    } else {
                        const renderIdx = currentSetting.renders.findIndex(r => r.cmd === item.cmd);
                        if (renderIdx >= 0) {
                            currentSetting.renders[renderIdx].value = item.value;
                        } else {
                            const colorIdx = currentSetting.colors.findIndex(c => c.cmd === item.cmd);
                            if (colorIdx >= 0) currentSetting.colors[colorIdx].color = item.value;
                        }
                    }
                }
            });

            applyAllCommands();
            saveSettings();
            renderUI();
            
            const modal = document.getElementById('diepStyleImportModal');
            if (modal) modal.classList.remove('active');
            showToast('Theme imported successfully!');
        } catch (e) {
            showToast('Invalid JSON format', 'error');
        }
    }

    function showExportModal() {
        const modal = document.getElementById('diepStyleExportModal');
        const nameInput = document.getElementById('diepStyleExportName');
        const authorInput = document.getElementById('diepStyleExportAuthor');
        
        if (nameInput) nameInput.value = currentSetting.theme?.name || '';
        if (authorInput) authorInput.value = currentSetting.theme?.author || '';
        if (modal) modal.classList.add('active');
    }

    function confirmExport() {
        const themeName = document.getElementById('diepStyleExportName')?.value.trim() || 'My Custom Theme';
        const author = document.getElementById('diepStyleExportAuthor')?.value.trim() || 'Anonymous';
        
        const customTheme = { name: themeName, author: author };
        const json = exportJSON(customTheme);
        
        // Copy to clipboard
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(json).then(() => {
                const modal = document.getElementById('diepStyleExportModal');
                if (modal) modal.classList.remove('active');
                showToast('Theme exported to clipboard!');
            }).catch(() => {
                fallbackCopy(json);
            });
        } else {
            fallbackCopy(json);
        }
    }

    function exportJSON(customTheme) {
        const toExport = [];

        if (customTheme) {
            toExport.push({ theme: customTheme });
        }

        currentSetting.colors.forEach(color => {
            if (color.id < 50) {
                toExport.push({ id: color.id, value: color.color });
            } else if (color.cmd && color.cmd !== 'ui_replace_colors') {
                toExport.push({ cmd: color.cmd, value: color.color });
            }
        });

        const uiColors = currentSetting.colors
            .filter(c => c.name && c.name.startsWith('UI Color'))
            .map(c => c.color);
        if (uiColors.length) {
            toExport.push({ cmd: 'ui_replace_colors', value: uiColors });
        }

        currentSetting.renders.forEach(render => {
            toExport.push({ cmd: render.cmd, value: render.value });
        });

        return JSON.stringify(toExport);
    }

    function fallbackCopy(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        
        const modal = document.getElementById('diepStyleExportModal');
        if (modal) modal.classList.remove('active');
        showToast('Theme exported to clipboard!');
    }

    function showResetModal() {
        const modal = document.getElementById('diepStyleResetModal');
        if (modal) modal.classList.add('active');
    }

    function confirmReset() {
        currentSetting = {
            version: 0.097,
            saveTH: currentSetting.saveTH,
            lock: false,
            colors: JSON.parse(JSON.stringify(DEFAULT_COLORS)),
            renders: JSON.parse(JSON.stringify(DEFAULT_RENDERS))
        };
        
        applyAllCommands();
        saveSettings();
        renderUI();
        
        const modal = document.getElementById('diepStyleResetModal');
        if (modal) modal.classList.remove('active');
        showToast('Settings reset to defaults');
    }

    function showToast(message, type = 'success') {
        const toast = document.getElementById('diepStyleToast');
        if (!toast) return;
        
        toast.textContent = message;
        toast.className = 'diep-style-toast';
        if (type === 'error') {
            toast.classList.add('error');
        }
        toast.style.display = 'block';
        
        setTimeout(() => {
            toast.style.display = 'none';
        }, 5000);
    }

    // Expose toggle function globally
    window.toggleDiepStyle = toggleMenu;
    
    console.log('Diep Style: Initialization complete!');
}