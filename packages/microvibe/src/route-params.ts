export type RouteParamRule = RegExp | ((value: string) => boolean);

export type RouteParamRules = Record<string, RouteParamRule>;

export type RouteParamsValidationResult =
  | boolean
  | {
      ok: boolean;
      status?: 400 | 404;
      error?: string;
    };

export type RouteParamsValidator = (params: Record<string, string>) => RouteParamsValidationResult;

export type RouteParamsCheck =
  | { ok: true }
  | {
      ok: false;
      status: 400 | 404;
      error: string;
    };

function invalid(status: 400 | 404, error: string): RouteParamsCheck {
  return { ok: false, status, error };
}

function validateRuleValue(key: string, rule: unknown): asserts rule is RouteParamRule {
  const valid = rule instanceof RegExp || typeof rule === "function";
  if (!valid) {
    throw new TypeError(
      `Invalid route param rule for "${key}". Expected RegExp or (value) => boolean.`
    );
  }
}

export function validateRouteParams(
  params: Record<string, string>,
  rules?: RouteParamRules,
  validator?: RouteParamsValidator
): RouteParamsCheck {
  if (rules) {
    for (const [key, rule] of Object.entries(rules)) {
      validateRuleValue(key, rule);
      const value = params[key];
      if (value === undefined) continue;
      const ok = rule instanceof RegExp ? rule.test(value) : Boolean(rule(value));
      if (!ok) return invalid(400, `Invalid route param: ${key}`);
    }
  }

  if (!validator) return { ok: true };

  const result = validator(params);
  if (result === undefined || result === true) return { ok: true };
  if (result === false) return invalid(400, "Invalid route params");

  if (result.ok) return { ok: true };
  return invalid(result.status === 404 ? 404 : 400, result.error || "Invalid route params");
}
