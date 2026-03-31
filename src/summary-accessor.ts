export interface WorkSummary {
  title?: string
  body?: string
  diffs?: Array<{ file: string; changes?: string }>
  additions?: number
  deletions?: number
  files?: number | string[]
}

export function getSummaryFromEvent(event: any): WorkSummary | null {
  if (event.type === 'message.updated') {
    const info = event.properties?.info
    if (info?.summary) return extractSummaryFromMessage(info.summary)
    if (info?.title || info?.body) return { title: info.title, body: info.body }
  }

  if (event.type === 'session.updated') {
    const info = event.properties?.info
    if (info?.summary) return extractSummaryFromSession(info.summary)
    if (info?.title) return { title: info.title }
  }

  return null
}

function extractSummaryFromMessage(summary: any): WorkSummary {
  return {
    title: summary.title,
    body: summary.body,
    diffs: summary.diffs,
    files: summary.diffs?.map((d: any) => d.file) || []
  }
}

function extractSummaryFromSession(summary: any): WorkSummary {
  return {
    additions: summary.additions,
    deletions: summary.deletions,
    files: summary.files,
    diffs: summary.diffs
  }
}
