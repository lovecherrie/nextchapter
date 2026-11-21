"use client";

export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return <html lang="en"><body style={{ margin: 0, background: "#faf6ef", color: "#2d2625", fontFamily: "Georgia, serif" }}>
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
      <h1 style={{ fontSize: 28, fontWeight: 500 }}>Let’s try that again.</h1>
      <p style={{ lineHeight: 1.6 }}>Aepilog couldn’t load this page.</p>
      <button type="button" onClick={retry} style={{ border: 0, borderRadius: 32, padding: "12px 24px", background: "#8f2635", color: "#fffdf9", font: "inherit", cursor: "pointer" }}>Try again</button>
      {/* A full navigation recovers even if the root router/provider failed. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <p><a href="/" style={{ color: "#8f2635" }}>Back to community</a></p>
    </main>
  </body></html>;
}
