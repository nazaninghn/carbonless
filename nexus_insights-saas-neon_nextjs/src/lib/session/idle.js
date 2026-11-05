// @ts-check
// Inactivity timeout, browser side. The SERVER enforces it (accounts/session.py: a token whose last-activity time is
// older than 30 minutes is refused, and a refresh cannot revive it). This module decides what the browser does about
// it: record real user activity, tell the server about it, warn before the end, and end the session.
//
// What counts as activity: a press, a tap, a key. What does NOT: mouse movement, scrolling, focus or visibility
// changes, timers, polling, automatic token refreshes. The time of the last activity lives in localStorage, so every
// open tab shares it: activity in any tab keeps all of them signed in.

export const IDLE_MS = 30 * 60 * 1000;            // the limit (the server's SESSION_IDLE_TIMEOUT_SECONDS)
export const WARN_MS = 2 * 60 * 1000;             // warn this long before the end
export const TICK_MS = 15 * 1000;                 // how often the state is re-evaluated
export const EXTEND_EVERY_MS = 2 * 60 * 1000;     // while the user works, tell the server at least this often ...
export const EXTEND_AFTER_QUIET_MS = 45 * 1000;   // ... and once they pause, so the server's clock is within ~1 minute
export const ACTIVITY_WRITE_MS = 1000;            // activity is written to storage at most this often
export const LAG_MS = 60 * 1000;                  // the server may be this far behind the user's last activity: no refresh for less

export const KEY_ACTIVITY = 'carbonless_last_activity';
export const KEY_EXTENDED = 'carbonless_last_extend';        // when the server was last told (any tab)
export const KEY_REPORTED = 'carbonless_last_reported';      // the activity time the server was last told about
export const KEY_ENDED = 'carbonless_session_ended';         // set when a tab ends the session, so the others follow
export const KEY_UNSAVED_NOTE = 'carbonless_expired_unsaved'; // sessionStorage: show "an answer was not saved" on the login page

/**
 * @param {{ now: number, lastActivity: number }} s
 * @returns {'active' | 'warning' | 'expired'}
 */
export function idleState({ now, lastActivity }) {
  const idle = now - lastActivity;
  if (idle >= IDLE_MS) return 'expired';
  if (idle >= IDLE_MS - WARN_MS) return 'warning';
  return 'active';
}

/** Milliseconds left before the session ends (0 when over). */
export function msLeft({ now, lastActivity }) {
  return Math.max(0, IDLE_MS - (now - lastActivity));
}

/**
 * Should the server be told about activity now? A refresh rotates the refresh token, so it is only sent when it matters:
 * the user was active more than a minute after the activity the server last heard about, and either has been working
 * for a while since the last report, or has just paused (so the server's clock ends up within a minute of the real one).
 * @param {{ now: number, lastActivity: number, lastExtend: number, reported?: number }} s
 *   reported: the activity time the server was last told about (0 when never)
 */
export function shouldExtend({ now, lastActivity, lastExtend, reported = 0 }) {
  if (!(lastActivity - reported > LAG_MS)) return false;
  return now - lastExtend >= EXTEND_EVERY_MS || now - lastActivity >= EXTEND_AFTER_QUIET_MS;
}

/** Whole seconds since the last activity, as reported to the server. */
export function activityAgeSeconds({ now, lastActivity }) {
  return Math.max(0, Math.floor((now - lastActivity) / 1000));
}

/** "m:ss" for the countdown. */
export function clock(ms) {
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
