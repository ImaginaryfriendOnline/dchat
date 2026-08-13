import {
    AUTOCOMPLETE_WHISPER,
    CHAT_CLASSES,
    CHAT_DATA,
    CHAT_SELECTORS,
    CHAT_TAB_CONFIG,
    CHAT_MENTION_BORDER_COLOR,
    CHAT_MENTION_HIGHLIGHT_DURATION,
    CHAT_MENTION_PIP_COLOR,
    CHAT_PIP_COLOR,
    MESSAGE_TYPES,
    MODULE_ID,
    PIN_TEMPLATE_PATH,
    PROSE_MIRROR_SELECTOR,
    SETTINGS
} from "./constants.js";
import { isSettingEnabled } from "./settings.js";
import {
    classifyMessage,
    getActiveChatTabs,
    getDocument,
    getElement,
    i18nKey,
    isAutomatedMessage,
    isIncomingWhisper,
    isCurrentUserAuthor,
    isPinnedMessage
} from "./utils.js";
import { HideDamageButtons, TraitFilter } from "./features/pf2e.js";
import "./hooks.js";

const HIDE_CHAT_FORMATTING_CLASS = "daavy-chat-hide-chat-formatting";
const SHOW_FORMULA_CLASS = "daavy-chat-show";
const ROLL_SELECTOR = ".dice-roll";
const ROLL_TITLE_SELECTOR = ".dice-roll h4";
const FORMULA_SELECTOR = ".dice-formula";

export class HideChatInitiative {
    static preCreateChatMessage(message, creationData) {
        if (!isSettingEnabled(SETTINGS.HIDE_CHAT_INITIATIVE.key)) return;

        const messageData = creationData ? foundry.utils.expandObject(creationData) : message.toObject();
        if (foundry.utils.getProperty(messageData, "flags.core.initiativeRoll") !== true) return;

        return false;
    }
}

export class HidePrivateMessages {
    static onReady() {
        const ChatLogClass = globalThis.foundry?.applications?.sidebar?.tabs?.ChatLog;
        const originalNotify = ChatLogClass?.prototype?.notify;
        if (typeof originalNotify !== "function") return;

        ChatLogClass.prototype.notify = function (message, options) {
            if (message?.whisper?.length && !isIncomingWhisper(message)) return;
            if (isSettingEnabled(SETTINGS.HIDE_PRIVATE_MESSAGES.key) && HidePrivateMessages.shouldHideMessage(message)) return;
            return originalNotify.call(this, message, options);
        };

    }

    static shouldHideMessage(message) {
        if (!message) return false;

        const isRoll = Boolean(message.isRoll || message.rolls?.length);
        const isPrivate = Boolean(message.blind || message.whisper?.length);
        const isPrivateRoll = isRoll && isPrivate;
        return isPrivateRoll && !isCurrentUserAuthor(message) && message.isContentVisible === false;
    }

    static processMessage(message, messageElement) {
        if (!this.shouldHideMessage(message)) return;

        messageElement.hidden = true;
        messageElement.setAttribute("aria-hidden", "true");
    }
}

export class HideChatFormatting {
    static _observers = new WeakMap();

    static observe(renderedHtml) {
        const container = getElement(renderedHtml);
        if (!container) return;

        this.refresh(container);
        if (this._observers.has(container)) return;

        const observer = new MutationObserver(() => this.refresh(container));
        observer.observe(container, { childList: true, subtree: true });
        this._observers.set(container, observer);
    }

    static refresh(...renderedRoots) {
        const shouldHideFormatting = isSettingEnabled(SETTINGS.HIDE_CHAT_FORMATTING.key);

        renderedRoots
            .flatMap(getRenderedElements)
            .flatMap(findChatEditors)
            .forEach(editor => editor.classList.toggle(HIDE_CHAT_FORMATTING_CLASS, shouldHideFormatting));
    }
}

function getRenderedElements(renderedRoot) {
    const rootElement = getElement(renderedRoot);
    if (rootElement) return [rootElement];
    return Object.values(renderedRoot ?? {}).map(getElement).filter(Boolean);
}

function findChatEditors(rootElement) {
    const editors = Array.from(rootElement.querySelectorAll(PROSE_MIRROR_SELECTOR));
    if (rootElement.matches?.(PROSE_MIRROR_SELECTOR)) editors.unshift(rootElement);
    return editors;
}

export class AutocompleteWhisper {
    static _trackedHosts = new Set();
    static _states = new WeakMap();
    static _boundFocusDocuments = new WeakSet();

    static init() {
        this._bindFocusListener(globalThis.document);
        requestAnimationFrame(() => this.refresh());
    }

    static _bindFocusListener(documentRef) {
        if (!documentRef || this._boundFocusDocuments.has(documentRef)) return;

        this._boundFocusDocuments.add(documentRef);
        documentRef.addEventListener("focusin", (event) => {
            const target = event.target;
            const editor = target?.matches?.(AUTOCOMPLETE_WHISPER.EDITOR_SELECTOR)
                ? target
                : target?.closest?.(AUTOCOMPLETE_WHISPER.EDITOR_SELECTOR);
            if (!editor) return;

            this._attach(editor);
        }, true);
    }

    static refresh(element = null, elements = null) {
        for (const host of this._trackedHosts) {
            if (host?.isConnected) continue;
            this._teardown(host);
            this._trackedHosts.delete(host);
        }

        for (const candidate of Object.values(elements ?? {})) this._attach(candidate);

        const rootElement = getElement(element);
        if (rootElement) this._attach(rootElement);

        const currentHost = globalThis.document?.querySelector?.(AUTOCOMPLETE_WHISPER.HOST_SELECTOR);
        if (currentHost) this._attach(currentHost);

        for (const host of this._trackedHosts) this._attach(host);
    }

    static _attach(rootElement) {
        const host = resolveHost(rootElement, AUTOCOMPLETE_WHISPER.HOST_SELECTOR);
        if (!host) return false;

        this._trackedHosts.add(host);
        this._bindFocusListener(getDocument(host));

        const editor = host.querySelector("prose-mirror[name='message'], prose-mirror")
            ?? host.querySelector(AUTOCOMPLETE_WHISPER.EDITABLE_SELECTOR);
        const editable = editor?.matches?.("[contenteditable='true']")
            ? editor
            : editor?.querySelector?.(AUTOCOMPLETE_WHISPER.EDITABLE_SELECTOR) ?? null;
        if (!editor || !editable) {
            this._teardown(host);
            return false;
        }

        if (this._states.has(host)) {
            const state = this._states.get(host);
            if (state.editor?.isConnected
                && state.editable?.isConnected
                && state.editor === editor
                && state.editable === editable) {
                this._updateSuggestions(host);
                return true;
            }

            this._teardown(host);
        }

        const AbortControllerCtor = host.ownerDocument?.defaultView?.AbortController ?? globalThis.AbortController;
        const state = {
            controller: new AbortControllerCtor(),
            host,
            editor,
            editable,
            popup: createPopup(host),
            suggestions: [],
            activeIndex: 0,
            match: null
        };
        this._states.set(host, state);
        host.classList.add(AUTOCOMPLETE_WHISPER.HOST_CLASS);
        prepareEditable(editable, state.popup.id);
        const refresh = () => this._updateSuggestions(state.host);
        this._bindEditableEvents(state, refresh);
        this._bindEditorEvents(state, refresh);
        this._bindPopupEvents(state);

        this._updateSuggestions(host);
        return true;
    }

    static _bindEditableEvents(state, refresh) {
        const { editable, host, controller } = state;
        const signal = controller.signal;

        editable.addEventListener("input", refresh, { signal });
        editable.addEventListener("click", refresh, { signal });
        editable.addEventListener("focus", refresh, { signal });
        editable.addEventListener("keydown", (event) => this._onKeydown(host, event), { signal, capture: true });
        editable.addEventListener("keyup", (event) => {
            if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) refresh();
        }, { signal });
        editable.addEventListener("blur", () => {
            requestAnimationFrame(() => hidePopup(state));
        }, { signal });
    }

    static _bindEditorEvents(state, refresh) {
        const { editor, editable, controller } = state;
        if (editor === editable) return;

        editor.addEventListener("input", refresh, { signal: controller.signal });
        editor.addEventListener("change", refresh, { signal: controller.signal });
    }

    static _bindPopupEvents(state) {
        const { popup, host, controller } = state;
        const signal = controller.signal;

        popup.addEventListener("mousedown", (event) => {
            event.preventDefault();
        }, { signal });
        popup.addEventListener("click", (event) => {
            const option = event.target.closest("[data-daavy-chat-whisper-index]");
            if (!option) return;
            const index = Number(option.dataset[AUTOCOMPLETE_WHISPER.INDEX_DATA]);
            this._applySuggestion(host, index, { persist: event.shiftKey });
        }, { signal });
    }

    static _teardown(host) {
        const state = this._states.get(host);
        if (state) {
            state.controller.abort();
            ["aria-activedescendant", "aria-autocomplete", "aria-haspopup", "aria-controls", "aria-expanded"]
                .forEach(attribute => state.editable.removeAttribute(attribute));
            state.popup?.remove();
            this._states.delete(host);
        }

        host?.classList?.remove(AUTOCOMPLETE_WHISPER.HOST_CLASS);
    }

    static _updateSuggestions(host) {
        const state = this._states.get(host);
        if (!state) return;

        state.match = getMatchState(state.editable);
        if (!state.match) {
            hidePopup(state);
            return;
        }

        state.suggestions = getSuggestions(state.match, game.users.contents, 6);
        state.activeIndex = Math.min(state.activeIndex, Math.max(state.suggestions.length - 1, 0));

        if (!state.suggestions.length) {
            hidePopup(state);
            return;
        }

        renderPopup(state);
    }

    static _onKeydown(host, event) {
        const state = this._states.get(host);
        if (!state || state.popup.hidden || !state.suggestions.length) return;
        if (event.key === "Enter" && !event.shiftKey && state.match?.caretAfterTarget) {
            hidePopup(state);
            return;
        }

        switch (event.key) {
            case "ArrowDown":
                event.preventDefault();
                state.activeIndex = (state.activeIndex + 1) % state.suggestions.length;
                renderPopup(state);
                break;
            case "ArrowUp":
                event.preventDefault();
                state.activeIndex = (state.activeIndex - 1 + state.suggestions.length) % state.suggestions.length;
                renderPopup(state);
                break;
            case "Enter":
            case "Tab":
                event.preventDefault();
                event.stopImmediatePropagation();
                this._applySuggestion(host, state.activeIndex, { persist: event.shiftKey });
                break;
            case "Escape":
                event.preventDefault();
                hidePopup(state);
                break;
        }
    }

    static _applySuggestion(host, index, { persist = false } = {}) {
        const state = this._states.get(host);
        if (!state) return;

        const suggestion = state.suggestions[index];
        const match = state.match ?? getMatchState(state.editable);
        if (!suggestion || !match) return;

        const editorText = getEditorText(state.editable);
        const textAfterMatch = editorText.slice(match.targetEnd);
        const selectedNames = match.mode === "whisper"
            ? match.selectedNames.filter(name => name.toLocaleLowerCase() !== suggestion.name.toLocaleLowerCase())
            : [];
        const recipients = [...selectedNames, suggestion.name];
        const replacement = match.mode === "mention"
            ? `@${suggestion.name}`
            : `[${recipients.join(", ")}]`;
        const trailingSpace = /^\s/.test(textAfterMatch) ? "" : " ";
        replaceEditorRange(
            state,
            match.targetStart,
            match.targetEnd,
            `${replacement}${trailingSpace}`,
            replacement.length + 1,
        );
        persist ? this._updateSuggestions(host) : hidePopup(state);
    }
}

function replaceEditorRange(state, startOffset, endOffset, replacement, caretOffset = replacement.length) {
    const editable = state.editable;
    const documentRef = getDocument(editable);
    const selection = documentRef.getSelection?.();
    const range = createTextRange(editable, startOffset, endOffset);
    if (!selection || !range) return;

    editable.focus();
    selection.removeAllRanges();
    selection.addRange(range);

    if (!insertText(documentRef, editable, range, replacement)) {
        dispatchInput(editable, replacement);
    }

    restoreCaret(editable, selection, startOffset, caretOffset);
}

function createTextRange(rootElement, start, end) {
    const documentRef = getDocument(rootElement);
    const range = documentRef.createRange();
    const startPoint = locateTextBoundary(rootElement, start);
    const endPoint = locateTextBoundary(rootElement, end);
    if (!startPoint || !endPoint) return null;

    range.setStart(startPoint.node, startPoint.offset);
    range.setEnd(endPoint.node, endPoint.offset);
    return range;
}

function insertText(documentRef, editable, range, replacement) {
    if (typeof documentRef.execCommand === "function" && documentRef.execCommand("insertText", false, replacement)) {
        return true;
    }

    range.deleteContents();
    range.insertNode(documentRef.createTextNode(replacement));
    return false;
}

function dispatchInput(editable, replacement) {
    const documentWindow = editable.ownerDocument?.defaultView;
    const InputEventCtor = documentWindow?.InputEvent ?? documentWindow?.Event ?? Event;
    editable.dispatchEvent(new InputEventCtor("input", { bubbles: true, data: replacement, inputType: "insertText" }));
}

function restoreCaret(editable, selection, startOffset, caretOffset) {
    const caretPosition = Math.max(startOffset, startOffset + caretOffset);
    const caretRange = createTextRange(editable, caretPosition, caretPosition);
    if (!caretRange) return;

    selection.removeAllRanges();
    selection.addRange(caretRange);
}

function locateTextBoundary(rootElement, targetOffset) {
    const documentRef = getDocument(rootElement);
    const view = documentRef.defaultView ?? globalThis;
    const nodeFilter = view.NodeFilter ?? NodeFilter;
    const walker = documentRef.createTreeWalker(rootElement, nodeFilter.SHOW_TEXT);
    let currentTextNode = walker.nextNode();
    let traversed = 0;
    let lastText = null;

    while (currentTextNode) {
        const length = currentTextNode.textContent?.length ?? 0;
        if (targetOffset <= traversed + length) {
            return {
                node: currentTextNode,
                offset: Math.max(0, targetOffset - traversed)
            };
        }

        traversed += length;
        lastText = currentTextNode;
        currentTextNode = walker.nextNode();
    }

    return lastText
        ? { node: lastText, offset: lastText.textContent?.length ?? 0 }
        : { node: rootElement, offset: 0 };
}

function getEditorText(editable) {
    return (editable?.textContent ?? "")
        .replace(/\u00a0/g, " ")
        .replace(/\u200b/g, "");
}

function getCaretOffset(editable) {
    const documentRef = getDocument(editable);
    const selection = documentRef.getSelection?.();
    if (!selection?.rangeCount) return null;

    const range = selection.getRangeAt(0);
    if (!editable.contains(range.startContainer) || !editable.contains(range.endContainer)) return null;

    return getRangeOffset(editable, range.startContainer, range.startOffset);
}

function getMatchState(editable) {
    const editorText = getEditorText(editable);
    const caret = getCaretOffset(editable) ?? editorText.length;
    const prefix = editorText.match(/^(\/w|\/whisper)\s+/i);
    if (prefix) {
        const targetStart = prefix[0].length;
        if (caret < targetStart) return null;

        const remainder = editorText.slice(targetStart);
        const match = remainder.startsWith("[")
            ? getBracketedMatch(editorText, targetStart, remainder, caret)
            : getPlainMatch(editorText, targetStart, remainder, caret);
        return match ? { mode: "whisper", ...match } : null;
    }

    return getMentionMatch(editorText, caret);
}

function getRangeOffset(editable, container, offset) {
    const range = editable.ownerDocument.createRange();
    range.selectNodeContents(editable);
    range.setEnd(container, offset);
    return range.toString().length;
}

function getPlainMatch(editorText, targetStart, remainder, caret) {
    const firstSpace = remainder.indexOf(" ");
    const targetEnd = firstSpace === -1 ? editorText.length : targetStart + firstSpace;
    if (caret > targetEnd) return null;

    return {
        query: editorText.slice(targetStart, Math.min(caret, targetEnd)).trim(),
        targetStart,
        targetEnd,
        selectedNames: []
    };
}

function getBracketedMatch(editorText, targetStart, remainder, caret) {
    const closeIndex = remainder.indexOf("]");
    const targetEnd = closeIndex === -1 ? editorText.length : targetStart + closeIndex + 1;

    const innerStart = targetStart + 1;
    const innerEnd = closeIndex === -1 ? targetEnd : targetEnd - 1;
    const inside = editorText.slice(innerStart, innerEnd);
    const segments = inside.split(",");
    if (caret > targetEnd) {
        if (editorText.slice(targetEnd, caret).trim() || editorText.slice(caret).trim()) return null;

        return {
            query: "",
            targetStart,
            targetEnd,
            selectedNames: segments.map(segment => segment.trim()).filter(Boolean),
            caretAfterTarget: true
        };
    }

    const caretInside = Math.max(0, Math.min(caret - innerStart, inside.length));
    const currentIndex = inside.slice(0, caretInside).split(",").length - 1;
    const currentSegment = segments[currentIndex];

    return {
        query: currentSegment.trim(),
        targetStart,
        targetEnd,
        selectedNames: segments
            .filter((_segment, index) => index !== currentIndex)
            .map(segment => segment.trim())
            .filter(Boolean)
    };
}

function getMentionMatch(editorText, caret) {
    const beforeCaret = editorText.slice(0, caret);
    let triggerIndex = beforeCaret.lastIndexOf("@");

    while (triggerIndex >= 0) {
        if (isMentionTrigger(editorText, triggerIndex)) {
            const queryStart = triggerIndex + 1;
            const query = editorText.slice(queryStart, caret);
            const targetEnd = queryStart + (editorText.slice(queryStart).match(/^\S*/)?.[0].length ?? 0);
            if (caret > targetEnd || /\s/.test(query)) return null;

            return {
                mode: "mention",
                query,
                targetStart: triggerIndex,
                targetEnd,
                selectedNames: []
            };
        }

        triggerIndex = beforeCaret.lastIndexOf("@", triggerIndex - 1);
    }

    return null;
}

function isMentionTrigger(text, index) {
    const preceding = text[index - 1];
    return !preceding || !/[\p{L}\p{N}_]/u.test(preceding);
}

function resolveHost(rootElement, hostSelector) {
    if (!rootElement) return null;
    if (typeof rootElement.matches === "function" && rootElement.matches(hostSelector)) return rootElement;

    const closestHost = rootElement.closest?.(hostSelector);
    return closestHost ?? rootElement.querySelector?.(hostSelector) ?? null;
}

function createPopup(host) {
    const existing = host.querySelector(`.${AUTOCOMPLETE_WHISPER.POPUP_CLASS}`);
    if (existing) return existing;

    const documentRef = getDocument(host);
    const popup = documentRef.createElement("div");
    popup.className = AUTOCOMPLETE_WHISPER.POPUP_CLASS;
    popup.id = `daavy-chat-whisper-${foundry.utils.randomID()}`;
    popup.hidden = true;
    popup.setAttribute("role", "listbox");
    host.appendChild(popup);
    return popup;
}

function prepareEditable(editable, popupId) {
    editable.setAttribute("aria-autocomplete", "list");
    editable.setAttribute("aria-haspopup", "listbox");
    editable.setAttribute("aria-controls", popupId);
    editable.setAttribute("aria-expanded", "false");
}

function renderPopup(state) {
    const documentRef = getDocument(state.popup);
    const options = state.suggestions.map((suggestion, index) => createSuggestionOption(documentRef, state, suggestion, index));
    state.popup.replaceChildren(...options);
    state.popup.hidden = false;
    updateActiveDescendant(state);
}

function hidePopup(state) {
    state.popup.hidden = true;
    state.popup.replaceChildren();
    state.editable.setAttribute("aria-expanded", "false");
    state.editable.removeAttribute("aria-activedescendant");
    state.suggestions = [];
    state.activeIndex = 0;
    state.match = null;
}

function createSuggestionOption(documentRef, state, suggestion, index) {
    const isActive = index === state.activeIndex;
    const option = documentRef.createElement("div");
    option.className = `${AUTOCOMPLETE_WHISPER.OPTION_CLASS}${isActive ? ` ${AUTOCOMPLETE_WHISPER.ACTIVE_OPTION_CLASS}` : ""}`;
    option.id = `${state.popup.id}-option-${index}`;
    option.dataset[AUTOCOMPLETE_WHISPER.INDEX_DATA] = String(index);
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", String(isActive));

    const status = documentRef.createElement("span");
    status.className = `daavy-chat-whisper-status${suggestion.active ? " is-active" : ""}`;

    const name = documentRef.createElement("span");
    name.className = "daavy-chat-whisper-name";
    name.textContent = suggestion.name;

    option.append(status, name);
    return option;
}

function updateActiveDescendant(state) {
    const activeOption = state.popup.querySelector(`.${AUTOCOMPLETE_WHISPER.OPTION_CLASS}.${AUTOCOMPLETE_WHISPER.ACTIVE_OPTION_CLASS}`);
    state.editable.setAttribute("aria-expanded", "true");

    if (activeOption?.id) {
        state.editable.setAttribute("aria-activedescendant", activeOption.id);
    } else {
        state.editable.removeAttribute("aria-activedescendant");
    }

    activeOption?.scrollIntoView?.({ block: "nearest" });
}

function getSuggestions(match, users, maxResults) {
    const normalize = name => (name ?? "").trim().toLocaleLowerCase();
    const normalizedQuery = normalize(match.query);
    const selectedNames = new Set(match.selectedNames.map(normalize));
    const seen = new Set();

    return users
        .filter(user => {
            const name = user?.name?.trim() ?? "";
            const normalizedName = normalize(name);
            if (!name || seen.has(normalizedName) || selectedNames.has(normalizedName)) return false;

            seen.add(normalizedName);
            return !normalizedQuery || normalizedName.includes(normalizedQuery);
        })
        .sort((firstUser, secondUser) => {
            if (firstUser.active !== secondUser.active) return firstUser.active ? -1 : 1;
            return firstUser.name.trim().localeCompare(secondUser.name.trim(), game.i18n.lang, { sensitivity: "base" });
        })
        .slice(0, maxResults)
        .map(user => ({
            name: user.name.trim(),
            active: !!user.active
        }));
}

class CollapsibleFormula {
    static processMessage(_message, messageElement) {
        messageElement.querySelectorAll(ROLL_SELECTOR).forEach(roll => {
            const title = roll.querySelector(ROLL_TITLE_SELECTOR);
            const formula = roll.querySelector(FORMULA_SELECTOR);
            if (title && formula) {
                title.addEventListener("click", (event) => {
                    event.stopPropagation();
                    formula.classList.toggle(SHOW_FORMULA_CLASS);
                });
            }
        });
    }
}

export class ChatPins {
    static pendingRequest = null;

    static onReady() {
        if (!game.socket?.on) return;
        game.socket.on(`module.${MODULE_ID}`, payload => this._handleSocket(payload));
    }

    static processMessage(message, renderedHtml) {
        const element = getElement(renderedHtml);
        if (!element) return;

        const messageType = classifyMessage(message);
        const pinned = isPinnedMessage(message);
        const mode = this._getPinMode(message, messageType, pinned);
        this._setPinnedState(element, pinned, mode);
        if (!mode) return;
        this._injectToggle(message, element, pinned, mode);
    }

    static preDeleteMessage(message) {
        if (!isPinnedMessage(message)) return;

        globalThis.ui?.notifications?.warn?.(game.i18n.localize(i18nKey("Pin.DeletePinned")));
        return false;
    }

    static async unpinMessages(messages = []) {
        for (const message of messages) {
            if (!isPinnedMessage(message)) continue;
            await this._setPinnedFlag(message, false);
        }
    }

    static getPinnedMessages() {
        return (game.messages.contents ?? []).filter(isPinnedMessage);
    }

    static createManagerButton(documentRef) {
        const button = documentRef.createElement("button");
        button.type = "button";
        button.className = "ui-control icon fas fa-thumbtack daavy-chat-pin-manager";

        const tooltip = game.i18n.localize(i18nKey("Pin.Manager"));
        button.dataset.tooltip = tooltip;
        button.title = tooltip;
        button.setAttribute("aria-label", tooltip);

        button.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.showManager();
        });

        return button;
    }

    static injectManagerButton(toolbar, documentRef) {
        const buttons = Array.from(toolbar.querySelectorAll(CHAT_SELECTORS.PIN_MANAGER));
        const managerButton = buttons.shift() ?? this.createManagerButton(documentRef);
        buttons.forEach(button => button.remove());

        if (!toolbar.contains(managerButton)) toolbar.appendChild(managerButton);
    }

    static removeManagerButtons(toolbar) {
        toolbar.querySelectorAll(CHAT_SELECTORS.PIN_MANAGER).forEach(button => button.remove());
    }

    static async showManager(activeTab = null) {
        const dialog = new foundry.applications.api.DialogV2({
            window: { title: game.i18n.localize(i18nKey("Pin.Manager")) },
            content: await this._renderManagerContent(activeTab),
            buttons: [{ action: "close", label: "Close" }]
        });

        dialog.addEventListener?.("render", event => this._bindManagerContent(event.target), { once: true });
        dialog.render({ force: true });
    }

    static async _renderManagerContent(activeTab = null) {
        const pinnedMessages = this.getPinnedMessages();
        const selectedTab = this._getManagerActiveTab(pinnedMessages, activeTab);
        const activeMessages = pinnedMessages.filter(message => classifyMessage(message) === selectedTab);

        return renderTemplate(PIN_TEMPLATE_PATH, {
            pinManager: true,
            activeTab: selectedTab,
            managerLabel: game.i18n.localize(i18nKey("Pin.Manager")),
            unpinAllLabel: game.i18n.localize(i18nKey("Pin.ManagerUnpinAll")),
            unpinLabel: game.i18n.localize(i18nKey("Pin.Unpin")),
            emptyLabel: game.i18n.localize(i18nKey("Pin.ManagerEmpty")),
            tabs: getActiveChatTabs().map(tab => ({
                id: tab.id,
                icon: tab.icon,
                label: game.i18n.localize(tab.label),
                active: tab.id === selectedTab,
                count: pinnedMessages.filter(message => classifyMessage(message) === tab.id).length
            })),
            messages: activeMessages.map(message => ({
                id: message.id,
                author: this._getMessageAuthor(message) || message.id,
                time: this._getMessageTime(message),
                preview: this._getTextPreview(message.content)
            }))
        });
    }

    static _getManagerActiveTab(pinnedMessages, activeTab = null) {
        const activeTabs = getActiveChatTabs();
        if (activeTabs.some(tab => tab.id === activeTab)) return activeTab;
        if (pinnedMessages.some(message => classifyMessage(message) === MESSAGE_TYPES.CHAT)) return MESSAGE_TYPES.CHAT;
        return activeTabs.find(tab => pinnedMessages.some(message => classifyMessage(message) === tab.id))?.id ?? MESSAGE_TYPES.CHAT;
    }

    static _refreshContainer(container) {
        const messageList = container.querySelector(CHAT_SELECTORS.MESSAGE_LIST);
        if (!messageList) return;

        const messageElements = Array.from(messageList.querySelectorAll(CHAT_SELECTORS.MESSAGE_ID));
        const pinnedElements = messageElements.filter(messageElement => {
            const message = game.messages.get(messageElement.dataset.messageId);
            const pinned = isPinnedMessage(message);
            const mode = this._getPinMode(message, classifyMessage(message), pinned);
            this._setPinnedState(messageElement, pinned, mode);
            return pinned;
        });

        pinnedElements.reverse().forEach(messageElement => messageList.prepend(messageElement));
    }

    static _getPinMode(message, messageType, pinned) {
        if (game.user?.isGM && message?.setFlag) return "pin";
        if (!game.user?.isGM && messageType === MESSAGE_TYPES.WHISPER && !pinned && message?.id) return "request";
        return null;
    }

    static _injectToggle(message, messageElement, pinned, mode) {
        const metadata = messageElement.querySelector(CHAT_SELECTORS.MESSAGE_METADATA);
        if (!metadata || metadata.querySelector(CHAT_SELECTORS.PIN_TOGGLE)) return;

        const toggle = getDocument(metadata).createElement("a");
        toggle.className = "daavy-chat-pin-toggle";
        toggle.tabIndex = 0;
        toggle.setAttribute("role", "button");

        const togglePinned = async (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (mode === "pin") {
                await message.setFlag(MODULE_ID, "pinned", isPinnedMessage(message) ? null : true);
            } else {
                this.requestPin(message);
            }
        };
        toggle.addEventListener("click", togglePinned);
        toggle.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") togglePinned(event);
        });

        this._syncToggle(toggle, pinned, mode);

        const deleteButton = metadata.querySelector(CHAT_SELECTORS.MESSAGE_DELETE);
        metadata.insertBefore(toggle, deleteButton ?? metadata.firstChild);
    }

    static _bindManagerContent(dialog) {
        dialog?.element?.addEventListener("click", async (event) => {
            const content = event.target.closest(".daavy-chat-pin-manager-content");
            if (!content) return;

            const tabButton = event.target.closest("[data-daavy-chat-pin-tab]");
            if (tabButton) {
                await this._refreshManagerDialog(dialog, tabButton.dataset.daavyChatPinTab);
                return;
            }

            const activeTab = content.dataset.daavyChatPinActiveTab;
            if (event.target.closest(".daavy-chat-pin-manager-unpin-all")) {
                await this.unpinMessages(this.getPinnedMessages().filter(message => classifyMessage(message) === activeTab));
                await this._refreshManagerDialog(dialog, activeTab);
                return;
            }

            const unpinButton = event.target.closest("[data-daavy-chat-unpin]");
            if (!unpinButton) return;

            const message = game.messages.get(unpinButton.dataset.daavyChatUnpin);
            await this.unpinMessages(message ? [message] : []);
            await this._refreshManagerDialog(dialog, activeTab);
        });
    }

    static async _refreshManagerDialog(dialog, activeTab = null) {
        const contentContainer = dialog?.element?.querySelector(".dialog-content");
        if (!contentContainer) return;

        contentContainer.innerHTML = await this._renderManagerContent(activeTab);
    }

    static _setPinnedState(messageElement, pinned, mode = null) {
        messageElement.classList.toggle("daavy-chat-pinned", pinned);

        const toggle = messageElement.querySelector(CHAT_SELECTORS.PIN_TOGGLE);
        if (!toggle) return;
        if (!mode) toggle.remove();
        else this._syncToggle(toggle, pinned, mode);
    }

    static _syncToggle(toggle, pinned, mode = "pin") {
        const label = game.i18n.localize(mode === "request" ? i18nKey("Pin.Request") : (pinned ? i18nKey("Pin.Unpin") : i18nKey("Pin.Pin")));
        toggle.classList.toggle(CHAT_CLASSES.ACTIVE, pinned);
        toggle.dataset.tooltip = label;
        toggle.title = label;
        toggle.setAttribute("aria-label", label);
        toggle.innerHTML = `<i class="fas fa-thumbtack"></i>`;
    }

    static requestPin(message) {
        const targetGm = game.users.contents.find(user => user.active && user.isGM);
        if (!targetGm) {
            globalThis.ui?.notifications?.warn?.(game.i18n.localize(i18nKey("Pin.NoGm")));
            return;
        }

        game.socket?.emit?.(`module.${MODULE_ID}`, {
            type: "pinRequest",
            requestId: foundry.utils.randomID(),
            requesterId: game.user.id,
            requesterName: game.user.name,
            targetGmId: targetGm.id,
            messageId: message.id,
            messageContent: message.content,
            messageAuthor: this._getMessageAuthor(message),
            messageTo: this._getMessageRecipients(message),
            messageTime: this._getMessageTime(message)
        });
        globalThis.ui?.notifications?.info?.(game.i18n.localize(i18nKey("Pin.Sent")));
    }

    static async _handleSocket(payload) {
        if (!payload || typeof payload !== "object") return;
        if (payload.type === "pinRequest") return this._handlePinRequest(payload);
        if (payload.type === "pinResponse") return this._handlePinResponse(payload);
    }

    static _handlePinResponse(response) {
        if (response.requesterId !== game.user?.id) return;

        const notificationKey = {
            approved: i18nKey("Pin.Approved"),
            denied: i18nKey("Pin.Denied"),
            busy: i18nKey("Pin.Busy")
        }[response.status];
        if (!notificationKey) return;

        const notify = response.status === "busy" || response.status === "denied" ? "warn" : "info";
        globalThis.ui?.notifications?.[notify]?.(game.i18n.localize(notificationKey));
    }

    static async _handlePinRequest(request) {
        if (!game.user?.isGM || request.targetGmId !== game.user.id) return;

        if (this.pendingRequest) {
            this._sendPinResponse(request, "busy");
            return;
        }

        this.pendingRequest = request;
        await this._showPinRequestDialog(request);
    }

    static async _showPinRequestDialog(request) {
        const resolveRequest = async (status) => {
            if (this.pendingRequest?.requestId !== request.requestId) return;
            this.pendingRequest = null;
            if (status === "approved") {
                const message = game.messages.get(request.messageId);
                if (message) await this._setPinnedFlag(message, true);
            }
            this._sendPinResponse(request, status);
        };

        new foundry.applications.api.DialogV2({
            window: { title: game.i18n.localize(i18nKey("Pin.RequestTitle")) },
            modal: true,
            content: await renderTemplate(PIN_TEMPLATE_PATH, {
                pinRequest: true,
                requesterLabel: game.i18n.localize(i18nKey("Pin.Requester")),
                requesterName: request.requesterName,
                author: request.messageAuthor,
                to: request.messageTo,
                time: request.messageTime,
                messageContent: request.messageContent ?? ""
            }),
            buttons: [
                {
                    action: "approved",
                    icon: "fas fa-check",
                    label: game.i18n.localize(i18nKey("Pin.Accept")),
                    class: "daavy-chat-pin-accept",
                    default: true,
                    callback: () => resolveRequest("approved")
                },
                {
                    action: "denied",
                    icon: "fas fa-times",
                    label: game.i18n.localize(i18nKey("Pin.Deny")),
                    class: "daavy-chat-pin-deny",
                    callback: () => resolveRequest("denied")
                }
            ],
            close: () => resolveRequest("denied"),
            rejectClose: false
        }).render({ force: true });
    }

    static async _setPinnedFlag(message, pinned) {
        if (typeof message?.setFlag !== "function") return false;
        try {
            await message.setFlag(MODULE_ID, "pinned", pinned ? true : null);
            return true;
        } catch {
            return false;
        }
    }

    static _getMessageAuthor(message) {
        return message.speaker?.alias ?? game.users.get?.(message.user?.id ?? message.user)?.name ?? "";
    }

    static _getMessageRecipients(message) {
        if (!Array.isArray(message.whisper) || !game.users?.get) return "";
        return message.whisper
            .map(userId => game.users.get(userId)?.name)
            .filter(Boolean)
            .join(", ");
    }

    static _getMessageTime(message) {
        const timestamp = Number(message.timestamp ?? message._source?.timestamp);
        if (!timestamp) return "";
        return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    static _getTextPreview(content = "") {
        const documentRef = globalThis.document;
        if (!documentRef) return String(content).slice(0, 120);

        const preview = documentRef.createElement("div");
        preview.innerHTML = content;
        return (preview.textContent || "").trim().slice(0, 120);
    }

    static _sendPinResponse(request, status) {
        game.socket?.emit?.(`module.${MODULE_ID}`, {
            type: "pinResponse",
            requestId: request.requestId,
            requesterId: request.requesterId,
            messageId: request.messageId,
            status
        });
    }

}

export class ChatClearControls {
    static _observers = new WeakMap();

    static observeChatLog(renderedHtml) {
        const element = getElement(renderedHtml);
        if (!element) return;

        this._observers.get(element)?.disconnect();
        this.injectClearButton(element);

        const observer = new MutationObserver(() => {
            this.injectClearButton(element);
        });

        observer.observe(element, { childList: true, subtree: true });
        this._observers.set(element, observer);
    }

    static _createScopedClearButton(documentRef) {
        const button = documentRef.createElement("button");
        button.type = "button";
        button.className = "ui-control icon fas fa-trash daavy-chat-scoped-clear";

        const tooltip = game.i18n.localize(i18nKey("Clear.Tooltip"));
        button.dataset.tooltip = tooltip;
        button.title = tooltip;
        button.setAttribute("aria-label", tooltip);

        button.addEventListener("click", async (event) => {
            event.preventDefault();
            event.stopPropagation();
            await this.scopedClearChatLog(event.shiftKey);
        });

        return button;
    }

    static injectClearButton(renderedHtml) {
        const element = getElement(renderedHtml);
        if (!element) return;

        const toolbar = ChatTabsManager._ensureModuleToolbar(element);
        if (!toolbar) return;

        const scopedButtons = Array.from(toolbar.querySelectorAll(".daavy-chat-scoped-clear"));
        if (!game.user?.isGM) {
            ChatPins.removeManagerButtons(toolbar);
            scopedButtons.forEach(button => button.remove());
            return;
        }

        const documentRef = getDocument(element);
        const scopedButton = scopedButtons.shift() ?? null;
        scopedButtons.forEach(button => button.remove());

        const clearButton = scopedButton ?? this._createScopedClearButton(documentRef);
        element.querySelector(CHAT_SELECTORS.CONTROLS)
            ?.querySelector('button[data-action="flush"]')
            ?.remove();

        ChatPins.injectManagerButton(toolbar, documentRef);
        if (!toolbar.contains(clearButton)) {
            toolbar.appendChild(clearButton);
        }
    }

    static async scopedClearChatLog(clearAll = false) {
        if (!game.user?.isGM) return;

        const currentTab = getActiveChatTabs().find(tab => tab.id === ChatTabsManager.activeTab);
        const tabLabel = game.i18n.localize(clearAll
            ? i18nKey("Tabs.All")
            : currentTab?.label ?? i18nKey("Tabs.Chat"));
        const messages = (clearAll
            ? game.messages.contents
            : game.messages.filter(message => classifyMessage(message) === ChatTabsManager.activeTab))
            .filter(message => !isPinnedMessage(message));

        if (!messages.length) {
            return ui.notifications.info(game.i18n.format(i18nKey("Clear.NoMessages"), { label: tabLabel }));
        }

        const confirmed = await foundry.applications.api.DialogV2.confirm({
            window: { title: game.i18n.format(i18nKey("Clear.Title"), { label: tabLabel }) },
            content: `<p>${game.i18n.format(i18nKey("Clear.Confirm"), { count: messages.length, label: tabLabel })}</p>`,
            yes: { default: true },
            no: { default: false },
        });
        if (!confirmed) return;

        const messageIds = messages.map(message => message.id);
        for (let batchStartIndex = 0; batchStartIndex < messageIds.length; batchStartIndex += 100) {
            await ChatMessage.deleteDocuments(messageIds.slice(batchStartIndex, batchStartIndex + 100));
        }

        ui.notifications.info(game.i18n.format(i18nKey("Clear.Success"), { label: tabLabel, count: messageIds.length }));
    }
}


export class ChatTabsManager {
    static _chatContainers = new Set();
    static _mentionJumpButtons = new WeakSet();
    static activeTab = MESSAGE_TYPES.CHAT;
    static unreadTabs = new Set();
    static mentionTabs = new Set();
    static whisperTargetIds = [];

    static _pruneContainers() {
        for (const element of Array.from(this._chatContainers)) {
            if (!element?.isConnected) this._chatContainers.delete(element);
        }
    }

    static _getTrackedContainers() {
        this._pruneContainers();
        return Array.from(this._chatContainers);
    }

    static refresh(element = null) {
        const container = getElement(element);
        if (container) {
            this.inject(container);
            return;
        }

        for (const trackedContainer of this._getTrackedContainers()) {
            this.inject(trackedContainer);
        }
    }

    static onSplitGameChatChange() {
        if (this.activeTab === MESSAGE_TYPES.GAME) this.activeTab = MESSAGE_TYPES.CHAT;

        for (const container of this._getTrackedContainers()) {
            container.querySelector(CHAT_SELECTORS.TAB_BAR)?.remove();
        }

        this.refresh();
    }

    static autoSwitchForMessage(message) {
        if (!isSettingEnabled(SETTINGS.AUTO_SWITCH_TABS.key)) return;

        const type = classifyMessage(message);
        if (type === MESSAGE_TYPES.WHISPER && isAutomatedMessage(message)) return;

        this.switch(type);
    }

    static _ensureModuleToolbar(element) {
        const messageLog = element.querySelector(CHAT_SELECTORS.MESSAGE_LIST);
        if (!messageLog) return null;

        const anchor = element.querySelector(CHAT_SELECTORS.CONTROLS)
            ?? element.querySelector("#chat-form, form.chat-form")
            ?? messageLog;
        const targetParent = anchor?.parentElement;
        if (!targetParent) return null;

        const toolbar = this._getOrCreateToolbar(element);
        if (toolbar.parentElement !== targetParent || toolbar.nextElementSibling !== anchor) {
            targetParent.insertBefore(toolbar, anchor);
        }

        return toolbar;
    }

    static inject(element) {
        if (!element) return;
        this._pruneContainers();
        this._chatContainers.add(element);

        const messageLog = element.querySelector(CHAT_SELECTORS.MESSAGE_LIST);
        if (!messageLog) return;

        const toolbar = this._ensureModuleToolbar(element);
        if (!toolbar) return;

        if (!toolbar.querySelector(CHAT_SELECTORS.TAB_BAR)) {
            toolbar.prepend(this._buildTabBar(getDocument(element)));
        }
        this._syncWhisperTarget(element);
        this._applyFilterClass(element, this.activeTab);
        element.querySelectorAll(CHAT_SELECTORS.MESSAGE_ID).forEach(messageElement => {
            const message = game.messages.get(messageElement.dataset.messageId);
            if (message) messageElement.setAttribute(`data-${CHAT_DATA.TYPE}`, classifyMessage(message));
        });
        ChatPins._refreshContainer(element);
        MessageMerge.observe(element);
        UserMentions.activate(this.activeTab, element);
        const target = UserMentions._initializeNavigation(element, this.activeTab);
        if (target) requestAnimationFrame(() => UserMentions.scrollTo(target));
        this._syncMentionJumpButtons(element);

        ChatClearControls.injectClearButton(element);
    }

    static switch(tabId) {
        this.unreadTabs.delete(tabId);
        this.mentionTabs.delete(tabId);
        if (this.activeTab === tabId) {
            for (const container of this._getTrackedContainers()) {
                container.querySelectorAll(`.${CHAT_CLASSES.TAB_BUTTON}[data-daavy-chat-tab="${tabId}"]`)
                    .forEach(button => button.querySelector(CHAT_SELECTORS.PIP)?.remove());
            }
            UserMentions.activate(tabId);
            this._syncMentionJumpButtons();
            return;
        }

        this.activeTab = tabId;

        const containers = this._getTrackedContainers();
        for (const container of containers) {
            this._applyFilterClass(container, tabId);
            this._syncTabButtons(container, tabId);
        }
        UserMentions.activate(tabId);

        for (const container of containers) {
            const target = UserMentions.resetNavigation(container, tabId);
            const scrollContainer = this._getScrollContainer(container);
            if (!scrollContainer) continue;

            requestAnimationFrame(() => {
                if (target) UserMentions.scrollTo(target);
                else scrollContainer.scrollTop = scrollContainer.scrollHeight;
                this._syncMentionJumpButtons(container);
            });
        }
    }

    static setWhisperTarget(userIds = []) {
        this.whisperTargetIds = Array.from(new Set(userIds)).filter(userId => game.users.has(userId));

        for (const container of this._getTrackedContainers()) {
            this._syncWhisperTarget(container);
        }
    }

    static getWhisperTargetUsers() {
        return this.whisperTargetIds.map(userId => game.users.get(userId)).filter(Boolean);
    }

    static initializeWhisperTarget() {
        const message = game.messages?.contents.findLast(message => !message.isRoll
            && message.whisper?.includes(game.user.id)
            && message.author?.id !== game.user.id);
        this.setWhisperTarget(message ? [message.author.id] : []);
    }

    static onWhisperChatInput(event, options) {
        if (this.activeTab !== MESSAGE_TYPES.WHISPER
            || event.key !== "Enter"
            || event.shiftKey
            || event.isComposing) return;

        const text = event.target?.textContent?.trim() ?? "";
        if (!text || text.startsWith("/")) return;

        const recipients = this.getWhisperTargetUsers();
        if (recipients.length && this._canWhisper(recipients)) return;

        event.preventDefault();
        options.recordPending = false;
        this._notifyMissingWhisperRecipient(recipients);
        return false;
    }

    static onWhisperChatMessage(chatLog, message, chatData) {
        if (this.activeTab !== MESSAGE_TYPES.WHISPER) return;

        const [command, match] = chatLog.constructor.parse(message);
        if (command === "whisper" && this._isEmptyWhisperContent(match[3])) {
            const recipients = this._resolveWhisperRecipients(match[2]);
            if (!recipients.length || !this._canWhisper(recipients)) return;

            this.setWhisperTarget(recipients.map(user => user.id));
            return false;
        }

        if (command !== "none") return;

        const recipients = this.getWhisperTargetUsers();
        if (!recipients.length || !this._canWhisper(recipients)) {
            this._notifyMissingWhisperRecipient(recipients);
            return false;
        }

        const whisperData = {
            ...chatData,
            content: match[2].replace(/\n/g, "<br>"),
            whisper: recipients.map(user => user.id),
            sound: CONFIG.sounds.notification,
        };
        delete whisperData.speaker;

        void ChatMessage.implementation.create(whisperData).catch(error => {
            Hooks.onError(`${MODULE_ID} | ChatTabsManager.onWhisperChatMessage`, error, {
                log: "error",
                notify: "error",
            });
        });
        return false;
    }

    static preCreateWhisperMessage(message) {
        if (!message.whisper?.length) return;
        if (!message.isRoll && this._isEmptyWhisperContent(message.content)) {
            if (message.author?.id === game.user.id) {
                this.setWhisperTarget(message.whisper.filter(userId => userId !== game.user.id));
            }
            return false;
        }

        if (!message.sound) message.updateSource({ sound: CONFIG.sounds.notification });
    }

    static onCreateWhisperMessage(message) {
        if (message.isRoll || !message.whisper?.length) return;

        if (message.author?.id !== game.user.id
            && message.whisper.includes(game.user.id)
            && message.author?.id) {
            this.setWhisperTarget([message.author.id]);
        }
    }

    static _resolveWhisperRecipients(target) {
        const names = target.replace(/[[\]]/g, "").split(",").map(name => name.trim());
        const recipients = names.flatMap(name => ChatMessage.getWhisperRecipients(name));
        return Array.from(new Map(recipients.map(user => [user.id, user])).values());
    }

    static _isEmptyWhisperContent(content) {
        const template = globalThis.document.createElement("template");
        template.innerHTML = content ?? "";
        return !(template.content.textContent ?? "").replace(/[\u00a0\u200b]/g, "").trim();
    }

    static _canWhisper(recipients) {
        return recipients.every(user => user.isGM) || game.user.can("MESSAGE_WHISPER");
    }

    static _notifyMissingWhisperRecipient(recipients) {
        const key = recipients.length ? "ERROR.CantWhisper" : "daavy-chat.Whisper.NoRecipient";
        ui.notifications.warn(game.i18n.localize(key));
    }

    static addNotification(tabId, isMention = false) {
        if (tabId === this.activeTab) return;
        this.unreadTabs.add(tabId);
        if (isMention) this.mentionTabs.add(tabId);

        for (const container of this._getTrackedContainers()) {
            container.querySelectorAll(`.${CHAT_CLASSES.TAB_BUTTON}[data-daavy-chat-tab="${tabId}"]`).forEach(button => {
                this._ensurePip(button);
            });
        }
    }

    static _getOrCreateToolbar(element) {
        const existing = element.querySelector(`:scope > .${CHAT_CLASSES.MODULE_TOOLBAR}`)
            ?? element.querySelector(`.${CHAT_CLASSES.MODULE_TOOLBAR}`);
        if (existing) return existing;

        const toolbar = getDocument(element).createElement("div");
        toolbar.className = CHAT_CLASSES.MODULE_TOOLBAR;
        return toolbar;
    }

    static _buildTabBar(documentRef) {
        const tabBar = documentRef.createElement("div");
        tabBar.className = "daavy-chat-tab-bar split-button";
        tabBar.append(...getActiveChatTabs().map(tabConfig => this._buildTabButton(documentRef, tabConfig)));
        return tabBar;
    }

    static _buildTabButton(documentRef, tabConfig) {
        const isActive = tabConfig.id === this.activeTab;
        const label = game.i18n.localize(tabConfig.label);
        const button = documentRef.createElement("button");
        button.type = "button";
        button.className = `ui-control icon fas ${tabConfig.icon} ${CHAT_CLASSES.TAB_BUTTON}${isActive ? ` ${CHAT_CLASSES.ACTIVE}` : ""}`;
        button.dataset[CHAT_DATA.TAB] = tabConfig.id;
        button.dataset.tooltip = label;
        button.setAttribute("aria-label", label);
        button.setAttribute("aria-pressed", String(isActive));
        button.addEventListener("click", () => this.switch(tabConfig.id));

        if (this.unreadTabs.has(tabConfig.id)) this._ensurePip(button);
        return button;
    }

    static _applyFilterClass(container, tabId) {
        const filterClasses = Object.values(MESSAGE_TYPES).map(tab => `${CHAT_CLASSES.FILTER_PREFIX}-${tab}`);
        container.classList.remove(...filterClasses);
        container.classList.add(`${CHAT_CLASSES.FILTER_PREFIX}-${tabId}`);
    }

    static _syncTabButtons(container, tabId) {
        container.querySelectorAll(".daavy-chat-tab-bar .daavy-chat-tab").forEach((button) => {
            const isActive = button.dataset[CHAT_DATA.TAB] === tabId;
            button.classList.toggle(CHAT_CLASSES.ACTIVE, isActive);
            button.setAttribute("aria-pressed", String(isActive));
            if (isActive) button.querySelector(CHAT_SELECTORS.PIP)?.remove();
        });
        this._syncWhisperTarget(container);
    }

    static _getScrollContainer(container) {
        const messageList = container.querySelector(CHAT_SELECTORS.MESSAGE_LIST);
        return messageList?.closest(CHAT_SELECTORS.SCROLL_CONTAINER) ?? messageList;
    }

    static _syncWhisperTarget(container) {
        const tabBar = container.querySelector(CHAT_SELECTORS.TAB_BAR);
        const button = tabBar?.querySelector(`[data-daavy-chat-tab="${MESSAGE_TYPES.WHISPER}"]`);
        container.querySelector(".daavy-chat-whisper-target")?.remove();
        if (!button) return;

        const label = game.i18n.localize(CHAT_TAB_CONFIG.find(tab => tab.id === MESSAGE_TYPES.WHISPER).label);
        button.dataset.tooltip = label;
        button.setAttribute("aria-label", label);

        if (!button.classList.contains(CHAT_CLASSES.ACTIVE)) return;

        const users = this.getWhisperTargetUsers();
        if (!users.length) return;

        const documentRef = getDocument(button);
        const target = documentRef.createElement("span");
        const targetLabel = game.i18n.localize(i18nKey("Whisper.To"));
        target.className = "daavy-chat-whisper-target";
        target.setAttribute("aria-live", "polite");
        target.append(`${targetLabel}\u00a0`);

        users.forEach((user, index) => {
            if (index) target.append(", ");

            const name = documentRef.createElement("span");
            name.style.color = user.color.css;
            name.textContent = user.name;
            target.append(name);
        });

        const description = `${targetLabel} ${users.map(user => user.name).join(", ")}`;
        tabBar.after(target);
        button.dataset.tooltip = `${label}. ${description}`;
        button.setAttribute("aria-label", `${label}. ${description}`);
    }

    static _ensurePip(button) {
        const pip = button.querySelector(CHAT_SELECTORS.PIP)
            ?? getDocument(button).createElement("span");
        pip.classList.add("daavy-chat-pip");
        const color = this.mentionTabs.has(button.dataset[CHAT_DATA.TAB])
            ? CHAT_MENTION_PIP_COLOR
            : CHAT_PIP_COLOR;
        pip.style.setProperty("background-color", color, "important");
        if (!pip.parentElement) button.appendChild(pip);
    }

    static _syncMentionJumpButtons(container = null) {
        for (const root of container ? [container] : this._getTrackedContainers()) {
            const button = root.querySelector(CHAT_SELECTORS.JUMP_BUTTON);
            if (!button) continue;

            if (!this._mentionJumpButtons.has(button)) {
                this._mentionJumpButtons.add(button);
                button.addEventListener("click", event => {
                    if (!button.classList.contains(CHAT_CLASSES.MENTION_JUMP)) return;

                    event.preventDefault();
                    event.stopPropagation();
                    const target = UserMentions.nextMention(root, this.activeTab, true);
                    UserMentions.scrollTo(target);
                    this._syncMentionJumpButtons(root);
                });
            }

            const scrollContainer = this._getScrollContainer(root);

            if (UserMentions.nextMention(root, this.activeTab)) {
                const label = game.i18n.localize(i18nKey("Mentions.Next"));
                button.classList.add(CHAT_CLASSES.MENTION_JUMP);
                button.removeAttribute("data-action");
                button.setAttribute("aria-label", label);
                button.setAttribute("data-tooltip", label);
                button.hidden = false;
                continue;
            }

            button.classList.remove(CHAT_CLASSES.MENTION_JUMP);
            button.setAttribute("data-action", "jumpToBottom");
            button.setAttribute("aria-label", game.i18n.localize("CHAT.JumpToBottom"));
            button.setAttribute("data-tooltip", "");

            if (scrollContainer) {
                button.hidden = scrollContainer.scrollTop + scrollContainer.clientHeight
                    >= scrollContainer.scrollHeight - 1;
            }
        }
    }

}

class UserMentions {
    static _elements = new Map();
    static _timers = new WeakMap();
    static _expiresAt = new Map();
    static _expired = new Set();
    static _navigation = new WeakMap();

    static _getMentionedElements(container, tabId) {
        return Array.from(container.querySelectorAll(
            `${CHAT_SELECTORS.MESSAGE_ID}.${CHAT_CLASSES.MENTIONED}[data-${CHAT_DATA.TYPE}="${tabId}"]`
        )).sort((first, second) => {
            const firstMessage = game.messages.get(first.dataset.messageId);
            const secondMessage = game.messages.get(second.dataset.messageId);
            return Number(firstMessage?.timestamp ?? firstMessage?._source?.timestamp ?? 0)
                - Number(secondMessage?.timestamp ?? secondMessage?._source?.timestamp ?? 0);
        });
    }

    static _getNavigation(container, tabId, reset = false) {
        const elements = this._getMentionedElements(container, tabId);
        const previous = this._navigation.get(container);
        const current = reset || previous?.tabId !== tabId
            ? elements[0]
            : elements.find(element => element === previous.current) ?? elements[0];
        const state = { tabId, elements, current };
        this._navigation.set(container, state);
        return state;
    }

    static resetNavigation(container, tabId) {
        return this._getNavigation(container, tabId, true).current;
    }

    static _initializeNavigation(container, tabId) {
        if (this._navigation.has(container)) return null;
        return this.resetNavigation(container, tabId);
    }

    static nextMention(container, tabId, advance = false) {
        const state = this._getNavigation(container, tabId);
        const currentIndex = state.elements.indexOf(state.current);
        if (currentIndex < 0) return null;

        const next = state.elements[currentIndex + 1];
        if (!next) return null;
        if (advance) {
            state.current = next;
            this._expire(state.elements[currentIndex].dataset.messageId);
        }
        return next;
    }

    static scrollTo(messageElement) {
        messageElement?.scrollIntoView?.({ block: "center" });
    }

    static processMessage(message, messageElement) {
        if (!message?.id || !messageElement) return;

        const elements = this._elements.get(message.id) ?? new Set();
        elements.add(messageElement);
        this._elements.set(message.id, elements);
        this.highlightMessage(messageElement);
        const mentioned = this.mentionsUser(message, game.user);
        if (!mentioned || this._expired.has(message.id)) return this._clearHighlight(messageElement);

        this._applyHighlight(messageElement);
        if (ChatTabsManager.activeTab === classifyMessage(message)) this._schedule(message, messageElement);
    }

    static activate(tabId, container = null) {
        const containers = container ? [container] : ChatTabsManager._getTrackedContainers();
        containers.forEach(root => root.querySelectorAll(CHAT_SELECTORS.MESSAGE_ID).forEach(element => {
            const message = game.messages.get(element.dataset.messageId);
            if (message && classifyMessage(message) === tabId) this.processMessage(message, element);
        }));
    }

    static _schedule(message, element) {
        if (this._expired.has(message.id) || this._timers.has(element)) return;

        const now = Date.now();
        const expiresAt = this._expiresAt.get(message.id) ?? now + CHAT_MENTION_HIGHLIGHT_DURATION;
        this._expiresAt.set(message.id, expiresAt);
        const remaining = expiresAt - now;
        if (remaining <= 0) return this._expire(message.id);

        this._timers.set(element, setTimeout(() => this._expire(message.id), remaining));
    }

    static _expire(messageId) {
        this._expired.add(messageId);
        this._expiresAt.delete(messageId);

        for (const element of this._elements.get(messageId) ?? []) {
            const timer = this._timers.get(element);
            if (timer) clearTimeout(timer);
            this._timers.delete(element);
            this._clearHighlight(element);
        }
        this._elements.delete(messageId);
        ChatTabsManager._syncMentionJumpButtons();
    }

    static _applyHighlight(messageElement) {
        messageElement.classList.add(CHAT_CLASSES.MENTIONED);
        messageElement.style.setProperty("outline", `2px solid ${CHAT_MENTION_BORDER_COLOR}`, "important");
        messageElement.style.setProperty("outline-offset", "-2px", "important");
    }

    static _clearHighlight(messageElement) {
        messageElement.classList.remove(CHAT_CLASSES.MENTIONED);
        messageElement.style.removeProperty("outline");
        messageElement.style.removeProperty("outline-offset");
    }

    static highlightMessage(messageElement) {
        const contentElement = messageElement.querySelector(".message-content");
        const users = getMentionUsers();
        if (!contentElement || !users.length) return;

        const userByName = new Map(users.map(({ user, name }) => [name.toLowerCase(), user]));
        const names = users
            .map(({ name }) => escapeRegex(name))
            .sort((first, second) => second.length - first.length);
        const mentionPattern = new RegExp(
            `(^|[^\\p{L}\\p{N}_])(@(${names.join("|")}))(?=$|[^\\p{L}\\p{N}_])`,
            "giu"
        );
        const documentRef = getDocument(contentElement);
        const nodeFilter = documentRef.defaultView?.NodeFilter ?? globalThis.NodeFilter;
        if (!nodeFilter) return;

        const textNodes = [];
        const walker = documentRef.createTreeWalker(contentElement, nodeFilter.SHOW_TEXT);
        let textNode = walker.nextNode();
        while (textNode) {
            if (!textNode.parentElement?.closest(`.${CHAT_CLASSES.MENTION}`)) textNodes.push(textNode);
            textNode = walker.nextNode();
        }

        textNodes.forEach(node => {
            const text = node.textContent ?? "";
            let lastIndex = 0;
            let replaced = false;
            const fragment = documentRef.createDocumentFragment();
            mentionPattern.lastIndex = 0;

            for (const match of text.matchAll(mentionPattern)) {
                const user = userByName.get(match[2].slice(1).toLowerCase());
                if (!user) continue;

                const mentionStart = match.index + match[1].length;
                fragment.append(text.slice(lastIndex, mentionStart));

                const mention = documentRef.createElement("span");
                mention.className = CHAT_CLASSES.MENTION;
                mention.style.setProperty("color", user.color.css, "important");
                mention.textContent = match[2];
                fragment.append(mention);

                lastIndex = mentionStart + match[2].length;
                replaced = true;
            }

            if (!replaced) return;
            fragment.append(text.slice(lastIndex));
            node.replaceWith(fragment);
        });
    }

    static notify(message) {
        if (message?.sound || message?.author?.id === game.user?.id || !this.mentionsUser(message, game.user)) return;

        const sound = CONFIG.sounds?.notification;
        if (sound) void game.audio?.play?.(sound, { context: game.audio.interface });
    }

    static mentionsUser(message, user) {
        if (!message || !user?.name || message.isContentVisible === false) return false;

        const content = getMessageText(message.content);
        return hasMention(content, user.name);
    }
}

function getMentionUsers() {
    const seen = new Set();
    return (game.users?.contents ?? [])
        .map(user => ({ user, name: user?.name?.trim() ?? "" }))
        .filter(({ user, name }) => {
            const normalizedName = name.toLowerCase();
            if (!name || !user?.color?.css || seen.has(normalizedName)) return false;

            seen.add(normalizedName);
            return true;
        });
}

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

class MessageMerge {
    static _observers = new WeakMap();

    static observe(container) {
        if (!container) return;

        for (const messageList of container.querySelectorAll(CHAT_SELECTORS.MESSAGE_LIST)) {
            if (messageList.hidden) continue;
            this.refresh(messageList);
            if (this._observers.has(messageList)) continue;

            const observer = new MutationObserver(() => this.refresh(messageList));
            observer.observe(messageList, { childList: true, subtree: true });
            this._observers.set(messageList, observer);
        }
    }

    static refresh(messageList) {
        const messageElements = Array.from(messageList.children)
            .filter(element => element.matches?.(CHAT_SELECTORS.MESSAGE_ID));

        messageElements.forEach(element => element.classList.remove(
            CHAT_CLASSES.MERGE_START,
            CHAT_CLASSES.MERGE_CONTINUATION
        ));

        let previous = null;
        for (const element of messageElements) {
            const message = game.messages.get(element.dataset.messageId);
            if (message) UserMentions.processMessage(message, element);
            const authorId = message?.author?.id;
            const mergeable = this._isMergeable(message) && authorId;

            if (mergeable
                && previous?.authorId === authorId
                && this._sameWhisperTargets(previous.message, message)) {
                previous.element.classList.add(CHAT_CLASSES.MERGE_START);
                element.classList.add(CHAT_CLASSES.MERGE_CONTINUATION);
            }

            previous = mergeable ? { element, authorId, message } : null;
        }
    }

    static _isMergeable(message) {
        const type = classifyMessage(message);
        return !isPinnedMessage(message)
            && !isAutomatedMessage(message)
            && (type === MESSAGE_TYPES.CHAT || type === MESSAGE_TYPES.WHISPER);
    }

    static _sameWhisperTargets(firstMessage, secondMessage) {
        if (classifyMessage(firstMessage) !== MESSAGE_TYPES.WHISPER
            || classifyMessage(secondMessage) !== MESSAGE_TYPES.WHISPER) return true;

        const firstTargets = new Set(firstMessage.whisper ?? []);
        const secondTargets = new Set(secondMessage.whisper ?? []);
        return firstTargets.size === secondTargets.size
            && [...firstTargets].every(userId => secondTargets.has(userId));
    }
}

function getMessageText(content) {
    const documentRef = globalThis.document;
    if (!documentRef) return String(content ?? "").replace(/<[^>]*>/g, " ");

    const template = documentRef.createElement("template");
    template.innerHTML = content ?? "";
    return template.content.textContent ?? "";
}

function hasMention(content, userName) {
    const escapedName = escapeRegex(userName.trim());
    if (!escapedName) return false;

    return new RegExp(`(^|[^\\p{L}\\p{N}_])@${escapedName}(?=$|[^\\p{L}\\p{N}_])`, "iu").test(content);
}

const messageFeatures = [
    { setting: SETTINGS.CLEANER_CHAT.key, css: "daavy-chat-cleaner-chat" },
    { setting: SETTINGS.HIDE_DAMAGE_TRAITS.key, css: "daavy-chat-hide-damage-traits" },
    { handler: TraitFilter, setting: SETTINGS.TRAIT_FILTER.key, css: "daavy-chat-trait-filter" },
    { handler: CollapsibleFormula, setting: SETTINGS.COLLAPSIBLE_FORMULA.key, css: "daavy-chat-collapsible-formula" },
    { handler: HidePrivateMessages, setting: SETTINGS.HIDE_PRIVATE_MESSAGES.key },
    { handler: HideDamageButtons, setting: SETTINGS.HIDE_DAMAGE_BUTTONS.key }
];

export function processFeatures(message, renderedHtml) {
    const element = getElement(renderedHtml);
    if (!element) return;

    element.setAttribute(`data-${CHAT_DATA.TYPE}`, classifyMessage(message));
    UserMentions.processMessage(message, element);
    ChatPins.processMessage(message, element);

    for (const feature of messageFeatures) {
        if (!isSettingEnabled(feature.setting)) continue;

        if (feature.css) element.classList.add(feature.css);
        feature.handler?.processMessage?.(message, element);
    }
}

export function scheduleChatUiRefresh() {
    requestAnimationFrame(() => ChatTabsManager.refresh());
}

export function addChatNotification(message) {
    if (message?.whisper?.length && !isIncomingWhisper(message)) return;
    if (isSettingEnabled(SETTINGS.HIDE_PRIVATE_MESSAGES.key) && HidePrivateMessages.shouldHideMessage(message)) return;
    const isMention = message?.author?.id !== game.user?.id && UserMentions.mentionsUser(message, game.user);
    ChatTabsManager.addNotification(classifyMessage(message), isMention);
    UserMentions.notify(message);
    requestAnimationFrame(() => ChatTabsManager._syncMentionJumpButtons());
}
