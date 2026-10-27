# ⌨️ Type to change a future | Charity Campaign Web App

> **Campaign Slogan:** *TYPE. SCORE. CHALLENGE. REPEAT.*  
> **Organized by:** Team **Beyond the Ordinary**  
> **Fundraising Goal:** **RM 15,000** to support children with limited access to computers and digital learning opportunities  
> **Official Donation Page:** [https://give.asia/s/sh35662316-z9x6gd](https://give.asia/s/sh35662316-z9x6gd)  
> **Official Instagram:** [@type4future](https://instagram.com/type4future)  
> **Official TikTok:** [@type4future](https://tiktok.com/@type4future)  

---

## 🌟 Activity & Campaign Overview

**Type to change a future** is an interactive, competitive typing challenge created by **Team Beyond the Ordinary** that turns an everyday digital skill into an engaging fundraising and social campaign.

1. **The Need:** In underserved communities, children lack access to computers, internet connectivity, and foundational digital literacy. Without these tools, they face an ever-widening educational divide.
2. **The Goal:** Raise **RM15,000** to fund refurbished computers, subsidized community computer lab access, and digital literacy/coding workshops for children in need.
3. **The Multi-Channel Strategy:** The campaign drives engagement directly through social media (Instagram & TikTok) and peer-to-peer (P2P) typing challenges.

---

## 🚀 Key Features & Layout Architecture

### 1. Hero Section & Live Fundraising Tracker
- **Real-Time Progress:** Shows current funds raised toward the **RM 15,000** goal, percentage achieved, and total typists joined.
- **Direct Give.Asia Link:** 1-click button to donate directly on [Give.Asia](https://give.asia/s/sh35662316-z9x6gd).
- **Direct Touch Social Buttons:** Instant touch buttons that forward directly to the official accounts:
  - 📸 **Instagram:** `https://instagram.com/type4future`
  - 🎵 **TikTok:** `https://www.tiktok.com/@type4future`

### 2. Official Leaderboard (Showing Immediately After the Fundraising Number)
- **Positioned Right Below the Fundraise Counter:** Visitors immediately see the fundraising progress and the live competitor rankings underneath.
- **Top 3 Podium:** Gold (🥇), Silver (🥈), and Bronze (🥉) cards with WPM, accuracy, avatar, and `@handle`.
- **Social Feature Banner:** Prompts participants to tag **@type4future** on Instagram & TikTok to be featured on daily reels and stories.
- **Filter Tabs:** All Typists, Novice, Challenger, and Master.
- **Search Bar:** Instant lookup by participant nickname or `@handle`.

### 3. Interactive Typing Arena with "Type-to-Prompt" Nickname Pop-up
- **Direct Arena Access:** The typing challenge and passage are immediately visible on page load.
- **"Please Insert Your Nickname" Pop-up:**
  - When a visitor clicks into the typing area or starts pressing keys, an interactive modal automatically pops up:  
    *"Please Insert Your Nickname"*
  - Real-time uniqueness validation prevents duplicate nicknames on the leaderboard.
  - Avatar picker (🚀, ⚡, 🤖, ❤️, ✨, 🐱) and optional Instagram handle input.
  - Upon clicking *"Continue to Typing Challenge"*, the modal closes and the user can type immediately!
- **Typing Engine Features:**
  - 3 Difficulty Levels: **Novice (60s)**, **Challenger (45s)**, **Master (30s)**.
  - Character-by-character color feedback (green for correct, red highlight for typos, pulsing caret).
  - Web Audio API tactile mechanical keyboard sound effects (with 1-click sound toggle).
  - Live Words Per Minute (WPM), Accuracy (%), and countdown timer visualization.
  - Reset test anytime with <kbd>Tab</kbd> or <kbd>Esc</kbd>.

### 4. Results, Ranks & "Beat the Best Score"
- Score card reveal with WPM, Accuracy, Time Elapsed, and Performance Titles:
  - 🌟 **Grandmaster Typist** (90+ WPM)
  - ⚡ **Lightning Pioneer** (70–89 WPM)
  - 🚀 **Digital Champion** (50–69 WPM)
  - 🌱 **Future Builder** (30–49 WPM)
  - ❤️ **Heart of Gold** (<30 WPM)
- Instant **"Beat the Best Score"** retry button to improve personal records.
- Celebration confetti animation on completion.

### 5. Viral "Challenge a Friend" (P2P Engine) & Social Story Generator
- Generates personalized challenge links (e.g. `?challenger=Sarah&wpm=82`).
- When opened, visitors see an active top banner:
  > *"⚡ Challenge Alert: Sarah scored 82 WPM and challenged YOU to beat it! Can you do it for charity?"*
- One-click **WhatsApp Share** with pre-formatted campaign copy and donation links.
- One-click **Copy Caption** formatted with viral hashtags for Instagram & TikTok.
- **Story Graphic Generator (1080x1080 Canvas):** Downloads a high-resolution PNG score card ready for Instagram Stories, TikTok, and WhatsApp status updates.

### 6. Small QR Code at the Very End
- A compact, neat card positioned at the very end just above the footer:
  - Small, clean QR code canvas linking to [Give.Asia](https://give.asia/s/sh35662316-z9x6gd).
  - Direct 1-click download links for PNG (`give_asia_qr.png`) and SVG (`give_asia_qr.svg`).

---

## 📁 Project Structure

```
├── index.html               # Main Single-Page Application (HTML5 semantic markup)
├── css/
│   └── styles.css           # Modern dark-mode responsive stylesheet
├── js/
│   ├── app.js               # Main game logic, unique nickname popup, leaderboard
│   ├── qrcode.js            # Standalone pure JavaScript QR code generator engine
│   ├── audio.js             # Web Audio API synthesized keyboard clicks & chimes
│   ├── confetti.js          # Standalone lightweight canvas confetti engine
│   └── passages.js          # Curated educational passages for Novice, Challenger, Master
├── tools/
│   └── generate_qr_svg.py   # Python generator for Give.Asia SVG & PNG QR codes
├── give_asia_qr.svg         # Crisp SVG QR code for https://give.asia/s/sh35662316-z9x6gd
├── give_asia_qr.png         # High-resolution PNG QR code
└── README.md                # Comprehensive documentation
```

---

## 💻 How to Run the Website

### Option 1: Direct Browser Launch (No Installation Required)
Simply double-click `index.html` or open it with any web browser (Google Chrome, Apple Safari, Mozilla Firefox, Microsoft Edge).  
*Everything runs client-side with zero external build tools needed.*

### Option 2: Run with Python Local Server
```bash
# In the project directory:
python3 -m http.server 8000
```
Then visit `http://localhost:8000` in your web browser.
