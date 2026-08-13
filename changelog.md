##### 1.7.5
- Generalized system-message detection (used for the Game tab and the Auto-Switch Active Tab fix) to check the active game system's own flags instead of hardcoding PF2e. Non-PF2e systems (e.g. dnd5e) now get the same protection against automated messages hijacking the active tab.

##### 1.7.4
- Fixed automated PF2e messages (e.g. private/blind damage-log entries) forcing your active tab to switch to Whispers.
- Added an **Auto-Switch Active Tab** setting. Disable it to stop the chat log from ever changing your active tab automatically when you send a message or roll dice.

##### 1.7.3
- Added a **Split Chat & Game Tabs** setting. Disable it to merge dice rolls and system messages into the Chat tab instead of keeping them in a separate Game tab.

##### 1.7.2
- Fixed an issue where all users received a visual notification whenever a Whisper was sent.
- Fixed an issue where message merging in the Whisper tab combined messages sent to different users.

##### 1.7.1
- Switching tabs now scrolls to the most recent message.
  - If there are unread mentions, the tab scrolls to the oldest one instead.
- Added a `Jump to Next Mention` button to make unread mentions easier to find.
  - This button temporarily replaces `Jump to Bottom` until all mentions have been viewed.
  - Using `Jump to Next Mention` removes the highlight from the previous mention.

##### 1.7.0
- Added support for sending media in chat.
  - Supported file formats are `PNG`, `JPG/JPEG`, `WEBP`, and `GIF`.
    - All formats except `GIF` are compressed to `WEBP` to reduce file size.
    - Uploaded media is stored in `\worlds\world_name\assets\messages`.
  - Media uploaded through the module is permanently deleted when its chat message is deleted.
  - Players do not need the `Upload Files` permission to send media in chat.
    - Player media uploads can be disabled in the module settings.
    - A GM must be logged into the game for players to send media because the GM acts as a relay.
  - Media can be sent through chat using drag-and-drop or copy-and-paste.
- Added support for mentioning users with `@username`.
  - Mentioned users receive a sound notification, and the tab ping turns yellow.
  - The message remains highlighted for one minute after the user opens the tab.
  - This feature only applies to the Chat and Whisper tabs.
- Removed the option to disable `Autocomplete Whisper`.
- Removed the legacy `Compact Chat` feature because it had no noticeable visual effect.
- Changed the ping color to white so it is not overridden by themes from other modules.

##### 1.6.3
- Changed the Whisper tab icon to a more intuitive design.
- Added a sound notification for incoming Whisper messages.
- Sending a message while the Whisper tab is open now replies to the last user who sent you a Whisper.
- Certain chat actions now switch tabs automatically:
  - Sending a message switches to the Chat tab.
  - Making a roll switches to the Game tab.
  - Sending a Whisper switches to the Whisper tab.
- Your current Whisper reply target is now displayed next to the Whisper tab.
- Sending `/w user` without a message now changes your current Whisper reply target without sending anything.
- Improved `Autocomplete Whisper` behavior when holding Shift.

##### 1.6.2
- Improved the Settings interface.

##### 1.6.1
- Removed debug mode.
- Added an anonymous feedback button for GMs only.

##### 1.6.0
- Added Chat Pins.
  - Players can now request message pins from GMs through the Whisper tab.
  - Added a Pin Manager button for managing pins across all tabs.

##### 1.5.1
- Removed the option to reset settings.

##### 1.5.0
- Added Hide Chat Formatting, which removes ProseMirror formatting from chat.
- Reorganized the Settings menu.

##### 1.4.5
- Added an option to restore the default settings.
- Debug mode can now be enabled or disabled instead of always being active.

##### 1.0.1 - 1.4.4
- Fixed bugs.
- Added Autocomplete Whisper, Hide Private Messages, and Hide Chat Initiative as optional features.

##### 1.0.0
- Initial release.