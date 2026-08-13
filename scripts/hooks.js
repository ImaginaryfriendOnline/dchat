import { CHAT_SELECTORS, MESSAGE_TYPES, SETTINGS } from "./constants.js";
import { injectFeedbackButton } from "./feedback.js";
import { groupSettings, registerModuleSettings } from "./settings.js";
import { ImageUpload } from "./features/media.js";
import { classifyMessage, getElement, isCurrentUserAuthor } from "./utils.js";
import {
    AutocompleteWhisper,
    ChatPins,
    ChatClearControls,
    ChatTabsManager,
    HideChatFormatting,
    HideChatInitiative,
    HidePrivateMessages,
    addChatNotification,
    processFeatures,
    scheduleChatUiRefresh
} from "./main.js";

Hooks.once("init", () => {
    registerModuleSettings({
        [SETTINGS.SPLIT_GAME_CHAT.key]: () => ChatTabsManager.onSplitGameChatChange()
    });
    AutocompleteWhisper.init();
    ImageUpload.init();
});

Hooks.once("ready", () => {
    ChatPins.onReady();
    ImageUpload.onReady();
    HidePrivateMessages.onReady();
    ChatTabsManager.initializeWhisperTarget();
});

Hooks.on("renderSettingsConfig", (_application, renderedHtml) => {
    groupSettings(renderedHtml);
    injectFeedbackButton(renderedHtml);
});

Hooks.on("renderChatInput", (application, elements) => {
    ChatTabsManager.refresh(application?.element);
    AutocompleteWhisper.refresh(application?.element, elements);
    HideChatFormatting.refresh(application?.element, elements);
});

Hooks.on("renderChatLog", (_application, renderedHtml) => {
    const element = getElement(renderedHtml);
    ChatTabsManager.inject(element);
    ChatClearControls.observeChatLog(element);
    HideChatFormatting.observe(element);
    AutocompleteWhisper.refresh(element);
});

Hooks.on("renderSidebar", (_application, renderedHtml) => {
    const element = getElement(renderedHtml);
    const chatSection = element?.matches?.(CHAT_SELECTORS.SECTION)
        ? element
        : element?.querySelector(CHAT_SELECTORS.SECTION);
    if (chatSection) ChatTabsManager.inject(chatSection);
    HideChatFormatting.observe(chatSection);
    AutocompleteWhisper.refresh(chatSection);
});

Hooks.on("changeSidebarTab", (application) => {
    if (application?.tabName !== MESSAGE_TYPES.CHAT) return;

    ChatTabsManager.refresh(application?.element);
    HideChatFormatting.refresh(application?.element);
    AutocompleteWhisper.refresh(application?.element);
});

const refreshDetachedChat = () => {
    scheduleChatUiRefresh();
    AutocompleteWhisper.refresh();
};

Hooks.on("openDetachedWindow", refreshDetachedChat);
Hooks.on("closeDetachedWindow", refreshDetachedChat);

Hooks.on("renderChatMessageHTML", (message, renderedHtml) => {
    ImageUpload.processMessage(message, renderedHtml);
    processFeatures(message, renderedHtml);
});
Hooks.on("createChatMessage", (message) => {
    void ImageUpload.onCreateMessage(message);
    addChatNotification(message);
    ChatTabsManager.onCreateWhisperMessage(message);
    if (isCurrentUserAuthor(message)) ChatTabsManager.switch(classifyMessage(message));
});
Hooks.on("updateChatMessage", scheduleChatUiRefresh);
Hooks.on("preDeleteChatMessage", (message, ...args) => {
    if (ImageUpload.isProcessing(message)) {
        ui.notifications.info("Please wait for chat images to finish uploading.");
        return false;
    }
    return ChatPins.preDeleteMessage(message, ...args);
});
Hooks.on("chatInput", (...args) => ChatTabsManager.onWhisperChatInput(...args));
Hooks.on("chatMessage", (...args) => ChatTabsManager.onWhisperChatMessage(...args));

Hooks.on("preCreateChatMessage", (message, creationData) => {
    if (HideChatInitiative.preCreateChatMessage(message, creationData) === false) return false;
    return ChatTabsManager.preCreateWhisperMessage(message);
});
