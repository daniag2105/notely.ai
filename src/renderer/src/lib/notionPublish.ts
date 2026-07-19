import type { PickerPage } from '../components/NotionPagePicker'
import type { PickerState } from '../App'

export type OpenPicker = (cfg: Omit<PickerState, 'resolve' | 'reject'>) => Promise<PickerPage>

interface PublishArgs {
  unit: string
  topic: string
  title: string
  notes: string
}

// Resolve-unit -> resolve/create-topic -> createNotesPage, shared by both the single-lecture
// Send to Notion button and the batch "Publish All" loop. Callers are responsible for checking
// window.api.notion.isConfigured() first — batch mode wants to check that once before looping
// over many items rather than failing on item one, so it's kept out of this shared helper.
export async function publishToNotion(
  { unit, topic, title, notes }: PublishArgs,
  openPicker: OpenPicker
): Promise<{ id: string; url: string }> {
  let unitPage = await window.api.notion.resolveUnitPage(unit)
  if (!unitPage) {
    unitPage = await openPicker({
      heading: `Find the Notion page for "${unit}"`,
      subheading: 'Pick the top-level page for this unit. It must already be shared with your integration.',
      initialQuery: unit,
      fetchResults: (q) => window.api.notion.searchTopLevelPages(q)
    })
    await window.api.notion.mapUnitPage(unit, unitPage.id)
  }
  const resolvedUnitPage = unitPage

  let topicPage = await window.api.notion.resolveTopicPage(resolvedUnitPage.id, unit, topic)
  if (!topicPage) {
    topicPage = await openPicker({
      heading: `Find the "${topic}" toggle heading under ${unit}`,
      subheading: 'Pick the existing topic toggle heading, or create a new one.',
      initialQuery: topic,
      fetchResults: () => window.api.notion.listChildPages(resolvedUnitPage.id),
      createLabel: `Create "${topic}" toggle heading here`,
      onCreateNew: async () => {
        const p = await window.api.notion.createTopicPage(resolvedUnitPage.id, topic)
        await window.api.notion.mapTopicPage(unit, topic, p.id)
        return p
      }
    })
  }

  return window.api.notion.createNotesPage(resolvedUnitPage.id, title, notes)
}
