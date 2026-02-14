
import { EventEmitter } from "events";

// SSE event emitter for real-time conversation updates
export const conversationEvents = new EventEmitter();
conversationEvents.setMaxListeners(100); // Allow many admin clients
