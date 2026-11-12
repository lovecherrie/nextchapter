const HISTORY_KEY = "aepilogBack";

type BackEntry = { current: string; previous: string | null };

function localPath(url: string | URL) {
  const parsed = new URL(url, window.location.href);
  return parsed.origin === window.location.origin ? parsed.pathname + parsed.search + parsed.hash : null;
}

function entry(): BackEntry | undefined {
  return window.history.state?.[HISTORY_KEY];
}

export function canGoBack() {
  const saved = entry();
  return window.history.length > 1 && saved?.current === localPath(window.location.href) && !!saved.previous;
}

// Keep our own small marker alongside (never instead of) Next's history state.
// Unlike history.length alone, this distinguishes a shared link from an in-site visit.
export function trackBackHistory() {
  const history = window.history;
  const push = history.pushState;
  const replace = history.replaceState;
  const current = localPath(window.location.href)!;
  if (entry()?.current !== current) {
    const previous = history.length > 1 && document.referrer ? localPath(document.referrer) : null;
    replace.call(history, { ...history.state, [HISTORY_KEY]: { current, previous } }, "");
  }

  const pushTracked: History["pushState"] = function (data, unused, url) {
    const current = localPath(url ?? window.location.href);
    return push.call(history, { ...data, [HISTORY_KEY]: { current, previous: localPath(window.location.href) } }, unused, url);
  };
  const replaceTracked: History["replaceState"] = function (data, unused, url) {
    return replace.call(history, { ...data, [HISTORY_KEY]: { current: localPath(url ?? window.location.href), previous: entry()?.previous ?? null } }, unused, url);
  };
  history.pushState = pushTracked;
  history.replaceState = replaceTracked;
  return () => {
    if (history.pushState === pushTracked) history.pushState = push;
    if (history.replaceState === replaceTracked) history.replaceState = replace;
  };
}
