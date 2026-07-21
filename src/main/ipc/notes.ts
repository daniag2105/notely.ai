import { ipcMain, IpcMainInvokeEvent } from 'electron'
import * as backend from '../services/backend'

// Generation is now a metered, server-side call: the renderer's payload is forwarded to the Notely
// backend (which holds the operator's Anthropic key and enforces the free / Pro / Jots limits), and
// streamed progress is relayed back over the same 'notes:generate:progress' channel the renderer
// already listens on — so the generation UI is unchanged. A paywall or missing session comes back as
// a structured result the renderer can act on, rather than a thrown generic error.
interface GenerateRequest {
  requestId: string
  unit: string
  topic: string
  options: {
    depth: 'concise' | 'standard' | 'detailed'
    mode: 'notes' | 'math' | 'examples'
    custom: string
  }
  sourceBlocks: backend.SourceBlock[]
  hasFigures?: boolean
  isBatch?: boolean
}

export function registerNotesIpc(): void {
  ipcMain.handle('notes:generate', async (event: IpcMainInvokeEvent, payload: GenerateRequest) => {
    const { requestId, unit, topic, options, sourceBlocks, hasFigures, isBatch } = payload
    try {
      const result = await backend.generate(
        { unit, topic, options, sourceBlocks, hasFigures: !!hasFigures, isBatch: !!isBatch },
        (fullText) => {
          event.sender.send('notes:generate:progress', { requestId, text: fullText })
        }
      )
      return result
    } catch (e) {
      if (e instanceof backend.PaywallError) return { paywall: e.paywall }
      if (e instanceof backend.AuthRequiredError) return { authRequired: true, error: e.message }
      throw e
    }
  })
}
