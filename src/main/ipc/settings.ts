import { ipcMain } from 'electron'
import * as store from '../services/store'
import * as backend from '../services/backend'

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:get', () => store.getSettingsSummary())

  ipcMain.handle('settings:setNotionToken', async (_e, token: string) => {
    store.setNotionToken(token)
    // Persist to the signed-in account so a pasted token follows the user across devices.
    await backend.saveNotion(token, '')
    return { ok: true }
  })

  ipcMain.handle('settings:clearNotionToken', () => {
    store.clearNotionToken()
  })

  ipcMain.handle('settings:getUnits', () => store.getUnits())

  ipcMain.handle('settings:setUnits', (_e, units: string[]) => {
    store.setUnits(units)
  })

  ipcMain.handle('settings:setProvider', (_e, provider: store.Provider) => {
    store.setProvider(provider)
  })

  ipcMain.handle('settings:setAnthropicModelId', (_e, modelId: string) => {
    store.setAnthropicModelId(modelId)
  })
}
