BUSINESS CENTRAL — ISOLATED INVENTORY DEMO

IMPORTANT
- This is a browser-only demonstration build.
- It does not connect to your original backend or any live database.
- Records are stored in this browser's localStorage.
- Do not use this browser-only demo as the permanent production system or as the only copy of business records.
- Sample opening balances and historical sample transactions are illustrative. New transactions use the stock movement logic described below.

INVENTORY POSTING FLOW
1. Purchase: saving a supplier purchase increases the selected raw-material inventory quantity.
2. Production planning: saving a production order does not change stock.
3. Issue Materials: use the action on a production record to deduct its required raw materials. The issue can only be posted once, and insufficient stock is blocked.
4. Receive Finished: after materials are issued, enter the accepted production quantity. This increases Finished Goods stock.
5. Packing: save an in-progress packing entry without stock impact. When it is changed to Completed, accepted finished goods are deducted and the same quantity is added to Packed Goods.
6. Shipment: saving a dispatch deducts the dispatched quantity from Packed Goods. Insufficient packed stock is blocked.

STOCK AUDIT
- Inventory Register includes a Stock Movement Ledger.
- Purchases, material issues, production receipts, packing transfers and shipment dispatches create movement rows.
- Posted production, packing and shipment records are protected from destructive edits/deletes in this demo so stock history is not silently changed.
- New purchase records can be edited or deleted; the original sample purchase is an opening historical record and is not linked to a movement.
- Opening sample quantities are starting balances and do not create ledger rows.

RUN LOCALLY ON MAC
1. Unzip this package.
2. Open Terminal and change into the frontend folder:
   cd "/path/to/business-central-demo/frontend"
3. Install dependencies:
   npm ci
4. Start the local demo:
   npm run dev
5. Open the local URL printed by Vite (normally http://localhost:5173).

RENDER STATIC SITE
- Root Directory: frontend
- Build Command: npm ci && npm run build
- Publish Directory: dist
- Add a rewrite: /* -> /index.html (Rewrite)

RESET DEMO DATA
The browser-only demo saves data in localStorage under the key:
business-central-demo-v1
Clearing this site's local storage resets the browser demo to its sample data.

VERIFICATION
The inventory API logic was exercised with a local Node test:
- raw-material issue deducted stock
- duplicate material issue was blocked
- production receipt increased finished goods
- packing completion transferred stock to Packed Goods
- shipment dispatch reduced Packed Goods
- final balances and ledger entries were checked

The Vite production build could not be run in the packaging environment because npm dependency installation timed out. Run `npm ci && npm run build` on your Mac before publishing.
