# Daily Check-in

A tap-only daily journal for your mental health: about 30 seconds a day, with no typing, accounts, or cloud.

**What it tracks:** hours slept, how rested you feel, mood, stress, anxiety, irritability, insecurity, energy, Instagram/social media time, eating, water, exercise, daylight, real conversations, late caffeine, alcohol, medication (off by default), and an optional one-line note.

- **Check-in tab:** tap one answer per question. It saves on every tap. Use ‹ › or the week strip to fill in a missed day.
- **Trends tab:** 14-day averages, plus *patterns* once you have about 1–2 weeks of data (e.g. "On days you used social media 1h+, your mood was usually poor vs good otherwise").
- **Settings tab:** switch off questions you don't care about, export to CSV/JSON, and import a backup.

## Privacy

All data is stored in your browser's `localStorage` on your device. Nothing is sent anywhere. Clearing your browser data deletes it, so export a backup from Settings now and then.

## Using it on your phone

It's a static site (plain HTML, no build step). The easiest option:

1. In the GitHub repo, go to **Settings → Pages**, set the source to this branch, folder `/ (root)`.
2. Open the Pages URL on your phone.
3. **iPhone:** Share → *Add to Home Screen*. **Android:** ⋮ → *Install app*.

It then opens like an app and works offline.

To run it locally: `python3 -m http.server`, then open http://localhost:8000.

## Customizing questions

Edit the `QUESTIONS` array near the top of the `<script>` in `index.html`.
