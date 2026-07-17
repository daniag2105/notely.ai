import type { NotelyApi } from './index'

declare global {
  interface Window {
    api: NotelyApi
  }
}
