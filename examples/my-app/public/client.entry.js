async function hydrateRouteComponent() {
  const runtime = window.__ROUTE_RUNTIME__;
  if (!runtime || runtime.mode !== "client" || !runtime.moduleUrl) return;

  const mountNode = document.getElementById("route-root");
  if (!mountNode) return;

  try {
    const mod = await import(runtime.moduleUrl);
    if (typeof mod.default !== "function") return;
    mod.default(mountNode, runtime.props || {});
  } catch (error) {
    console.error("Route hydration error:", error);
  }
}

hydrateRouteComponent();
