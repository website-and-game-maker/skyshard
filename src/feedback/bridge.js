// Talks to the Unblock Games arcade when Skyshard runs inside it.
//
// The arcade serves Skyshard from its own origin in a frame. When the game
// says hello, the arcade answers, and from then on Skyshard's Feedback button
// opens the arcade's own report dialog instead of a second form: one button,
// one dialog, one inbox. The arcade's bar has the same button; pressing it
// pauses the game and asks for the same game details.
//
// Messages are plain objects with `arcade: 1` and a `type`:
//   game -> arcade  hello { game }           feedback { info }      info { info }
//   arcade -> game  host { feedback, name }  pause  info?           feedback-closed { sent }
// Only the parent window on the same origin is listened to.

export const PROTOCOL = 1;

export function createHostBridge({ win = globalThis.window, game = 'skyshard', getInfo = () => '', onPause = () => {}, onClosed = () => {}, onHost = () => {} } = {}) {
  const parent = win && win.parent !== win ? win.parent : null;
  const origin = win?.location?.origin;
  let host = null;

  function post(message) {
    if (!parent || !origin || origin === 'null') return;
    try {
      parent.postMessage({ arcade: PROTOCOL, ...message }, origin);
    } catch {
      // A cross-origin parent: not the arcade.
    }
  }

  function onMessage(event) {
    if (!parent || event.source !== parent || event.origin !== origin) return;
    const data = event.data;
    if (!data || data.arcade !== PROTOCOL) return;
    switch (data.type) {
      case 'host':
        host = { feedback: !!data.feedback, name: typeof data.name === 'string' ? data.name.slice(0, 40) : 'Arcade' };
        onHost(host);
        break;
      case 'pause':
        onPause();
        break;
      case 'info?':
        post({ type: 'info', info: getInfo() });
        break;
      case 'feedback-closed':
        onClosed(!!data.sent);
        break;
    }
  }

  win?.addEventListener?.('message', onMessage);
  post({ type: 'hello', game });

  return {
    // True once the arcade has said it shows feedback itself.
    get hosted() {
      return !!host?.feedback;
    },
    get hostName() {
      return host?.name ?? null;
    },
    openFeedback(info) {
      if (!host?.feedback) return false;
      post({ type: 'feedback', info });
      return true;
    },
    dispose() {
      win?.removeEventListener?.('message', onMessage);
    },
  };
}
