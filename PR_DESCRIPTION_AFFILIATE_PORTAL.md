## feat: Affiliate Portal — Split Revenue Share Tracker

### Description
Adds a dedicated **Affiliate Portal** for partners to track their 0.1% revenue share from splits they referred through the V3 Splitter contract.

### Changes

**Backend**
- Added `getAffiliateSplits()` to `AffiliateService` — fetches all splits where the caller was the `affiliate_id`, with the 0.1% cut computed per split
- New endpoint: `GET /api/v2/affiliate/splits?address=<G...>`

**Frontend**
- `use-affiliate-portal.ts` hook — parallel fetch of earnings summary + referred splits
- `/dashboard/affiliate` page with:
  - Stats cards: Total Earned, Pending Claim, Referred Splits count
  - Splits table: sender, date, split total, and affiliate cut per row
- Sidebar nav item added under Splitter

### Labels
`[Frontend]` `[Backend]` `Data-Viz` `Medium`
