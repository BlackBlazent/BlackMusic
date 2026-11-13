# BlackMusic — Privacy Policy & Terms and Conditions

**Effective date:** [DATE]  ·  **App version described:** 3.0.0 (desktop and mobile)
**Publisher:** BlackBlazent ("we", "us")  ·  **Contact:** [CONTACT_EMAIL]

> **Reusable draft.** This text describes what the BlackMusic code does today. Replace every `[PLACEHOLDER]`, then have a qualified lawyer review it for the places you distribute the app (Google Play, App Store, Microsoft Store, Softonic, UpToDown, and your own website). It is not legal advice.
> Sync, Meet Room and Session Share are part of 3.0.0; delete their sections if you ship a build without them.

---

# Part A — Privacy Policy

## 1. The short version

- BlackMusic is a **local-first music player**. Your music files stay on your device. We do not upload, copy, or store your audio files on our servers.
- You can use BlackMusic **without creating an account**.
- BlackMusic has **no advertising SDK, no analytics, and no crash-reporting service**. We do not sell your personal data.
- Some features contact third-party services (music catalogs, lyrics, cover art, sign-in). Those requests go from your device to that service. Their privacy policies apply to what they receive.

## 2. What stays on your device

BlackMusic stores the following **locally** (in the app's data folder, using the app's local store and your device storage):

| Data | Purpose |
| --- | --- |
| Paths and tags of your audio files (title, artist, album, duration, embedded artwork) | Build and display your library |
| Playlists, favorites, play history, queue, pins, ratings | Features inside the app |
| Edited metadata and cover art you choose | Saved to your files only when you apply an edit |
| Settings and personalization (theme, language, banner image, audio filters, equalizer, layout) | Remember your preferences |
| API keys / tokens you paste into Settings (for example a Last.fm key or a YouTube key) | Call those services on your behalf |
| Cached results (promotions, artwork lookups) | Speed and offline behavior |
| Speech-to-text models and transcripts (Whisper) | Run **entirely on your device** |

We cannot see this data. Uninstalling the app or clearing its data removes it. Your music files themselves are never deleted by uninstalling.

## 3. Permissions the app asks for

| Permission / access | Why |
| --- | --- |
| Read folders you choose, and (on desktop/Android) audio storage including SD cards where the OS allows | Find and play your music |
| Android: media/audio read (`READ_MEDIA_AUDIO` or `READ_EXTERNAL_STORAGE` on older versions) | Discover music on the device |
| Notifications and foreground service (Android) | Lock-screen / notification playback controls |
| Internet | Online services, sign-in, updates, lyrics, artwork |
| Wake lock (Android) | Keep playback running with the screen off |

You can revoke any permission in your device settings. Features that depend on it will stop working, and the app should tell you so.

## 4. Account and sign-in (optional)

If you create an account or sign in, we use **Supabase** (authentication) and, depending on the method, **Google, GitHub, Facebook, or Spotify** as sign-in providers.

- **What we receive:** your email address, display name, profile picture URL, and a unique account ID from the provider you choose. We receive a password only if you sign up with email (it is handled by Supabase and not readable by us).
- **What we use it for:** to show your name and photo in the app and to identify your account. Nothing else.
- **Sessions:** a session token is stored on your device so you stay signed in. Signing out removes it.
- **Provider tokens:** when you connect Spotify, tokens needed to call Spotify for you are kept on your device.
- **Deleting your account:** [DESCRIBE THE REAL PROCESS — in-app deletion is not implemented yet, so until it is, say: "email [CONTACT_EMAIL] from the address on your account and we will delete it within [N] days."]

### Sync (optional, off by default)
If you turn on **Music Portable Sync**, BlackMusic uploads **library details only** — song titles, artists, albums, genre/year/composer/country/mood tags, playlists, favorites, play history, device names and folder **names** — to your account so your devices can show the same library. File paths and **audio files are never uploaded or stored by us**. When you ask one device to play or copy a song that lives on another of your devices, the song travels **directly between your devices** over an encrypted peer-to-peer connection; our service only relays small connection set-up messages on a private channel that only your account can read, and keeps none of them. To help two devices on different networks find each other, a public STUN server (by default Google's, `stun.l.google.com`) learns both devices' network addresses; you can add your own TURN server in Settings. You can turn sync off and delete everything synced from the server with one button; your music and local playlists are not touched.

### Meet Room and Session Share
**Online rooms** use our realtime service to pass short messages (the song's title/artist/length, play/pause, position, the shared queue, display names). Each person plays their own copy of the song; no audio is sent. Anyone who has the room code can join, so share it only with people you trust. **Same-Wi-Fi rooms** connect devices directly on your local network and need no internet; messages stay on that network.

## 5. Third-party services the app can contact

BlackMusic contacts these only when you use the related feature. Your IP address and the data in the request (such as a search term) are visible to the service.

| Service | What for | What is sent |
| --- | --- | --- |
| Supabase | Account sign-in | Credentials / OAuth exchange |
| Spotify | Browse, search, play via your Spotify account | OAuth tokens, search terms, track IDs |
| Audius, Deezer, SoundCloud, Tidal, Apple Music, Amazon Music, Yandex Music | Browse and search catalogs when you select them and provide the required key | Search terms, requests for catalog data |
| YouTube Data API / YouTube embed | Video search and playback | Search terms, video IDs |
| Last.fm | Charts, artist info, album art, optional scrobble history by the username you enter | Artist/album names, your Last.fm username |
| MusicBrainz, Cover Art Archive | Album and cover-art lookup | Artist/album names |
| Genius, LRCLIB | Lyrics and song info | Artist/title |
| Hugging Face / GitHub | Download of speech models; update checks (`latest.json`) | Standard download request |
| fal.ai | Optional AI cover-art generation using **your own** fal.ai key, only when you press "Generate thumbnail" | The artwork prompt (song/album/artist/genre/mood words) and your key |
| Google STUN (or your own) | Helps two of your devices connect directly when syncing songs between them | Network addresses of your devices |
| Involve Asia and brand partners | Promotional cards (see §6) | Request for the current offers |

We do not control these services. Review their policies before using them. Some services (for example Tidal, Pandora, Amazon Music) may be unavailable or require credentials, and BlackMusic will tell you when a service cannot be used.

## 6. Promotions and affiliate links

BlackMusic may show **promotional cards**. Some links are **affiliate links**: if you click and buy, we may earn a commission **at no extra cost to you**. Promotions are labeled as such. How often a card has been shown is counted **on your device** to limit repetition; we do not build a profile about you from it. Opening a promotion takes you to a third-party website with its own privacy practices.

## 7. Video, downloads, and speech tools

- **YouTube / video:** on desktop, BlackMusic can call a local `yt-dlp` helper where permitted. On mobile, only search and playback through YouTube's official API are offered; **no download** is available.
- **You are responsible** for making sure you have the right to download or convert any content, and for following the terms of the service it comes from.
- **Speech-to-text (Whisper)** runs locally. Audio you transcribe is not sent to us.

## 8. Cookies and tracking

BlackMusic is an application, not a website. It does not use advertising cookies or cross-app tracking. Embedded third-party players (such as YouTube) may set their own cookies inside their frame. [If you host a website, add a separate cookie notice for it.]

## 9. Children

BlackMusic is not directed to children under **13** (or the minimum age in your country). We do not knowingly collect personal data from them. If you believe a child created an account, contact us and we will delete it.

## 10. Security

Connections to online services use HTTPS. Secrets that must not be public are kept on our server, not in the app. No method of storage or transmission is perfectly secure, so we cannot guarantee absolute security. Report security issues to [SECURITY_CONTACT].

## 11. Your rights

Depending on where you live (for example GDPR in the EU/UK, CCPA/CPRA in California, or the Philippine Data Privacy Act), you may have the right to access, correct, delete, or export your personal data, to object to or restrict processing, and to withdraw consent. Because most data stays on your device, you control it directly. For account data we hold, contact [CONTACT_EMAIL]. We will answer within [N] days.

## 12. Retention

Account data is kept while your account exists. Local data is kept until you remove it. Cached data expires automatically or when you clear the app's data.

## 13. International transfers

Supabase and the third-party services above may process data in other countries. Where required, transfers rely on the safeguards those providers offer.

## 14. Changes

We may update this policy. The new version will carry a new effective date, and material changes will be announced in the app. Continued use means you accept the updated policy.

---

# Part B — Terms and Conditions

## 1. Agreement
By installing or using BlackMusic you agree to these Terms and to the Privacy Policy above. If you do not agree, do not use the app.

## 2. License to use
We grant you a personal, non-exclusive, non-transferable, revocable license to install and use BlackMusic for your own non-commercial listening. The source code is made visible on GitHub under the repository's license terms. **Check the `LICENSE` file:** you may not compile, bundle, or redistribute the app as a binary for public or commercial distribution without written permission from the copyright holder. [CONFIRM THIS MATCHES THE LICENSE YOU WANT TO PUBLISH.]

## 3. Your music and your content
- BlackMusic plays files **you already have**. You must own them or have the right to use them.
- BlackMusic does not provide, sell, or license music. Online catalogs are provided by third parties under their own terms.
- You are responsible for the metadata and artwork you write to your files. Back up important files before editing; we are not liable for loss caused by editing or conversion.

## 4. Third-party services
Connecting to Spotify, YouTube, Audius, Tidal, Apple Music, Amazon Music, Deezer, SoundCloud, Yandex Music, Last.fm, Genius, MusicBrainz, or any other service is governed by **that service's terms**. Some require a paid subscription, an API key, or a developer allow-list. BlackMusic does not guarantee that any service will be available, complete, or allow playback.

## 5. Acceptable use
You agree **not** to:
- use BlackMusic to infringe copyright or bypass a service's technical protections or terms;
- download or extract media you have no right to copy;
- reverse engineer, resell, or redistribute the app contrary to the license;
- attack, overload, or probe our servers or other users' accounts;
- upload unlawful content or impersonate others.

## 6. Accounts
You are responsible for your account and for keeping credentials secure. We may suspend or remove accounts that breach these Terms.

## 7. Promotions and affiliate links
Promotional links are clearly marked. We are not a party to your dealings with advertisers and are not responsible for their products or sites.

## 8. Updates
BlackMusic may check for and offer updates automatically. Updates may add, change, or remove features. Some features differ by platform; unsupported features are hidden or disabled on that platform.

## 9. Availability and changes
We aim for a stable app but provide it **"as is" and "as available"**. Features may change, and online services may stop working without notice.

## 10. Disclaimer of warranties
To the fullest extent permitted by law, we give no warranty of any kind, express or implied, including merchantability, fitness for a particular purpose, non-infringement, uninterrupted or error-free operation, or the accuracy of third-party data (lyrics, artwork, metadata).

## 11. Limitation of liability
To the fullest extent permitted by law, BlackBlazent is not liable for indirect, incidental, special, consequential, or punitive damages, or for lost data, files, profits, or goodwill, arising from your use of the app. Our total liability for any claim is limited to the amount you paid for the app in the 12 months before the claim (which may be zero). Nothing here limits liability that cannot be limited by law.

## 12. Intellectual property
The BlackMusic name, logo, and original app content belong to BlackBlazent. Third-party names, logos, and content belong to their owners and are used for identification only. Brand names do not imply endorsement.

## 13. Termination
You may stop using BlackMusic at any time by uninstalling it. We may end your license if you breach these Terms. Sections that by their nature should survive (warranty disclaimer, liability limit, IP) survive termination.

## 14. Governing law and disputes
These Terms are governed by the laws of [COUNTRY / STATE]. Disputes go to the courts of [JURISDICTION], unless mandatory consumer law in your country says otherwise.

## 15. Changes to these Terms
We may revise these Terms. The updated version will show a new effective date. Continuing to use the app after a change means you accept it.

## 16. Contact
BlackBlazent · [CONTACT_EMAIL] · [WEBSITE_URL]

---

### Checklist before publishing (delete this section)

- [ ] Fill in effective date, contact email, security contact, governing law, retention periods.
- [ ] Decide the real account-deletion process (in-app deletion is not implemented in 2.2.0).
- [ ] If you ship a build with sync/Meet Room turned off or removed, delete those sections.
- [ ] Confirm the license wording in Terms §2 matches `LICENSE` (the repo `LICENSE` is proprietary/all-rights-reserved while `package.json` says `MIT` — pick one).
- [ ] Host on a static, instantly loading page (for example GitHub Pages), not a sleeping free-tier server, so store reviewers never see a broken link.
- [ ] Use the same text for the Google Play and App Store privacy forms; make the Data Safety answers match §2–§6.
- [ ] Lawyer review for your target countries.
