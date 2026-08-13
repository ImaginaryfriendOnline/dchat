export const MODULE_ID = "dchat";

export const PIN_TEMPLATE_PATH = `modules/${MODULE_ID}/templates/main.hbs`;
export const FEEDBACK_ACTIONS_CLASS = "daavy-chat-settings-actions";
export const PROSE_MIRROR_SELECTOR = "prose-mirror[name='message']";

export const MESSAGE_TYPES = {
    CHAT: "chat",
    GAME: "game",
    WHISPER: "whisper",
};

export const SETTINGS = {
    CLEANER_CHAT: {
        key: "cleanerChat",
        name: "daavy-chat.Settings.cleanerChat.Name",
        hint: "daavy-chat.Settings.cleanerChat.Hint"
    },
    HIDE_CHAT_FORMATTING: {
        key: "hideChatFormatting",
        name: "daavy-chat.Settings.HideChatFormatting.Name",
        hint: "daavy-chat.Settings.HideChatFormatting.Hint"
    },
    COLLAPSIBLE_FORMULA: {
        key: "collapsibleFormula",
        name: "daavy-chat.Settings.CollapsibleFormula.Name",
        hint: "daavy-chat.Settings.CollapsibleFormula.Hint"
    },
    HIDE_CHAT_INITIATIVE: {
        key: "hideChatInitiative",
        name: "daavy-chat.Settings.hideChatInitiative.Name",
        hint: "daavy-chat.Settings.hideChatInitiative.Hint",
        scope: "world"
    },
    HIDE_PRIVATE_MESSAGES: {
        key: "hidePrivateMessages",
        name: "daavy-chat.Settings.HidePrivateMessages.Name",
        hint: "daavy-chat.Settings.HidePrivateMessages.Hint",
        scope: "world",
        restricted: true
    },
    ALLOW_PLAYER_MEDIA: {
        key: "allowPlayerMedia",
        name: "daavy-chat.Settings.AllowPlayerMedia.Name",
        hint: "daavy-chat.Settings.AllowPlayerMedia.Hint",
        scope: "world",
        restricted: true,
        default: true
    },
    SPLIT_GAME_CHAT: {
        key: "splitGameChat",
        name: "daavy-chat.Settings.SplitGameChat.Name",
        hint: "daavy-chat.Settings.SplitGameChat.Hint",
        default: true
    },
    HIDE_DAMAGE_TRAITS: {
        key: "hideDamageTraits",
        name: "daavy-chat.Settings.hideDamageTraits.Name",
        hint: "daavy-chat.Settings.hideDamageTraits.Hint"
    },
    TRAIT_FILTER: {
        key: "traitFilter",
        name: "daavy-chat.Settings.traitFilter.Name",
        hint: "daavy-chat.Settings.traitFilter.Hint"
    },
    HIDE_DAMAGE_BUTTONS: {
        key: "hideDamageButtons",
        name: "daavy-chat.Settings.HideDamageButtons.Name",
        hint: "daavy-chat.Settings.HideDamageButtons.Hint"
    }
};

export const SETTING_GROUPS = {
    Settings: [
        SETTINGS.CLEANER_CHAT.key,
        SETTINGS.COLLAPSIBLE_FORMULA.key,
        SETTINGS.HIDE_CHAT_FORMATTING.key,
        SETTINGS.HIDE_CHAT_INITIATIVE.key,
        SETTINGS.HIDE_PRIVATE_MESSAGES.key,
        SETTINGS.ALLOW_PLAYER_MEDIA.key,
        SETTINGS.SPLIT_GAME_CHAT.key
    ],
    PF2eOnly: [
        SETTINGS.HIDE_DAMAGE_BUTTONS.key,
        SETTINGS.HIDE_DAMAGE_TRAITS.key,
        SETTINGS.TRAIT_FILTER.key
    ]
};

export const SETTINGS_CLASSES = {
    GROUP: "daavy-chat-settings-group"
};

export const CHAT_TAB_CONFIG = [
    { id: MESSAGE_TYPES.CHAT, label: "daavy-chat.Tabs.Chat", icon: "fa-comments" },
    { id: MESSAGE_TYPES.GAME, label: "daavy-chat.Tabs.Game", icon: "fa-dice-d20" },
    { id: MESSAGE_TYPES.WHISPER, label: "daavy-chat.Tabs.Whispers", icon: "fa-user-secret" },
];

export const CHAT_SELECTORS = {
    SECTION: "#chat, [data-tab='chat']",
    CONTROLS: "#chat-controls",
    MESSAGE_LIST: "#chat-log, .chat-log, ol.chat-messages, [class*='chat-log']",
    SCROLL_CONTAINER: ".chat-scroll",
    JUMP_BUTTON: ".jump-to-bottom",
    TAB_BAR: ".daavy-chat-tab-bar",
    MESSAGE_ID: "[data-message-id]",
    MESSAGE_METADATA: ".message-metadata",
    MESSAGE_DELETE: ".message-delete",
    PIN_TOGGLE: ".daavy-chat-pin-toggle",
    PIN_MANAGER: ".daavy-chat-pin-manager",
    PIP: ".daavy-chat-pip"
};

export const CHAT_CLASSES = {
    MODULE_TOOLBAR: "daavy-chat-module-toolbar",
    TAB_BUTTON: "daavy-chat-tab",
    ACTIVE: "active",
    FILTER_PREFIX: "daavy-chat-filter",
    MENTION_JUMP: "daavy-chat-mention-jump",
    MENTIONED: "daavy-chat-mentioned",
    MENTION: "daavy-chat-mention",
    MERGE_START: "daavy-chat-merge-start",
    MERGE_CONTINUATION: "daavy-chat-merge-continuation"
};

export const CHAT_PIP_COLOR = "#ffffff";
export const CHAT_MENTION_PIP_COLOR = "#d6a400";
export const CHAT_MENTION_BORDER_COLOR = "#d6a400";
export const CHAT_MENTION_HIGHLIGHT_DURATION = 60_000;

export const AUTOCOMPLETE_WHISPER = {
    HOST_SELECTOR: "#chat-notifications, #chat-form, form.chat-form",
    EDITOR_SELECTOR: "prose-mirror[name='message'], prose-mirror, .editor-content[contenteditable='true'], [contenteditable='true']",
    EDITABLE_SELECTOR: ".editor-content[contenteditable='true'], [contenteditable='true']",
    HOST_CLASS: "daavy-chat-whisper-autocomplete-host",
    POPUP_CLASS: "daavy-chat-whisper-autocomplete",
    OPTION_CLASS: "daavy-chat-whisper-option",
    ACTIVE_OPTION_CLASS: CHAT_CLASSES.ACTIVE,
    INDEX_DATA: "daavyChatWhisperIndex"
};

export const CHAT_DATA = {
    TAB: "daavyChatTab",
    TYPE: "daavy-chat-type"
};

export const PF2E_CLASSES = {
    FILTERED_TRAIT: "daavy-chat-filtered",
    CLICKABLE_TRAIT: "daavy-chat-clickable",
    HIDDEN_DAMAGE_BUTTONS: "daavy-chat-buttons-hidden",
    TOGGLE_DAMAGE_BUTTONS: "daavy-chat-toggle-buttons"
};

export const PF2E_DATA = {
    TRAITS_LIMITED: "daavyChatLimited",
    DAMAGE_BUTTONS_PROCESSED: "daavyChatButtonsProcessed"
};

export const PF2E_VISIBLE_TRAIT_LIMIT = 3;

export const PF2E_TRAITS_TO_HIDE = [
    "common", "uncommon", "rare", "unique",
    "spellshot", "archetype", "class", "general", "skill", "aiuvarin", "anadi", "android",
    "aphorite", "ardande", "astrazoan", "athamaru", "automaton", "awakened-animal", "barathu",
    "beastkin", "borai", "centaur", "changeling", "conrasu", "contemplative", "hryngar",
    "dragonblood", "dragonkin", "dromaar", "dwarf", "elf", "elebrian", "fetchling", "fleshwarp",
    "ganzi", "geniekin", "ghoran", "kholo", "gnome", "goblin", "goloma", "tripkee", "halfling",
    "human", "hungerseed", "ikeshti", "jotunborn", "kalo", "kasatha", "kashrishi", "khizar",
    "kitsune", "lashunta", "leshy", "lizardfolk", "merfolk", "minotaur", "naari", "nagaji",
    "nephilim", "orc", "oread", "pahtra", "poppet", "reflection", "samsaran", "sarangay",
    "sarcesian", "shirren", "shisk", "shobhad", "shoony", "skittermander", "strix", "suli",
    "surki", "sylph", "talos", "tanuki", "undine", "vanara", "vesk", "vishkanya", "vlaka",
    "wayang", "yaksha", "yaoguai", "alchemist", "animist", "barbarian", "bard", "champion",
    "cleric", "commander", "druid", "envoy", "exemplar", "fighter", "guardian", "gunslinger",
    "inventor", "investigator", "kineticist", "magus", "monk", "mystic", "operative", "oracle",
    "psychic", "ranger", "rogue", "solarian", "soldier", "sorcerer", "summoner", "swashbuckler",
    "thaumaturge", "witch", "witchwarper", "wizard", "aberration", "animal", "astral", "beast",
    "celestial", "dragon", "dream", "elemental", "ethereal", "experiment", "fey", "fiend",
    "fungus", "giant", "humanoid", "monitor", "ooze", "petitioner", "plant", "sea-devil",
    "shade", "arcane", "divine", "occult", "primal", "aeon", "aesir", "agathion", "angel",
    "anugobu", "archon", "asura", "azarketi", "azata", "blight", "boggard", "bugbear",
    "caligni", "catfolk", "charau-ka", "corpsefolk", "coatl", "daemon", "darvakka", "demon",
    "dero", "devil", "dhampir", "dinosaur", "div", "drow", "drift", "duskwalker", "formian",
    "genie", "ghost", "ghoul", "ghul", "gigas", "graveknight", "gremlin", "grioth", "hag",
    "hantu", "herald", "hobgoblin", "inevitable", "jinsul", "kaiju", "kami", "kobold",
    "kovintus", "kucharn", "lilu", "mindless", "morlock", "mortic", "mummy", "munavri",
    "mutant", "nindoru", "nymph", "oni", "paaridar", "palinthanos", "phantom", "protean",
    "psychopomp", "qlippoth", "rakshasa", "ratfolk", "robot", "sahkil", "sedacthy",
    "serpentfolk", "seugathi", "shabti", "siktempora", "skeleton", "skelm", "skulk",
    "soulbound", "spectra", "sporeborn", "spriggan", "sprite", "stheno", "tane", "tanggal",
    "tengu", "titan", "time", "troll", "urdefhan", "vampire", "velstrac", "werecreature",
    "wight", "wild-hunt", "wraith", "wraithvine", "wyrwood", "xulgath", "zombie",
    "pervasive-magic", "stamina", "apparition", "attuned", "composite", "eidolon", "evolution",
    "ikon", "modification", "oath", "wandering", "adjustment", "companion", "relic", "aftermath",
    "dedication", "deviant", "lineage", "multiclass", "reincarnated", "calling", "destiny",
    "brandish", "esoterica", "artifact", "precious", "processed", "exposed", "breakdown",
    "powered", "extradimensional", "holy", "sanctified", "tech", "teleportation", "unholy",
    "contact", "ingested", "inhaled", "injury", "vitality", "void", "spirit", "cosmic",
    "circus", "harrow-court", "civic", "commerce", "leadership", "region", "upkeep",
    "alchemical", "biotech", "elixir", "gadget", "intelligent", "magitech", "mechanical",
    "nanite", "necrograft", "oil", "potion", "serum", "steam", "detection", "emotion",
    "healing", "prediction", "radiation", "revelation", "scrying", "sleep", "technological",
    "illusion", "air", "earth", "fire", "metal", "water", "wood", "acid", "cold", "electricity",
    "force", "sonic", "shadow", "persona-flirt", "persona-guardian", "persona-leader",
    "persona-scholar", "persona-scoundrel", "persona-underdog", "persona-warrior",
    "persona-wildcard", "environmental", "army", "cavalry", "infantry", "siege", "skirmisher"
];
