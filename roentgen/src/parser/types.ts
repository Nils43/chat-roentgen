// Core data structures shared by parser and analysis.

export interface Message {
  ts: Date
  author: string
  text: string
}

export interface ParsedChat {
  messages: Message[]
  participants: string[] // unique authors, insertion order
  source: 'whatsapp' | 'telegram' | 'instagram' | 'discord' | 'unknown'
  locale: 'de' | 'en' | 'mixed'
  warnings: string[]
}
