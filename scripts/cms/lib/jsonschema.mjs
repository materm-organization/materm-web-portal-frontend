// Minimal JSON Schema (2020-12 subset) validator, no dependencies. Covers every keyword the
// section schemas in src/content/cms-seed/schemas use: type, enum, const, required, properties,
// additionalProperties, propertyNames, items, minItems/maxItems, uniqueItems, minLength/maxLength,
// minimum/maximum, pattern, $ref (local "#/..."), allOf/anyOf/oneOf/not, if/then/else.
// Unknown keywords (x-*, title, description, default, format, ...) are ignored.
// ajv is NOT a dependency of this repo; this is a structural checker, not a full validator.

const typeOf = (v) =>
  v === null ? "null" : Array.isArray(v) ? "array" : Number.isInteger(v) ? "integer" : typeof v;

function typeMatches(v, t) {
  const actual = typeOf(v);
  if (t === "number") return actual === "number" || actual === "integer";
  return actual === t;
}

function resolveRef(root, ref) {
  if (!ref.startsWith("#/")) throw new Error(`unsupported $ref ${ref}`);
  let cur = root;
  for (const part of ref.slice(2).split("/")) cur = cur?.[part.replace(/~1/g, "/").replace(/~0/g, "~")];
  if (cur === undefined) throw new Error(`unresolved $ref ${ref}`);
  return cur;
}

const deepEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Returns an array of error strings ("<path>: <message>"); empty = valid. */
export function validate(schema, value, root = schema) {
  const errors = [];
  check(schema, value, "", root, errors);
  return errors;
}

function check(schema, v, path, root, errors) {
  if (schema === true || schema === undefined) return;
  if (schema === false) return void errors.push(`${path || "/"}: not allowed`);
  const at = path || "/";
  if (schema.$ref) check(resolveRef(root, schema.$ref), v, path, root, errors);

  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => typeMatches(v, t))) {
      errors.push(`${at}: expected ${types.join("|")}, got ${typeOf(v)}`);
      return;
    }
  }
  if (schema.const !== undefined && !deepEqual(schema.const, v)) errors.push(`${at}: must equal ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.some((e) => deepEqual(e, v))) errors.push(`${at}: must be one of ${JSON.stringify(schema.enum)}`);

  if (typeof v === "string") {
    if (schema.minLength !== undefined && [...v].length < schema.minLength) errors.push(`${at}: shorter than ${schema.minLength}`);
    if (schema.maxLength !== undefined && [...v].length > schema.maxLength) errors.push(`${at}: longer than ${schema.maxLength}`);
    if (schema.pattern && !new RegExp(schema.pattern, "u").test(v)) errors.push(`${at}: does not match ${schema.pattern}`);
  }
  if (typeof v === "number") {
    if (schema.minimum !== undefined && v < schema.minimum) errors.push(`${at}: below minimum ${schema.minimum}`);
    if (schema.maximum !== undefined && v > schema.maximum) errors.push(`${at}: above maximum ${schema.maximum}`);
  }
  if (Array.isArray(v)) {
    if (schema.minItems !== undefined && v.length < schema.minItems) errors.push(`${at}: fewer than ${schema.minItems} items`);
    if (schema.maxItems !== undefined && v.length > schema.maxItems) errors.push(`${at}: more than ${schema.maxItems} items`);
    if (schema.uniqueItems && new Set(v.map((x) => JSON.stringify(x))).size !== v.length) errors.push(`${at}: items must be unique`);
    if (schema.items) v.forEach((item, i) => check(schema.items, item, `${path}/${i}`, root, errors));
  }
  if (v && typeof v === "object" && !Array.isArray(v)) {
    for (const r of schema.required ?? []) if (!(r in v)) errors.push(`${at}: missing required "${r}"`);
    const props = schema.properties ?? {};
    for (const [k, sub] of Object.entries(props)) if (k in v) check(sub, v[k], `${path}/${k}`, root, errors);
    for (const k of Object.keys(v)) {
      if (schema.propertyNames) check(schema.propertyNames, k, `${path}/${k}(name)`, root, errors);
      if (!(k in props)) {
        if (schema.additionalProperties === false) errors.push(`${at}: unexpected property "${k}"`);
        else if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
          check(schema.additionalProperties, v[k], `${path}/${k}`, root, errors);
        }
      }
    }
  }
  for (const s of schema.allOf ?? []) check(s, v, path, root, errors);
  if (schema.anyOf && !schema.anyOf.some((s) => validate(s, v, root).length === 0)) errors.push(`${at}: matches none of anyOf`);
  if (schema.oneOf && schema.oneOf.filter((s) => validate(s, v, root).length === 0).length !== 1) errors.push(`${at}: must match exactly one of oneOf`);
  if (schema.not && validate(schema.not, v, root).length === 0) errors.push(`${at}: must not match "not" schema`);
  if (schema.if) {
    const ok = validate(schema.if, v, root).length === 0;
    if (ok && schema.then) check(schema.then, v, path, root, errors);
    if (!ok && schema.else) check(schema.else, v, path, root, errors);
  }
}
