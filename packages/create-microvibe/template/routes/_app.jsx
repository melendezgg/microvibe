/** @jsx h */
import { h } from "preact";

export default function App({ children, url, routeRuntime }) {
  const runtimeScript = `window.__ROUTE_RUNTIME__=${JSON.stringify(routeRuntime ?? null)};`;

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>MicroVibe</title>
        <link rel="stylesheet" href="/app.css" />
      </head>
      <body>
        <main className="app-shell">
          <section className="app-main">
            <header className="app-header">
              <h1>Hello World from MicroVibe</h1>
              <p>
                Current route: <code>{url.pathname}</code>
              </p>
            </header>
            <div id="route-root" className="route-root">
              {children}
            </div>
          </section>
        </main>
        <script dangerouslySetInnerHTML={{ __html: runtimeScript }}></script>
        <script type="module" src="/client.entry.js"></script>
      </body>
    </html>
  );
}
