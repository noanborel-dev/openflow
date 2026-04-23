export default function PerAppRulesTab() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Per-App Rules</h2>
      <p className="text-white/50 text-sm">
        OpenFlow automatically detects the app you're typing in and adjusts tone and format.
      </p>
      <div className="space-y-2 text-sm">
        {[
          ['Slack, Discord, iMessage', 'Casual messaging — lowercase OK, no formalities'],
          ['Gmail, Outlook, Mail', 'Email prose — proper greetings and paragraphs'],
          ['Cursor, VS Code, Xcode', 'Dev mode — preserve camelCase, file paths, jargon'],
          ['Notion, Obsidian, Word', 'Document prose — structured, punctuated'],
        ].map(([apps, desc]) => (
          <div key={apps} className="p-3 rounded-lg bg-white/5 border border-white/10">
            <div className="font-medium text-white/80">{apps}</div>
            <div className="text-white/40 text-xs mt-0.5">{desc}</div>
          </div>
        ))}
      </div>
      <p className="text-white/30 text-xs">Custom per-app prompt overrides coming in a future update.</p>
    </div>
  )
}
