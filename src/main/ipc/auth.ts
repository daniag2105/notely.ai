import { ipcMain } from 'electron'
import * as backend from '../services/backend'

// Account IPC — sign up / in / out and fetch the current account (plan, Jots, free-tier usage,
// unlocked flags). The renderer uses these to gate features and show the paywall. Auth results and
// the account summary are safe to return to the renderer; the token itself never crosses IPC (it
// stays encrypted in the main-process store and is attached to backend requests there).
export function registerAuthIpc(): void {
  ipcMain.handle('auth:register', (_e, email: string, password: string) =>
    backend.register(email, password)
  )
  ipcMain.handle('auth:login', (_e, email: string, password: string) =>
    backend.login(email, password)
  )
  ipcMain.handle('auth:logout', () => {
    backend.logout()
    return { ok: true }
  })
  ipcMain.handle('auth:me', () => backend.me())
}
