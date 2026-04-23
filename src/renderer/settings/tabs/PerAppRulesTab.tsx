export default function PerAppRulesTab() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Per-App Rules</h2>
      <p className="text-ink-45 text-sm">
        OpenFlow automatically detects the app you're typing in and adjusts tone and format.
      </p>
      <div className="space-y-2 text-sm">
        {[
          ['Slack, Discord, iMessage', 'Casual messaging — lowercase OK, no formalities'],
          ['Gmail, Outlook, Mail', 'Email prose — proper greetings and paragraphs'],
          ['Cursor, VS Code, Xcode', 'Dev mode — preserve camelCase, file paths, jargon'],
          ['Notion, Obsidian, Word', 'Document prose — structured, punctuated'],
        ].map(([apps, desc]) => (
          <div key={apps} className="p-3 rounded-lg bg-ink-08 border border-ink-08">
            <div className="font-medium text-ink">{apps}</div>
            <div className="text-ink-45 text-xs mt-0.5">{desc}</div>
          </div>
        ))}
      </div>
      <p className="text-ink-45 text-xs">Custom per-app prompt overrides coming in a future update.</p>
    </div>
  )
}
