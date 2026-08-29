# Sophie & Kieran — Photo & Video Upload

Standalone site for guests to upload wedding photos/videos to Supabase Storage.

## First-time setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Confirm `.env` has your Supabase credentials** (already filled in — reuses the
   same Supabase project as the main wedding site, same `wedding-photos` bucket
   and upload policy already set up there).

3. **One extra Supabase step for the gallery to work.** The upload-only policy
   from the main site lets guests *add* files but not *view* them — the gallery
   needs read access too. In your Supabase dashboard:

   a) **Storage → `wedding-photos` bucket → bucket settings → toggle "Public bucket" ON.**
      This lets photo/video URLs be loaded directly in the browser.

   b) **SQL Editor → run:**
      ```sql
      create policy "Allow public read of wedding-photos"
      on storage.objects for select
      to anon
      using ( bucket_id = 'wedding-photos' );
      ```
      This lets the gallery list and display files. It only grants viewing —
      guests still can't delete or overwrite anything.

   Since this makes uploaded photos/videos viewable by anyone with the link
   (necessary for a shared gallery guests can browse), don't upload anything
   here you wouldn't want visible to all guests.

3. **Set your GitHub repo name in two places** before deploying:
   - `package.json` → `"homepage"` → replace `YOUR-GITHUB-USERNAME` and `YOUR-REPO-NAME`
   - `vite.config.js` → `base:` → replace `YOUR-REPO-NAME`

   Example: if your repo will be `github.com/arose20/wedding-photos`, then:
   - `homepage`: `https://arose20.github.io/wedding-photos/`
   - `base`: `/wedding-photos/`

   (This step matters — without it, the deployed site will load a blank page
   because assets will be requested from the wrong path.)

## Deploying to GitHub Pages

1. Create a new **empty** repository on GitHub (no README/license), matching
   the name you used above.
2. Push this project to it:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR-GITHUB-USERNAME/YOUR-REPO-NAME.git
   git push -u origin main
   ```
3. Deploy:
   ```bash
   npm run deploy
   ```
   This builds the site and pushes it to a `gh-pages` branch automatically.
4. In your repo on GitHub: **Settings → Pages** → under "Build and deployment",
   set **Source** to "Deploy from a branch", and **Branch** to `gh-pages` / `root`.
5. Your site will be live at the `homepage` URL within a minute or two.

## Making changes later

Edit the code, then just run `npm run deploy` again to push the update live.
