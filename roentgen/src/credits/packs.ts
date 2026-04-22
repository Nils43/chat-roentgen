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
}

export const PACKS: Pack[] = [
  { id: 'pack_1', tokens: 1, priceEur: 3, label: 'Solo' },
  { id: 'pack_3', tokens: 3, priceEur: 7, label: 'Trio', badge: 'saves €2' },
  { id: 'pack_10', tokens: 10, priceEur: 18, label: 'Ten', badge: 'best value' },
]

export function findPack(id: string): Pack | undefined {
  return PACKS.find((p) => p.id === id)
}
