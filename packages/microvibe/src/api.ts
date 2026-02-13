export const API_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

export type ApiMethod = (typeof API_METHODS)[number];

export type ApiHandler = (...args: unknown[]) => unknown;

export type ApiModuleLike = {
  default?: ApiHandler;
} & Partial<Record<ApiMethod, ApiHandler>>;

export type ApiHandlerSelection = {
  handler?: ApiHandler;
  allow: ApiMethod[];
};

export function getAllowedMethods(mod: ApiModuleLike): ApiMethod[] {
  return API_METHODS.filter((method) => typeof mod[method] === "function");
}

export function selectApiHandler(mod: ApiModuleLike, method: string): ApiHandlerSelection {
  const allow = getAllowedMethods(mod);
  const normalized = method.toUpperCase() as ApiMethod;
  const byMethod = mod[normalized];
  if (typeof byMethod === "function") return { handler: byMethod, allow };
  if (typeof mod.default === "function") return { handler: mod.default, allow };
  return { allow };
}
