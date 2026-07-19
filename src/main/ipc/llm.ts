import { ipcMain } from 'electron'
import * as store from '../services/store'
import { checkAnthropicKey } from '../services/llm'

export function registerLlmIpc(): void {
  ipcMain.handle('llm:checkConnection', () => {
    const apiKey = store.getAnthropicKey()
    if (!apiKey) return { ok: false, error: 'No API key set. Add your Anthropic key in Settings.' }
    return checkAnthropicKey(apiKey, store.getAnthropicModelId())
  })
}
