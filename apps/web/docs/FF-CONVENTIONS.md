# Fluid Functionalism — Admin Conventions

Contract for migrating admin feature screens (Stage 5 subagents). Shared foundation is locked — do **not** edit `globals.css`, `components/ui/*`, or `components/admin/ui/*`.

## Variant mapping

| Legacy / shadcn | Canonical FF |
|-----------------|--------------|
| `default`       | `primary`    |
| `outline`       | `tertiary`   |
| `secondary`     | `secondary`  |
| `ghost`         | `ghost`      |
| `destructive`   | `destructive`|
| `link`          | `ghost` + underline classes |

Always pass canonical variants to `<Button>`. Compat aliases (`default`, `outline`) still work but prefer canonical names in new code.

## Icon rule

- **Text buttons:** use `leadingIcon` / `trailingIcon` props — never `<Icon className="size-4" />` as children.
- **Icon-only buttons:** use `size="icon-sm"` | `"icon"` | `"icon-lg"` and pass the icon as **children** (Button constrains SVG size via `[&_svg]:size-*`).

## Field scale (one family)

All controls share:

| Property | Value |
|----------|-------|
| Height   | `h-8` (32px) |
| Type     | `text-[13px]` |
| Radius   | shape-context (`useShape()` → `shape.input` / `shape.button`) |
| Surface  | `shadow-1` ring elevation, no hard `border` |
| Focus    | `ring-1` accent `#6B97FF` |
| Placeholder | `text-muted-foreground` |

Applies to: `Button` (md), `Input`, `Textarea`, `SelectTrigger`, admin `.adm-input`.

## Surfaces & elevation

- Cards, panels, drawers: borderless + `shadow-1` … `shadow-8` (via `<Elevated>` or `shadow-*` utilities).
- **Dividers:** hairline only — `border-border/60`, `bg-border/60`, or `--adm-divider`. No `1px solid` box borders on containers.
- **Hover / selection:** `bg-hover` (+6%) and `bg-active` (+10%) — never ad-hoc `bg-muted/50`.

## Prohibited in feature files

1. Raw `<button>` — use `<Button>` or nav link primitives.
2. Hard `border` on cards/inputs — rely on inherited primitive / `.adm-*` styling.
3. Icon-as-children on text-size buttons.
4. Ad-hoc control heights (`min-h-11`, `h-9`, `size-4` icons on md buttons).
5. Local overrides that fight the unified scale.

## Per-file self-check (must pass before PR)

```bash
# From apps/web — run against your assigned files only
rg '<button' src/components/admin/YourFile.tsx          # → 0 (except none expected)
rg 'size-4' src/components/admin/YourFile.tsx           # → 0 icon-as-children on text buttons
rg 'variant="(default|outline)"' src/components/admin/  # → migrate to primary/tertiary
rg 'border border-' src/components/admin/YourFile.tsx   # → 0 hard container borders
```

## Examples

```tsx
// ✅ Text button with icon
<Button leadingIcon={Plus} size="md" variant="primary">Add item</Button>

// ✅ Icon-only
<Button size="icon-sm" variant="ghost" aria-label="Edit"><Pencil /></Button>

// ❌ Icon as child on text button
<Button><Plus className="size-4" /> Add</Button>

// ❌ Legacy input styling
<input className="min-h-11 rounded-md border ..." />

// ✅ Use shared primitive
<Input value={name} onChange={...} />
```

## Scope reminder

- **Touch:** only your assigned feature-screen files.
- **Do not touch:** `components/consumer/*`, `components/screens/*`, shared UI primitives, `globals.css`.
