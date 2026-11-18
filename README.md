# Daily Check-in

A tap-only daily journal for your mental health: about 30 seconds a day, with no typing, accounts, or cloud.

**What it tracks:** hours slept, how rested you feel, mood, stress, anxiety, irritability, insecurity, energy, productivity (overall, not just work), Instagram/social media time, eating, water, exercise, daylight, real conversations, late caffeine, alcohol, medication (off by default), and an optional one-line note.

- **Check-in tab:** questions are grouped into **Sleep · Feelings · Behaviours · Your day**.
  - Only the section you're on is open. When you finish it, it folds into a one-line summary and the next one opens. Tap any header to open it yourself.
  - The yes/no habits share one **"What happened today?"** card: tap what happened, then **That's all** marks the rest as No.
  - A floating pill (*"12 of 20 · Next: Energy"*) jumps to the next unanswered question.
  - A **Check-in done** card sums up the day when you finish.
  - Each day in the week strip has a ring that fills as you answer.
  - Everything saves on every tap. Use ‹ › or the week strip to fill in a missed day.
- **Feelings use a snap slider** with three spots (e.g. *Low · Medium · High*):
  - **Tap** to land on a spot.
  - **Drag sideways** to land halfway between two spots.
  - A short description of the level shows under the slider.
  - A dashed ring shows **yesterday's answer**, so you can just ask yourself "more or less than that?".
  - **"? Not sure"** counts as answered and is left out of trends.
- **Behaviours:** concrete things you want to understand, in your own words (it starts with *Obsessive flirting* and *Comparing myself to others*; add, rename or remove them in Settings). Each day you log:
  - **Urge:** None / Mild / Strong / Very strong
  - **Acted on it?:** No / Once / A few times / A lot
  - **What set it off?:** optional (Bored, Lonely, Anxious, Felt rejected, Scrolling, …)

  Feeling the urge and *not* acting on it is shown as a win. Trends shows how often you acted on each behaviour, how often you resisted, the usual triggers, and links like *"On days you felt insecure, you acted on it 70% of days vs 20% otherwise."*
- **Say it instead (guided voice):** tap the blue mic button and the app goes through the questions one at a time.
  - It reads each question aloud (🔊 to turn that off), then listens for a short answer: *"high"*, *"a bit"*, *"pretty good"*, *"yes"*, *"seven and a half"*, *"lonely and bored"*.
  - It only asks what you haven't answered yet, and skips "acted on it" when the urge was none.
  - You can also say *"skip"*, *"back"*, *"not sure"*, *"same as yesterday"*, *"repeat"* or *"stop"*.
  - Every answer can also be tapped. Where voice isn't available (some iPhone home-screen apps), it works as a tap-through check-in.
  - Questions slide in one by one. Sound bars show when it's listening, and what you say appears live in a bubble. The bubble turns lime when understood, or shakes when not. An **Undo** button appears for a moment after each answer, and tapping the mic while it reads skips straight to answering.
  - At the end you see a summary and can undo it all. *"Say everything at once instead"* opens the free-form mode, which understands hedges, comparisons and corrections.
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

Parser tests: `node tests/voice.test.js` and `node tests/guided.test.js`.

To run it locally: `python3 -m http.server`, then open http://localhost:8000.

## Customizing questions

Edit the `QUESTIONS` array near the top of the `<script>` in `index.html`.

## Credits

Titles use [Sora](https://github.com/sora-xor/sora-font) (SIL Open Font License 1.1, see `fonts/OFL-Sora.txt`), bundled in the app so it works offline.
