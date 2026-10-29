# Idea: «Это точно Клавдий?» (*Is that really Claudius?*)

Hackathon theme: "The internet is no longer proof."

## Summary

A messenger message no longer proves who wrote it: accounts get hijacked, and one person can speak on behalf of several. We check the author not by the account but by their **handwriting**: how a person writes, which words and punctuation they use, when they are online.

Three modes on one stylometry engine:

1. **Check: "Is this really Sasha?"** Upload an export of your chat with a person and build their "handwriting passport". A new suspicious message gets a similarity score, and mismatches are highlighted right in the text. If in doubt, the system suggests a challenge question from your shared history that only the real Sasha can answer.
2. **Twins: "Are these really two different people?"** Upload a group chat export and see which accounts most likely belong to the same person. Pairs are found by matching handwriting, shared rare words and typos, and by activity time: such accounts never write at the same time and switch within tens of seconds.
3. **Two chats: "Are Sasha and Alex the same person?"** Upload two different chats and see whether the same person writes in both under different accounts: a "friend's" new account asking for money, or an old acquaintance under a new nickname. Accounts present in both chats (usually you) are excluded from the comparison.

A verdict is always a probability with evidence, never a sentence. Every piece of evidence can be backed by specific messages.

**Who it is for:**
- people who get "lend me money, urgently" from a "friend";
- chat and community moderators: astroturfing, ban evasion, "yes-man" accounts;
- anyone who wants to know who they are actually talking to.

## MVP (sure to make it)

- Upload a Telegram Desktop JSON export: both personal and group chats.
- Handwriting features:
  - character n-grams;
  - punctuation, capitalization, brackets and emoji;
  - message length, characteristic and rare words;
  - activity hours.
- An author's handwriting passport: 5–10 human-readable traits, activity hours, favorite words and emoji.
- Message check: a 0–1 score, a verdict, evidence with highlighted text fragments.
- Twins:
  - pairwise similarity of all chat authors, normalized within the chat;
  - time evidence: never write at the same time, switch fast;
  - a participant graph and a detailed pair comparison.
- Two chats: every author of one chat against every author of the other, on the same engine as twins (handwriting, habits, characteristic words, activity time).
- Self-check: split each author's messages in half and see whether the halves find each other. We show this number in the demo as accuracy.
- LLM (Claude): a plain-language explanation of the evidence and a challenge question from the shared history. Everything works without a key, just without these texts.

## If time allows

- Analyzing a series of messages rather than one: more accurate on short texts.
- A Telegram bot: forward a suspicious message and get a check.
- Report export for moderators.

## Demo script (about 3 minutes)

1. **Problem (20 s).** Two screenshots. "Hi! Urgently lend me 5000, I'll explain later" from a hijacked friend. And a chat where three "different" people back the same opinion.
2. **Passport (30 s).** Upload the export of a chat between us teammates. Show the handwriting passport: "writes without capitals", "brackets instead of emoji", "active from 10 to 02".
3. **Check (40 s).**
   - A real message from the teammate → "match" (~60–70%). Take a verified line from `demo/checks.txt`, e.g. «бублик опять на клаве уснул)».
   - The fake "Hi! Urgently lend…" → "mismatch", mismatches highlighted, a challenge question from the chat.
   - Invite a jury member to write a message "as the teammate" and check it live.
4. **Twins (50 s).** Upload a group chat where one of us wrote from two accounts.
   - A red edge between two "different" participants on the graph.
   - Evidence: shared rare slang, identical punctuation, never wrote at the same time, switching within ~30 seconds.
   - Both accounts' messages side by side.
5. **Two chats (20 s).** Upload a second chat where the teammate writes from another account. The comparison says "most likely the same person", with evidence.
6. **Honesty (20 s).** On the group chat `demo/group_twins.json`, show the self-check: "the halves of one author found each other in 6 of 6 cases". Explain that this is a probability and that data is not stored.

## Deliberately out of scope

- Connecting to the Telegram API or bots: the MVP works with export files only.
- Voice messages, images, stickers: text only.
- Other messengers: only the Telegram Desktop JSON format.
- Accounts, authorization, a database: everything lives in the backend's memory until restart.
- Training neural networks: classic stylometry only; the LLM is used only for explanations.
- Binary "guilty / not guilty" verdicts.
- Deployment: the demo runs locally.

## Data and privacy

- Real exports live only in `data/` (in `.gitignore`) and never get into git.
- Only the short fragments needed for an explanation are sent to the LLM.
- The demo twin is created in two ways: a live second account in the chat during the hackathon, and a utility that splits a real author's messages into two "accounts".
