import { ipcMain, IpcMainInvokeEvent } from 'electron'
import * as store from '../services/store'
import {
  buildBaseSystemPrompt,
  buildTaskInstruction,
  generateNotes,
  parseOutput,
  ContentBlock,
  GenerateOptions,
  GenerateConfig
} from '../services/llm'

interface GenerateRequest {
  requestId: string
  unit: string
  topic: string
  options: GenerateOptions
  sourceBlocks: ContentBlock[]
  hasFigures?: boolean
}

function resolveGenerateConfig(): GenerateConfig {
  const apiKey = store.getAnthropicKey()
  if (!apiKey) {
    throw new Error('No Anthropic API key set. Open Settings and add your key to generate notes.')
  }
  return { provider: 'anthropic', apiKey, modelId: store.getAnthropicModelId() }
}

export function registerNotesIpc(): void {
  ipcMain.handle('notes:generate', async (event: IpcMainInvokeEvent, payload: GenerateRequest) => {
    const { requestId, unit, topic, options, sourceBlocks, hasFigures } = payload
    // The decrypted key (if any) lives only in this function's local scope for the duration
    // of the request — never logged, never sent back over IPC to the renderer.
    const config = resolveGenerateConfig()
    const { raw, verified } = await generateNotes(
      config,
      sourceBlocks,
      buildBaseSystemPrompt(),
      buildTaskInstruction(unit, topic, options, hasFigures),
      (fullText) => {
        event.sender.send('notes:generate:progress', { requestId, text: fullText })
      }
    )
    return { ...parseOutput(raw, topic), verified }
  })
}
