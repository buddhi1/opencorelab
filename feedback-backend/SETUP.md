# Feedback backend setup (Google Sheets + Apps Script)

The site collects consent, usage and feedback in the student's browser and posts it to a small Google Apps Script
web app, which writes it to a Google Sheet. It is free, needs no credit card, and takes about 10 minutes.

| File | What it is |
|---|---|
| `Code.gs` | The web app. Receives records and appends them to the Sheet, one tab per record type. |
| `Form.gs` | Optional. Builds a stand-alone Google Form with the same questions. Generated; do not edit by hand. |
| `../js/feedback-questions.js` | Consent wording and every question. The single place to edit. |
| `../js/feedback-config.js` | The web-app URL the site posts to. |

## 1. Create the Sheet and the script

1. Create a new Google Sheet, for example **Open Core Lab feedback**. If your university has Google Workspace, use
   your university account: its quotas are higher and the data stays under university policy.
2. In the Sheet, open **Extensions > Apps Script**.
3. Delete the sample code in `Code.gs` and paste in the contents of `feedback-backend/Code.gs`. Save.
4. Optional, for the Google Form: click **+ > Script**, name it `Form`, and paste in `feedback-backend/Form.gs`.

## 2. Run `setup` once

1. Pick `setup` in the function menu at the top and click **Run**.
2. Google asks for permission. Because this is your own unpublished script, it shows *"Google hasn't verified this
   app"*: click **Advanced > Go to … (unsafe)** and then **Allow**. Only you see this screen; students never do.
3. The Sheet now has the tabs `consent`, `profile`, `session`, `visit`, `feedback`, `survey` and `withdraw`.

## 3. Deploy the web app

1. Click **Deploy > New deployment**, choose the type **Web app**, and set:
   - **Execute as:** Me
   - **Who has access:** Anyone
2. Click **Deploy** and copy the **Web app URL**. It ends in `/exec`.
3. Open that URL in a browser tab. You should see `{"ok":true,"app":"opencorelab"}`.
4. Paste the URL into `js/feedback-config.js`:
   ```js
   endpoint: 'https://script.google.com/macros/s/AKfy.../exec',
   ```

To check it end to end, open the site in a private window, choose **Sure**, open an example, and go to
**Privacy & data**. Click **Send now**, and rows appear in the Sheet within a few seconds.

**When you change `Code.gs` later**, use **Deploy > Manage deployments**, click the pencil, choose
**Version: New version**, and click **Deploy**. This keeps the same URL. A *New deployment* would create a new URL
that the site does not know about.

## 4. Optional: the Google Form

`Form.gs` creates a Google Form with the consent text, an age question, the profile and the survey. 18+ see
everything, 13 to 17 skip the profile, and under-13s go straight to the end. Its responses go to a new tab in the
same Sheet. To create it, run `buildForm` once; the log shows the edit link and the link to share. Each run
creates a new form. If the form says it is not published, click **Publish** in the form editor.

## Changing questions

1. Edit `js/feedback-questions.js`. New question ids simply become new columns in the Sheet; `Code.gs` needs no change.
2. If you changed the consent wording, increase `consent.version`. Everyone is asked again on their next visit.
3. If you use the Google Form, run `node tools/build_form.js`, paste the new `Form.gs`, and run `buildForm` again.

## What lands in the Sheet

Every row has `received` (server time), `rid` (record id), `type`, `v` (consent version) and `at` (browser time).

| Tab | When | Main columns |
|---|---|---|
| `consent` | a student chooses | `choice` (`full`, `feedback`, `declined`), `age`, `anonId` (only for `full`). A `declined` row has a date and nothing else. |
| `profile` | after "Sure", optional | `level`, `course`, `exp_c`, `exp_parallel`, `exp_ml`, `region`, `run_where` |
| `session` | each page load, `full` only | `browser`, `browserVersion`, `os`, `form` (phone/tablet/desktop), `viewport`, `cores`, `memoryGB`, `touch`, `webgpu`, `timezone`, `language`, `theme` |
| `visit` | leaving a page, `full` only | `page`, `steps`, `stepsSeen`, `lastStep`, `completed`, `activeSec` (tab visible and input in the last minute), `totalSec`, `ui.play`, `ui.codeclick`, `ui.speed`, `ui.search`, `ui.sidebar`, `ui.theme` |
| `feedback` | the card at the end of an example | `page`, `helpful` (1-5), `code_level`, `comment`; `age` instead of `anonId` in feedback-only mode |
| `survey` | the #/feedback page | one column per survey question |
| `withdraw` | "Delete my data" | `deletedRows`. The student's rows in every tab are deleted and their id is not kept. |

`anonId` links one browser's records together. `sid` groups the records from one page load.

## Limits and safety

- **Volume:** free Google accounts have daily Apps Script quotas far above what a class produces. A Sheet slows down
  past about 100,000 rows; archive old tabs each term.
- **Spam:** the web app is public by design, because students are not signed in. It rejects anything that is not from
  the site's format, ignores bot-filled forms, caps request size and text length, skips duplicates, and prefixes
  text that starts with `=`, `+`, `-` or `@` so it can never run as a formula.
- **Privacy:** Apps Script does not pass IP addresses to the script, and the site sends no names, emails, user-agent
  strings or search text. Keep the Sheet shared only with the course team.

## Tests

```sh
node tools/test_backend.js   # Code.gs and Form.gs against fake Google services
node tools/e2e.js            # the site, including the consent and feedback flows, with posting stubbed out
```
