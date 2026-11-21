/** What a partner may sell (ADR 0024). */
const PartnerCatalogMode = {
  /** The whole menu. */
  ALL: 'all',
  /** The chosen categories, minus the items excluded from them. */
  SELECTED: 'selected',
} as const

type PartnerCatalogMode = (typeof PartnerCatalogMode)[keyof typeof PartnerCatalogMode]

export default PartnerCatalogMode
