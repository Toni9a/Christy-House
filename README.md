# Christy’s House

A private web app for the house, shared by invite link. Everyone who opens the link can:

- **Browse rooms.** Living room, Kitchen, Bedroom 1 and Bedroom 2 to start (add, rename or delete as you like). A strip under the header jumps into any room.
- **Add photos of each room** as it is now. Tap one to see it full screen.
- **Add ideas for each room.** Snap or upload a photo of a bed, a sofa or a lamp you like, with a link and price if you have them. Anyone can add them.
- **Open any idea** to see it big, **♥ love it** or mark it **not for me**, and **comment** ("love this colour", "found it cheaper: link").
- **Check it with Google**: open the photo in Google Lens or Google Shopping, or (with a Google API key) ask “Where is this from?” to find shops with the same picture.
- **Find it cheaper**: Claude searches the web for the same thing within your budget, sliders and all.
- **Compare** up to four ideas side by side: price, size, whether it fits, who loves it, latest comment.
- **Upload the LiDAR scan** of each room (GLB). It shows in 3D and fills in the room’s measurements.
- See the **Value** tab: the working valuation for 10 Amherst Close, comparable sales on one chart, and known running costs. Edit `lib/valuation.ts` to update it.
- Optionally **text it** photos or links (Twilio) and **preview items in your room** (Gemini).

Everyone types their first name once on each device; it’s shown on what they add and say. There are no accounts or passwords.

## Put it online with Vercel

1. **Connect the repo.** The `christy-house` Vercel project already deploys this repo. `vercel.json` tells it this is a Next.js app.
2. **Add storage.** In the project, open *Storage*:
   - *Create → Neon* (Postgres). This sets `DATABASE_URL` for you.
   - *Create → Blob*, access **Private**. This sets `BLOB_READ_WRITE_TOKEN` for you.
   The tables and the four starter rooms are created automatically the first time the site runs.
3. **Add settings** under *Settings → Environment Variables*:
   - `ANTHROPIC_API_KEY`: your Claude API key
   - `INVITE_CODE`: a long random phrase, e.g. `oak-lamp-4821-velvet`
   - `PUBLIC_BASE_URL`: the site’s address, e.g. `https://christys-house.vercel.app`
   - Optional: `GOOGLE_API_KEY` (enable the Cloud Vision API on it), `GEMINI_API_KEY`
4. **Deploy**, then share this link with the people you want in:
   `https://<your-site>/join/<INVITE_CODE>`
   Opening it lets that device in for a year. Anyone without it sees a “this house is private” page. To shut everyone out, change `INVITE_CODE` and share the new link.

Uploads go straight from the phone to Vercel Blob. Photos are shrunk to 2000px first, so they’re quick. LiDAR scans can be up to 300 MB.

## Run it on your own computer

```bash
cp .env.example .env.local     # ANTHROPIC_API_KEY is enough to start
npm install
npm run dev                     # http://localhost:3000
```

Without `DATABASE_URL`, everything is saved to a JSON file in `.data/`. Set `DATABASE_URL` to any Postgres database to use that instead. Without a Blob token, files stay on your disk.

## How it’s built

| Piece | Where | Notes |
|---|---|---|
| Storage | `lib/store.ts`, `lib/db/` | One interface, two versions: Postgres + Vercel Blob (`postgres.ts`) and a local JSON file (`json.ts`). The schema is in `lib/db/schema.ts` and applies itself. |
| Invite link | `middleware.ts`, `app/join/[code]` | Checks a year-long cookie set by the join link. The SMS webhook and file URLs are left open: files have long random names, and Google Lens has to be able to fetch them. |
| Names | `lib/identity.ts`, `components/People.tsx` | A `who` cookie; comments can only be deleted by the person who wrote them. |
| Uploads | `lib/upload.ts`, `app/api/uploads` | Browser shrinks photos, then uploads straight to Blob with a one-time token. |
| Items, loves, comments | `app/api/items/**`, `components/ItemBoard.tsx`, `ItemDetail.tsx` | Statuses: Idea, To buy, Ordered, Have it. |
| Room photos | `components/RoomPhotos.tsx`, `app/api/rooms/[id]/photos` | |
| Compare | `app/compare` | Marks the cheapest and the most loved. |
| Google checks | `app/api/items/[id]/google`, `lib/lens.ts` | Google has no official Lens API, so the Lens button opens the photo in Lens directly. “Where is this from?” uses Cloud Vision web detection. |
| Product finder | `lib/finder.ts` | Claude (`claude-opus-5-5`) with web search and web fetch, returning structured results. If Claude declines a request, the API retries on a fallback model. |
| Scans | `components/ScanViewer.tsx` | GLB in a 3D viewer; its bounding box gives the room size. |
| Texting | `app/api/sms/route.ts` | Twilio webhook. Signature-checked; only `ALLOWED_PHONE_NUMBERS` get replies. |

## Scanning the rooms

Use Polycam, 3D Scanner App or Scaniverse and export each room as **GLB** (metres). Open the room, scroll to *Measurements & 3D scan*, tap **Upload scan**, then **Use scan measurements**. For L-shaped rooms the numbers are the outer box, so adjust by hand if needed.
