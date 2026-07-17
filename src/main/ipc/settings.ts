import { ipcMain } from 'electron'
import * as store from '../services/store'

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:get', () => store.getSettingsSummary())

  ipcMain.handle('settings:setNotionToken', (_e, token: string) => {
    store.setNotionToken(token)
    return { ok: true }
  })

  ipcMain.handle('settings:clearNotionToken', () => {
    store.clearNotionToken()
  })

  ipcMain.handle('settings:getUnits', () => store.getUnits())

  ipcMain.handle('settings:setUnits', (_e, units: string[]) => {
    store.setUnits(units)
  })
}
