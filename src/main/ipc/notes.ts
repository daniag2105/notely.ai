import { ipcMain, IpcMainInvokeEvent } from 'electron'
import * as store from '../services/store'
import {
  buildSystemPrompt,
  buildInstruction,
  generateNotes,
  parseOutput,
  ContentBlock,
  GenerateOptions
} from '../services/llm'

interface GenerateRequest {
  requestId: string
  unit: string
  topic: string
  options: GenerateOptions
  sourceBlocks: ContentBlock[]
}

export function registerNotesIpc(): void {
  ipcMain.handle('notes:generate', async (event: IpcMainInvokeEvent, payload: GenerateRequest) => {
    const { requestId, unit, topic, options, sourceBlocks } = payload
    const content: ContentBlock[] = [
      ...sourceBlocks,
      { type: 'text', text: buildInstruction(unit, topic, options) }
    ]
    const modelId = store.getModelId()
    const baseUrl = store.getOllamaBaseUrl()
    const raw = await generateNotes(baseUrl, modelId, content, buildSystemPrompt(), (fullText) => {
      event.sender.send('notes:generate:progress', { requestId, text: fullText })
    })
    return parseOutput(raw, topic)
  })
}
