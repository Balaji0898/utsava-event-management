/**
 * Layout for the `(auth)` route group.
 *
 * The group previously had no layout at all, which meant `/login` rendered with no
 * `<main>` landmark — axe's `region` rule flags every top-level element on such a
 * page as being outside a landmark, and keyboard/screen-reader users get no way to
 * skip to the content.
 *
 * Deliberately minimal: auth pages intentionally have no navbar, no footer and no
 * Lenis smooth scroll, and that stays true. This adds the landmark and nothing else.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main>{children}</main>;
}
