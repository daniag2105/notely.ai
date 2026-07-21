// Ad-hoc code-sign the packaged macOS app after electron-builder assembles it.
//
// We build UNSIGNED for now (electron-builder.yml has mac.identity: null — no Apple Developer ID
// yet). But Apple Silicon refuses to launch an arm64 app that isn't at least ad-hoc signed, and
// electron-builder's "skip signing" leaves Electron's raw linker signature with the app's Info.plist
// NOT bound — which modern macOS rejects on launch (SIGKILL, "Code Signature Invalid" / the app just
// never opens). Re-signing the whole bundle ad-hoc here fixes that.
//
// Users still get the Gatekeeper "unidentified developer" prompt on first open (right-click → Open) —
// that only goes away with a real Apple Developer ID signature + notarization, a later step.
const { execFileSync } = require('child_process')
const path = require('path')

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return
  const appName = context.packager.appInfo.productFilename
  const appPath = path.join(context.appOutDir, `${appName}.app`)
  console.log(`  • ad-hoc signing (unsigned build) ${appPath}`)
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' })
}
