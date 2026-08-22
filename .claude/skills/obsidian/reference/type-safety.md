# Type Safety

Type safety is essential for reliable Obsidian plugins. Use proper type narrowing and avoid unsafe type casts.

**Not applicable as written to this repo.** Conditional Properties ships plain JavaScript (`main.js`) with no TypeScript compiler, so there is no `any` to forbid and no cast syntax to avoid — there's simply no static type checker in the loop at all. The principles below still matter, just enforced by hand instead of by the compiler:
- Instead of `instanceof` narrowing a compiler-checked type, `instanceof` here is the *only* runtime guard you get — treat it as mandatory before calling `TFile`/`TFolder`-only APIs.
- Instead of avoiding `any`, validate shapes defensively: check `typeof`, guard against `undefined`/missing keys, and don't assume a rule object or frontmatter value has the shape you expect — nothing will catch a wrong assumption before it throws at runtime.
- `const`/`let` over `var` still applies verbatim; it's plain JS scoping, not a TypeScript feature.

## Avoid Type Casting to TFile/TFolder
Rule: `obsidianmd/no-tfile-tfolder-cast`

❌ **INCORRECT**:
```typescript
const file = abstractFile as TFile;
const folder = <TFolder>abstractFile;
```

✅ **CORRECT**:
```typescript
if (abstractFile instanceof TFile) {
  // TypeScript now knows it's a TFile
  const file = abstractFile;
}

if (abstractFile instanceof TFolder) {
  const folder = abstractFile;
}
```

Rationale: Type casting bypasses type safety. Use `instanceof` for safe type narrowing.

---

## Avoid TypeScript `any`
Rule: Type safety best practice

❌ **INCORRECT**:
```typescript
function processData(data: any) {
  return data.value;
}
```

✅ **CORRECT**:
```typescript
// Use specific types
function processData(data: FileData) {
  return data.value;
}

// Or use unknown for truly unknown data
function processData(data: unknown) {
  if (typeof data === 'object' && data !== null && 'value' in data) {
    return (data as { value: string }).value;
  }
}
```

Rationale: `any` bypasses type checking. Use specific types or `unknown` for type safety.

---

## Prefer const and let over var
Rule: Official guidelines (TypeScript best practice)

❌ **INCORRECT**:
```typescript
var count = 0;
var settings = {};
```

✅ **CORRECT**:
```typescript
let count = 0;
const settings = {};
```

Rationale: Use `const` for values that won't be reassigned and `let` for values that will. Avoid `var` for better scoping and fewer bugs.
