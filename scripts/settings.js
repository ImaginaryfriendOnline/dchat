import {
    MODULE_ID,
    SETTINGS,
    SETTINGS_CLASSES,
    SETTING_GROUPS
} from "./constants.js";
import { getDocument, getElement } from "./utils.js";

const SETTINGS_GROUP_PREFIX = "daavy-chat.Settings.Groups";

export function groupSettings(renderedHtml) {
    const container = getElement(renderedHtml);
    if (!container) return;

    const documentRef = getDocument(container);
    for (const [groupKey, settingKeys] of Object.entries(SETTING_GROUPS)) {
        const rows = settingKeys.map(key => {
            const settingId = `${MODULE_ID}.${key}`;
            return container.querySelector(`[data-setting-id="${settingId}"]`)?.closest(".form-group")
                ?? container.querySelector(`[id$="${settingId}"]`)?.closest(".form-group");
        }).filter(row => row && !row.closest(`.${SETTINGS_CLASSES.GROUP}`));
        if (!rows.length) continue;

        const group = documentRef.createElement("div");
        const title = documentRef.createElement("h3");
        group.className = SETTINGS_CLASSES.GROUP;
        group.setAttribute("role", "group");
        title.id = `${MODULE_ID}-settings-group-${groupKey}`;
        group.setAttribute("aria-labelledby", title.id);
        title.textContent = game.i18n.localize(`${SETTINGS_GROUP_PREFIX}.${groupKey}`);
        title.className = "daavy-chat-settings-group-title";
        group.appendChild(title);
        rows[0].replaceWith(group);

        for (const row of rows) {
            row.classList.add("daavy-chat-settings-row");
            group.appendChild(row);
        }
    }
}

export function registerModuleSettings(onChangeHandlers = {}) {
    for (const { key, ...options } of Object.values(SETTINGS)) {
        game.settings.register(MODULE_ID, key, {
            scope: "client",
            config: true,
            default: options.default ?? false,
            type: Boolean,
            ...options,
            onChange: onChangeHandlers[key] ?? options.onChange
        });
    }
}

export function isSettingEnabled(key) {
    return game.settings.get(MODULE_ID, key);
}
