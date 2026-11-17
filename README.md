# Daily Check-in

A tap-only daily journal for your mental health: about 30 seconds a day, with no typing, accounts, or cloud.

**What it tracks:** hours slept, how rested you feel, mood, stress, anxiety, irritability, insecurity, energy, Instagram/social media time, eating, water, exercise, daylight, real conversations, late caffeine, alcohol, medication (off by default), and an optional one-line note.

- **Check-in tab:** tap one answer per question. It saves on every tap. Use ‹ › or the week strip to fill in a missed day.
- **Behaviours:** concrete things you want to understand, in your own words (it starts with *Obsessive flirting* and *Comparing myself to others*; add, rename or remove them in Settings). Each day you log:
  - **Urge:** None / Mild / Strong / Very strong
  - **Acted on it?:** No / Once / A few times / A lot
  - **What set it off?:** optional (Bored, Lonely, Anxious, Felt rejected, Scrolling, …)

  Feeling the urge and *not* acting on it is shown as a win. Trends shows how often you acted on each behaviour, how often you resisted, the usual triggers, and links like *"On days you felt insecure, you acted on it 70% of days vs 20% otherwise."*
- **Say it instead:** tap the blue mic button and talk, e.g. *"slept 7 and a half hours, rested okay, stress high, anxiety low, instagram 2 hours, ate well, no alcohol, note long day at work"*. The answers fill in automatically, with an Undo button. If the browser has no voice support, tap the text box and use your keyboard's 🎤 dictation instead.
- **Trends tab:** 14-day averages, plus *patterns* once you have about 1–2 weeks of data (e.g. "On days you used social media 1h+, your mood was usually poor vs good otherwise").
- **Settings tab:** switch off questions you don't care about, export to CSV/JSON, and import a backup.

## Privacy

All data is stored in your browser's `localStorage` on your device. Nothing is sent anywhere. Clearing your browser data deletes it, so export a backup from Settings now and then.

Voice: turning speech into *text* is done by your browser's built-in recognizer. In Chrome that means audio goes to Google's speech service. Safari uses Apple's (often on-device). Keyboard dictation follows your phone's settings. The text is then matched to answers on your device (`voice.js`), and only the answers are saved, locally. Nothing is stored anywhere else.

## Using it on your phone

It's a static site (plain HTML, no build step). The easiest option:

1. In the GitHub repo, go to **Settings → Pages**, set the source to this branch, folder `/ (root)`.
2. Open the Pages URL on your phone.
3. **iPhone:** Share → *Add to Home Screen*. **Android:** ⋮ → *Install app*.

It then opens like an app and works offline.

To run it locally: `python3 -m http.server`, then open http://localhost:8000.

## Customizing questions

Edit the `QUESTIONS` array near the top of the `<script>` in `index.html`.
