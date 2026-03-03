/**
 * Initialize linkifyjs with custom protocols before BlockNote loads.
 *
 * This prevents the warning: "linkifyjs: already initialized - will not register
 * custom scheme 'tel' until manual call of linkify.init()"
 *
 * The issue occurs because:
 * 1. BlockNote's Link extension tries to register protocols (mailto, tel, etc.)
 * 2. But linkifyjs may already be initialized from a previous HMR cycle
 * 3. linkifyjs warns when registering protocols after initialization
 *
 * Solution: Register all protocols once at app startup, before any editor loads,
 * and call init() to process them.
 */

import * as linkify from "linkifyjs";

// Protocols that BlockNote uses (from @blocknote/core/extensions/LinkToolbar/protocols.ts)
const VALID_LINK_PROTOCOLS = [
  "ftp",
  "ftps",
  "tel",
  "callto",
  "sms",
  "cid",
  "xmpp",
];

// Register custom protocols before linkify is first used
// Note: http, https, mailto are built-in to linkifyjs
for (const protocol of VALID_LINK_PROTOCOLS) {
  try {
    linkify.registerCustomProtocol(protocol);
  } catch {
    // Protocol format invalid, ignore
  }
}

// Initialize linkify with the registered protocols
// This must be called after registerCustomProtocol and before any linkify usage
linkify.init();

export {};
