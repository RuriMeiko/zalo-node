# Fork Notes - RuriMeiko/zalo-node

This version is a fork of [dinhtrung1308/zalo-node](https://github.com/dinhtrung1308/zalo-node) with several enhancements and bug fixes.

## Main Enhancements

### Zalo Send Message Node
- **Flexible Message Input**: Added an "Input Style" selector that allows switching between traditional UI fields and raw JSON input (`messageJson`) for the entire message.
- **Improved Style Input (v 0.6.3)**: Added "Style Input Mode" specifically for message formatting. This allows passing a raw JSON array of styles, making it easier to carry formatting over from other nodes.
- **Extended Quote Support**: Added support for additional quote fields: `propertyExt`, `cliMsgId`, and `ttl`.
- **Improved UI**: All collection items are now alphabetized by their display name for better usability.

### Bug Fixes and Reliability
- **Dependency Upgrade**: Upgraded `zca-js` to `2.0.4` for better API compatibility and stability.
- **Build Fixes**: Resolved several latent TypeScript errors in the following nodes:
  - `ZaloSendMessage`: Fixed `sendTypingEvent` argument mismatch.
  - `ZaloUser`: Fixed `updateProfile` payload structure.
  - `ZaloPoll`: Fixed `getPollDetail` parameter type mismatch.

## NPM Package
The package is published under a new name to avoid conflicts:
**[n8n-nodes-zalo-meiko](https://www.npmjs.com/package/n8n-nodes-zalo-meiko)**
