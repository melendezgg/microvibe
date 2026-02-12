export function GET({ json }) {
  json(200, { ok: true, service: "microvibe" });
}
