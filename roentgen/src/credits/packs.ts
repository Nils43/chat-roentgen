// Credit packs the user can buy. Prices + token counts live client-side for
// display; the price_id comes from env at the server, so these constants are
// only a UI/UX reference. Changing prices means: (1) edit here, (2) adjust
// Stripe prices, (3) rotate STRIPE_PRICE_PACK_* envs.
export interface Pack {
  id: 'pack_1' | 'pack_3' | 'pack_10'
  tokens: number
  priceEur: number
  label: string
  badge?: string
  /** Hidden packs don't show on the main grid — they live behind a small
   *  "or grab a single credit" link. Solo is hidden because the per-credit
   *  cost is identical to the small bundle but the bundle math reads better
   *  for first-time buyers; we don't want to default people into the worst
   *  unit price. */
  discreet?: boolean
}

export const PACKS: Pack[] = [
  { id: 'pack_1', tokens: 1, priceEur: 3, label: 'Solo', discreet: true },
  { id: 'pack_3', tokens: 3, priceEur: 7, label: 'Trio', badge: 'first read + second on us' },
  { id: 'pack_10', tokens: 10, priceEur: 18, label: 'Ten', badge: 'best value' },
]

export function findPack(id: string): Pack | undefined {
  return PACKS.find((p) => p.id === id)
}
