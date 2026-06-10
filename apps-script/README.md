# Forms backend — Google Apps Script setup

The website's **contact** and **grievance** forms send data to a Google Apps
Script web app that writes to a Google Sheet, emails confirmations, generates
grievance ticket numbers, and answers the grievance status tracker.

You do this once. ~10 minutes.

## 1. Create the Sheet

1. Go to <https://sheets.google.com> (signed in as **rurradvisors@gmail.com**) and create a blank spreadsheet. Name it e.g. `RURR Advisors — Website Submissions`.
2. You don't need to add tabs/columns — the script creates the `Contacts` and `Complaints` tabs (with headers) automatically on the first submission.

## 2. Add the script

1. In that Sheet: **Extensions → Apps Script**.
2. Delete the starter `function myFunction() {}`.
3. Open [`Code.gs`](./Code.gs) from this repo, copy **all** of it, and paste it in.
4. Check the `CONFIG` block at the top (firm name, notify email, resolution-days). Defaults are already set for RURR Advisors.
5. Click **Save** (💾).

## 3. Deploy as a Web app

1. **Deploy → New deployment**.
2. Click the gear ⚙ next to "Select type" → **Web app**.
3. Set:
   - **Description:** `Website forms`
   - **Execute as:** **Me (rurradvisors@gmail.com)**
   - **Who has access:** **Anyone**  ← required so the website can reach it
4. **Deploy**. Approve the permissions prompt (it needs Sheets + Gmail/MailApp access). If you see "Google hasn't verified this app", click **Advanced → Go to … (unsafe)** — it's your own script.
5. Copy the **Web app URL**. It looks like:
   `https://script.google.com/macros/s/AKfycb..................../exec`

## 4. Connect the website

1. Open [`src/_data/site.json`](../src/_data/site.json).
2. Paste your URL as the `forms.endpoint` value:
   ```json
   "forms": {
     "endpoint": "https://script.google.com/macros/s/AKfycb..../exec"
   }
   ```
3. Rebuild: `npm run build`. Done — submissions now flow into your Sheet.

## 5. Test

- **Contact / grievance:** submit each form on the live (or `npm start`) site → a row appears in the Sheet and you get an email. A grievance returns a ticket like `RA-2026-12345`.
- **Tracker:** copy that ticket into "Track a complaint" → it shows the status.

## Working a complaint — the only ongoing upkeep

In the `Complaints` tab, to advance a complaint just set its **Stage** cell:

| Stage | Meaning |
| --- | --- |
| `1` | Received |
| `2` | Under review |
| `3` | Resolved |

When you change Stage, the script auto-fills **Status**, stamps **Last update**,
and (at Stage 3) stamps **Resolved on** — so the tracker *and* the public
complaints tables update on their own. You don't touch any other column.

Complaints that arrive via **SEBI SCORES** (not your website form): add a row
manually, set **Source** = `SEBI (SCORES)`, and fill **Opened** + **Stage**.
A blank Source counts as "Directly from investors".

> The `Source` and `Resolved on` columns are added to the sheet automatically
> the first time the new script runs — you don't need to create them.

## The website tables update themselves

The grievances page reads `?report=complaints` from this web app and renders the
three SEBI tables live (current month by source, monthly trend, annual trend),
aggregated from the `Complaints` sheet. No spreadsheet formulas, no website
edits — update the sheet, refresh the page.

## Updating the script later

After editing `Code.gs`, you must **Deploy → Manage deployments → ✏️ Edit →
Version: New version → Deploy**, or the live URL keeps running the old code.
(The `/exec` URL stays the same, so you don't need to touch `site.json` again.)

## Notes & limits

- Gmail/consumer accounts can send ~100 emails/day via `MailApp` — ample for forms; set `SEND_ACK_EMAILS = false` in `Code.gs` to halve it.
- The Sheet is your record of submissions and is private to your Google account.
- The web app responds with HTTP 200 + JSON flags (Apps Script can't set other status codes), which is why the site checks `{ ok }` / `{ found }`.
