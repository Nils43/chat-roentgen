import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getUnlock } from '../_kv'

// Read-only status endpoint. The client polls this after returning from Stripe
// to find out whether the webhook has marked their token as paid. Returns a
// minimal shape — no secrets, no internal fields beyond paid/used/module.

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method_not_allowed' })
    return
  }

  const token = req.query.token
  const tokenStr = Array.isArray(token) ? token[0] : token
  if (!tokenStr || tokenStr.length < 16) {
    res.status(400).json({ error: 'invalid_token' })
    return
  }

  const record = await getUnlock(tokenStr)
  if (!record) {
    res.status(404).json({ paid: false })
    return
  }

  res.status(200).json({
    paid: record.paid,
    used: record.used,
    module: record.module,
    spent: record.spent ?? [],
  })
}
