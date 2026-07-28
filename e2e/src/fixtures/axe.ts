import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { acceptedRulesFor, axeTags, globalExcludes } from '@data/a11y-rules';

export type AxeViolation = {
  id: string;
  impact: string | null | undefined;
  help: string;
  helpUrl: string;
  nodes: { target: string[]; html: string; failureSummary?: string }[];
};

export type AxeResult = {
  /** Violations that must fail the test. */
  blocking: AxeViolation[];
  /** Violations accepted by the register in `src/data/a11y-rules.ts`. */
  accepted: AxeViolation[];
  /** Rules the register excuses that no longer reproduce — the register has rotted. */
  staleExceptions: string[];
  /** best-practice findings: reported, never blocking. */
  advisory: AxeViolation[];
};

/**
 * axe-core wrapper.
 *
 * Two design choices worth stating:
 *
 *  1. **Rules are never globally disabled to make a page pass.** Every accepted
 *     violation is enumerated per route in `knownViolations`, with a reason and
 *     the fix that retires it. A blanket `.disableRules()` would hide the next
 *     regression too.
 *
 *  2. **Stale exceptions are reported.** If the register excuses a rule that no
 *     longer fires, the spec says so — otherwise the register silently grows
 *     stale and starts excusing genuine new failures. The Phase 3 hooks are
 *     expected to retire most of the current entries, so this matters
 *     immediately.
 */
export class Axe {
  constructor(private readonly page: Page) {}

  /**
   * @param route the route being scanned, matched against the register
   * @param opts.include restrict the scan to a selector (for component-level scans)
   * @param opts.exclude extra selectors to skip beyond the global list
   */
  async scan(
    route: string,
    opts: { include?: string; exclude?: string[] } = {},
  ): Promise<AxeResult> {
    const accepted = new Set(acceptedRulesFor(route));

    const build = (tags: readonly string[]) => {
      /**
       * `@axe-core/playwright` declares its own `playwright-core` dependency, which resolves to a
       * newer version than our pinned @playwright/test 1.59.1. The two `Page` types are
       * structurally identical for everything axe uses — it only calls `evaluate` and `frames` —
       * but the newer one declares extra members (`hideHighlight`, `localStorage`,
       * `sessionStorage`), so TypeScript rejects the assignment.
       *
       * Casting here rather than loosening the pin: the pin exists because 1.62 cannot install
       * chromium on macOS 13. See the note in package.json.
       */
      let builder = new AxeBuilder({ page: this.page as unknown as ConstructorParameters<typeof AxeBuilder>[0]['page'] }).withTags([...tags]);
      if (opts.include) builder = builder.include(opts.include);
      for (const sel of [...globalExcludes, ...(opts.exclude ?? [])]) builder = builder.exclude(sel);
      return builder;
    };

    const blockingRun = await build(axeTags.blocking).analyze();
    const advisoryRun = await build(axeTags.advisory).analyze();

    const violations = blockingRun.violations as unknown as AxeViolation[];
    const firedIds = new Set(violations.map((v) => v.id));

    return {
      blocking: violations.filter((v) => !accepted.has(v.id)),
      accepted: violations.filter((v) => accepted.has(v.id)),
      staleExceptions: [...accepted].filter((id) => !firedIds.has(id)),
      advisory: advisoryRun.violations as unknown as AxeViolation[],
    };
  }
}

/** Render violations as something a developer can act on from the CI log. */
export function formatViolations(violations: readonly AxeViolation[]): string {
  if (!violations.length) return 'none';
  return violations
    .map((v) => {
      const targets = v.nodes
        .slice(0, 5)
        .map((n) => `      ${n.target.join(' ')}  →  ${n.html.slice(0, 120)}`)
        .join('\n');
      const more = v.nodes.length > 5 ? `\n      … and ${v.nodes.length - 5} more node(s)` : '';
      return `  [${v.impact ?? 'unknown'}] ${v.id} — ${v.help}\n    ${v.helpUrl}\n${targets}${more}`;
    })
    .join('\n\n');
}
