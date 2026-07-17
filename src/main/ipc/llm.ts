import { ipcMain } from 'electron'
import * as store from '../services/store'
import { checkOllamaConnection } from '../services/llm'

export function registerLlmIpc(): void {
  ipcMain.handle('llm:checkConnection', () => {
    return checkOllamaConnection(store.getOllamaBaseUrl(), store.getModelId())
  })
}
