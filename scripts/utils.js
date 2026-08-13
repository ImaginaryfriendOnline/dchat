import { CHAT_TAB_CONFIG, MESSAGE_TYPES, MODULE_ID, SETTINGS } from "./constants.js";

export function i18nKey(key) {
    return `daavy-chat.${key}`;
}

export function isGameChatSplit() {
    return game.settings?.get(MODULE_ID, SETTINGS.SPLIT_GAME_CHAT.key) ?? true;
}

export function getActiveChatTabs() {
    return isGameChatSplit()
        ? CHAT_TAB_CONFIG
        : CHAT_TAB_CONFIG.filter(tab => tab.id !== MESSAGE_TYPES.GAME);
}

export function hasSystemFlags(message = {}) {
    const systemFlags = message.flags?.[game.system?.id];
    return !!systemFlags && Object.keys(systemFlags).length > 0;
}

export function isAutomatedMessage(message = {}) {
    return !!(message.isRoll
        || message.rolls?.length > 0
        || message.blind
        || hasSystemFlags(message));
}

export function classifyMessage(message = {}) {
    const flags = message.flags?.pf2e ?? {};

    const isSystem = !!(flags.context || flags.origin || flags.item);
    const isDiceRoll = message.isRoll || (message.rolls?.length > 0);
    const isPf2eDamage = !!(flags.appliedDamage || flags.damageRoll?.outcomes);
    const isDamageReaction = /damage-(taken|received)/.test(message.flavor || "") ||
        flags.context?.type === "damage-taken";

    if (isSystem || isDiceRoll || isPf2eDamage || isDamageReaction) {
        return isGameChatSplit() ? MESSAGE_TYPES.GAME : MESSAGE_TYPES.CHAT;
    }

    if (message.whisper?.length > 0 || message.blind) {
        return MESSAGE_TYPES.WHISPER;
    }

    return MESSAGE_TYPES.CHAT;
}

export function isPinnedMessage(message = {}) {
    return message.getFlag?.(MODULE_ID, "pinned") === true || message.flags?.[MODULE_ID]?.pinned === true;
}

function isElement(candidateElement) {
    return !!candidateElement
        && typeof candidateElement === "object"
        && candidateElement.nodeType === 1
        && typeof candidateElement.querySelector === "function";
}

export function getElement(renderedHtml) {
    return isElement(renderedHtml) ? renderedHtml : null;
}

export function getDocument(element = null) {
    return element?.ownerDocument ?? globalThis.document;
}

export function isCurrentUserAuthor(message) {
    return message?.author?.id === game.user?.id;
}

export function isIncomingWhisper(message, userId = game.user?.id) {
    return message?.whisper?.length > 0
        && message.author?.id !== userId
        && message.whisper.includes(userId);
}
