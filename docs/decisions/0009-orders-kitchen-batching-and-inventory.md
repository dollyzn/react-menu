# 0009. Orders, kitchen batching and recipe-based inventory

- Status: Accepted
- Date: 2026-10-20

## Context

The pastry shop needs online and counter orders, a kitchen screen the cook
can read from a distance, and stock that follows what is sold. The cook
asked to see ingredients for each pastry and to make identical pastries
together without making anyone wait too long.

## Decision

- **Orders are priced and validated by the API** from the current menu;
  lines snapshot names and prices. Status changes go through a single state
  machine with history. Business days follow America/Sao_Paulo.
- **Customers are not users**: a store-scoped `customers` row keyed by
  normalized phone (no password), as in anota.ai. The tracking page is
  authorized by an unguessable token.
- **Kitchen progress is per unit** (`prepared_quantity`), so "make 2 of 3"
  is exact. The queue is a pure function: oldest pending unit first, plus
  identical units from at most the next 3 orders (lookahead), never mixing
  different add-ons or lines with notes.
- **Inventory is recipe-based and optional per store**: ingredients consumed
  when an order enters the kitchen, reversed on cancel; movements are signed
  and applied with SQL increments. Stock never blocks an accepted order; it
  only makes items unavailable on the menu when tracking is enabled.

## Alternatives considered

- **Pure FIFO kitchen** (no batching): simpler, but the cook repeats setups
  for identical pastries. **Unbounded batching**: fastest, but starves old
  orders. The bounded lookahead keeps both.
- **Customer accounts with password/OTP**: more friction at the counter;
  OTP can be added later to fight fake orders.
- **Deduct stock at payment or completion**: payment may never come;
  completion is too late for availability.

## Consequences

- Lookahead (3) is a constant in code; make it a store setting if needed.
- Recipes must be kept accurate for stock and kitchen ingredients to be.
