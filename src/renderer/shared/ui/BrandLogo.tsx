// Real brand logos imported as image assets so vite hashes + bundles
// them. Replaces the simple-icons SVG paths which (1) had wrong /
// outdated marks for several brands and (2) were missing Slack and
// other trademark-removed icons entirely.
import imessage from '../logos/imessage.png'
import gmail from '../logos/gmail.webp'
import notion from '../logos/notion.png'
import slack from '../logos/slack.png'
import claude from '../logos/claude.png'
import chatgpt from '../logos/chatgpt.png'
import cursor from '../logos/cursor.png'

export type BrandSlug =
  | 'imessage' | 'gmail' | 'notion' | 'slack'
  | 'claude' | 'chatgpt' | 'cursor'

const SOURCES: Record<BrandSlug, string> = {
  imessage, gmail, notion, slack, claude, chatgpt, cursor,
}

const TITLES: Record<BrandSlug, string> = {
  imessage: 'iMessage',
  gmail: 'Gmail',
  notion: 'Notion',
  slack: 'Slack',
  claude: 'Claude',
  chatgpt: 'ChatGPT',
  cursor: 'Cursor',
}

interface Props {
  brand: BrandSlug
  size?: number
  className?: string
}

export function BrandLogo({ brand, size = 22, className = '' }: Props) {
  return (
    <img
      src={SOURCES[brand]}
      alt={TITLES[brand]}
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, objectFit: 'contain' }}
      draggable={false}
    />
  )
}