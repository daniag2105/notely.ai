// Notely — dusty rose theme.
//
// These are CSS-variable references, not literal colors: the actual light/dark values live in
// assets/base.css under :root and :root[data-theme="light"]. Keeping the same keys here means every
// `T.bg`, `T.text`, `1px solid ${T.line}`, etc. across the app resolves against whichever palette is
// active — so light/dark switches at runtime with no component changes. See lib/theme-mode.ts.
export const T = {
  bg: 'var(--bg)',
  panel: 'var(--panel)',
  panelHi: 'var(--panelHi)',
  line: 'var(--line)',
  lineSoft: 'var(--lineSoft)',
  text: 'var(--text)',
  dim: 'var(--dim)',
  faint: 'var(--faint)',

  // primary accent — Unit chip, Generate button, focus rings, progress, links
  blue: 'var(--blue)',
  blueBg: 'var(--blueBg)',

  // Topic chip — kept as its own hue family for scannability against the rose primary
  teal: 'var(--teal)',
  tealBg: 'var(--tealBg)',

  // slides / options accent
  amber: 'var(--amber)',
  amberBg: 'var(--amberBg)',

  // Page chip — nudged warm/magenta to sit next to the rose primary
  purple: 'var(--purple)',
  purpleBg: 'var(--purpleBg)',

  danger: 'var(--danger)',

  // code-block / raw-markdown surface (a touch off the panel tone in each mode)
  codeBg: 'var(--codeBg)',
  // text that sits on a solid teal fill (dark on bright teal in dark mode; white on deep teal in light)
  tealOn: 'var(--tealOn)'
}
