// Opening one AI chat from elsewhere (a notification, an e-mail link): the
// chat id is kept until the assistant's chat list has loaded and picks it up.
export const OPEN_CHAT_KEY = 'carbonless_open_chat';
export const OPEN_CHAT_EVENT = 'carbonless:open-chat';

export function openChat(id) {
  if (typeof window === 'undefined' || !id) return;
  try { sessionStorage.setItem(OPEN_CHAT_KEY, String(id)); } catch { /* still sent with the event */ }
  window.dispatchEvent(new CustomEvent(OPEN_CHAT_EVENT, { detail: String(id) }));
}

// Read without clearing: the assistant that actually opens the chat clears
// it (a hidden one that is about to unmount must not use it up).
export function pendingChatToOpen() {
  try { return sessionStorage.getItem(OPEN_CHAT_KEY); } catch { return null; }
}

export function clearChatToOpen() {
  try { sessionStorage.removeItem(OPEN_CHAT_KEY); } catch { /* nothing kept */ }
}
