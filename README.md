<!--![Logo](https://github.com/LoneStamp/BlackMusic/blob/main/.github/public_assets/bmusic-banner.png) 
<br/>
Source code (Alpha release preview only)
# Appname and Version
 *BlackMusic* **1.1.01.001.0001**

### Description
🎯 A simple music player that combines a vast music catalog with high-quality playback capabilities, designed for an effortless and enjoyable audio experience.

### Badges

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)
[![GPLv3 License](https://img.shields.io/badge/License-GPL%20v3-yellow.svg)](https://opensource.org/licenses/)
[![AGPL License](https://img.shields.io/badge/license-AGPL-blue.svg)](http://www.gnu.org/licenses/agpl-3.0)
  <p xmlns:cc="http://creativecommons.org/ns#" xmlns:dct="http://purl.org/dc/terms/"><a property="dct:title" rel="cc:attributionURL" href="https://github.com/LoneStamp/BlackMusic.git">BlackMusic</a> by <a rel="cc:attributionURL dct:creator" property="cc:attributionName" href="https://github.com/LoneStamp">Jednaz Lonestamp</a> is licensed under <a href="https://creativecommons.org/licenses/by-nc-nd/4.0/?ref=chooser-v1" target="_blank" rel="license noopener noreferrer" style="display:inline-block;">CC BY-NC-ND 4.0<img style="height:22px!important;margin-left:3px;vertical-align:text-bottom;" src="https://mirrors.creativecommons.org/presskit/icons/cc.svg?ref=chooser-v1" alt=""><img style="height:22px!important;margin-left:3px;vertical-align:text-bottom;" src="https://mirrors.creativecommons.org/presskit/icons/by.svg?ref=chooser-v1" alt=""><img style="height:22px!important;margin-left:3px;vertical-align:text-bottom;" src="https://mirrors.creativecommons.org/presskit/icons/nc.svg?ref=chooser-v1" alt=""><img style="height:22px!important;margin-left:3px;vertical-align:text-bottom;" src="https://mirrors.creativecommons.org/presskit/icons/nd.svg?ref=chooser-v1" alt=""></a></p> 

### Table of Contents
1. [Preface](#preface)
2. [Demo](#demo)
3. [Galleries](#galleries)
4. [Tech Stack](#tech-stack)
5. [Roadmap](#roadmap)
6. [Documentation](#documentation)
7. [Installation](#installation)
8. [Environment Variables](#environment-variables)
9. [Features](#features)
10. [Optimizations](#optimizations)
11. [Lessons Learned](#lessons-learned)
12. [Downloads](#downloads)
13. [Related](#related)
14. [Used By](#used-by)
15. [FAQ](#faq)
16. [Feedback](#feedback)
17. [License](#license)
18. [Contributing](#contributing)
19. [Support](#support)
20. [Authors](#authors)
21. [Acknowledgements](#acknowledgements)
22. [References](#references)
23. [Appendix](#appendix)

### Preface

**Welcome to BlackMusic, your ultimate music companion.**

BlackMusic is designed to provide a seamless and enriched music experience across various environments. The app is divided into key sections to cater to your diverse musical needs:

- **Home**: Stay updated with the latest in music news, trends, and charts. This section keeps you connected to the pulse of the music world.

- **Playground**: Explore a legacy playback environment that offers a nostalgic experience, bringing back the feel of classic music players with modern enhancements.

- **Local**: Your common playback environment where you can easily access and enjoy your offline music collection. This section is optimized for smooth navigation and playback.

- **Online**: Dive into the world of online music playback. Stream your favorite tracks, discover new artists, and create your playlists, all within this dedicated online environment.

- **Library**: Organize your tracks with precision. The Library section is your personal music archive, allowing you to sort, categorize, and manage your music collection with ease.

- **Toolkits**: Empower your music journey with a range of tools. From downloading tracks to converting formats, the Toolkits section offers practical utilities that enhance your overall music experience.


### Galleries

##### Photos

| ![BlackMusic Home](https://github.com/LoneStamp/BlackMusic/blob/main/public/photos/blackmusic-home.png?raw=true) | ![BlackMusic Local](https://github.com/LoneStamp/BlackMusic/blob/main/public/photos/blackmusic-local.png) | ![Image 3](https://example.com/image3.png "Image 3 Title") | ![Image 4](https://example.com/image4.png "Image 4 Title") |
|:--:|:--:|:--:|:--:|

### Tech Stack

| Category            | Technologies                                                      |
|---------------------|-------------------------------------------------------------------|
| **Client:**         |                                                                   |
| **Front-end:**      | TypeScript, HTML, CSS, JavaScript                                 |
| **Backend (Client-side):** | C++, Python                                               |
| **Server:**         |                                                                   |
| **Back-end:**       | Node.js                                                           |
| **Cloud provider:** | AWS                                                               |
| **Containerization:** | Docker                                                          |
| **Database:**       | MySQL, NoSQL (MongoDB), SqlLite                                      |
| **Cloud Services:** | Firebase (for real-time database, authentication, hosting)        |


### Documentation

[Documentation](https://linktodocumentation)

    
### Environment Variables

**Note**: APIs have request limits for optimal performance. Fill in your own API keys.

- The percentage levels indicate how strongly it is recommended for users to provide their own API keys.
- Below is a guide for the requirement level on whether to provide custom APIs:

| Requirement Level | Description           |
|-------------------|-----------------------|
| 0% - 20%          | No Need               |
| 20% - 40%         | Rarely Needed         |
| 40% - 60%         | Advisable             |
| 60% - 80%         | Recommended           |
| 80% - 100%        | Highly Recommended    |

| API         | Description                                         | Requirement Level   |
|-------------|-----------------------------------------------------|---------------------|
| Spotify     | <a href="">Spotify API</a>                          | 100% (Highly Recommended) |
| Yandex Music|  <a href="">Yandex Music API</a>                    | 100% (Highly Recommended) |
| YouTube Music|  <a href="">YouTube Music API</a>                    | 100% (Highly Recommended) |
| YouTube     |  <a href="">YouTube API</a>                    | 100% (Highly Recommended) |
| Facebook    |  <a href="">Facebook Graph API</a>                  | 60% (Recommended)         |
| Wikipedia   |  <a href="">Wikipedia API</a>                       | 40% (Advisable)           |
| IMDb        |  <a href="">IMDb API</a>                            | 60% (Recommended)         |
| Apple Music |  <a href="">Wiki Fandom API</a>                     | 20% (Rarely Needed)       |
| Tidal |  <a href="">Tidal API</a>                     | 20% (Rarely Needed)       |
| Last.fm |  <a href="">Last.fm API</a>                     | 20% (Rarely Needed)       |
| Music Story |  <a href="">Music Story API</a>                     | 20% (Rarely Needed)       |
| Pandora |  <a href="">Pandora API</a>                     | 20% (Rarely Needed)       |
| iHeartRadio|  <a href="">iHeartRadio API</a>                     | 20% (Rarely Needed)       |



### Features

- Music news
- Extensions and Add-ons
- Legacy playback
- Common playback
- Online stream using Spotify api
- Integrated search
- Cross platform

<!--### Optimizations

What optimizations did you make in your code? E.g. refactors, performance improvements, accessibility

### Lessons Learned

What did you learn while building this project? What challenges did you face and how did you overcome them?

### Downloads
Available on:

### Desktop
---

| Platforms| Mirrors 1 | Mirror 2|
|-------|-------|------|
| <img src="https://github.com/LoneStamp99/Vvdo/assets/93658802/aaad78d0-6e4f-4dec-9586-207b86a4a6ff" width="16px" height="16px"/>(https://your-download-link-for-linux)|[Download]()| [Download]()| 
| <img src="https://github.com/LoneStamp99/Vvdo/assets/93658802/16780aaa-10e5-4b63-87ac-0edfe30c0053" width="16px" height="16px"/>(https://your-download-link-for-windows)|[Download]()| [Download]()| 
|<img src="https://github.com/LoneStamp99/Vvdo/assets/93658802/2c26d1c7-b2dc-4e42-a3d7-f2ab25e88b45" width="16px" height="16px"/>(https://your-download-link-for-mac) |[Download]()| [Download]()|

### Mobile
---

| Android | Mirror 1| Mirror 2|
|---------|---------|---------|
| [![android](https://github.com/LoneStamp99/Vvdo/assets/93658802/4bda63de-cd31-4d34-8afc-00f445fe66b6)](https://your-download-link-for-android) | [Download]()| [Download]()|
|[![ios](https://github.com/LoneStamp99/Vvdo/assets/93658802/a7cbc065-4ef7-4bf7-a633-1e8e631717ff)](https://your-download-link-for-ios) | [Download]()| [Download]()|



- Web
---
[BlackVivido]

### Related

Here are some related projects

- <a href="https://github.com/Taiko2k/Tauon">Tauon</a>
- <a href="https://github.com/jwallet/spy-spotify">Spy Spotify</a>
- <a href="https://github.com/yaronzz/Tidal-Media-Downloader-PRO">Tidal Media Downloader</a>
- <a href="https://github.com/yaronzz/Tidal-Media-Downloader-PRO">Tidal Media Downloader</a>
- <a href="https://github.com/kraxarn/spotify-qt">Spotify QT</a>
- <a href="https://github.com/jhelumcorp/gyawun">Gwayun</a>
- <a href="https://github.com/jeffvli/feishin">feishin</a>
- <a href="https://github.com/SathyaBhat/spotify-dl">Spotify Dl</a>
- <a href="https://github.com/univrsal/tuna">Tuna</a>
- <a href="https://github.com/nukeop/nuclear">Nuclear</a>
- <a href="https://github.com/marin-m/SongRec">SongRec</a>
- <a href="https://github.com/Stremio/stremio-video">Streameo Video</a>
- <a href="https://github.com/nathom/streamrip">Streamrip</a>
- <a href="https://github.com/martpie/museeks">Museeks</a>
- <a href="https://github.com/harjot-oberai/MusicDNA">MusicDNA</a>
- <a href="https://github.com/MarshallOfSound/Google-Play-Music-Desktop-Player-UNOFFICIAL-">Google-Play-Music-Desktop-Player-UNOFFICIAL</a>
- <a href="https://github.com/iampawan/Flutter-Music-Player">Flutter-Music-Player</a>

[Awesome README](https://github.com/matiassingers/awesome-readme)

### Used By

This project is used by the following companies:

- Company 1
- Company 2

### FAQ

#### Question 1

Answer 1

##### Question 2

Answer 2

### Feedback

If you have any feedback, please reach out to us at fake@fake.com

### License
 BlackMusic © 2024 by Jednaz Lonestamp is licensed under CC BY-NC-ND 4.0 

### Contributing

Contributions are always welcome!

See `contributing.md` for ways to get started.

Please adhere to this project's `code of conduct`.

### Support

For support, email fake@fake.com or join our Slack channel.


### Acknowledgements

- [Awesome Readme Templates](https://awesomeopensource.com/project/elangosundar/awesome-README-templates)
- [Awesome README](https://github.com/matiassingers/awesome-readme)
- [How to write a Good readme](https://bulldogjob.com/news/449-how-to-write-a-good-readme-for-your-github-project)

### Privacy Policy and Terms of Service
To learn more about how we collect, store, and use user data, please read our Privacy Policy at [Link to Privacy Policy]. Our Terms of Service govern the use of BlackVivido or Vvdo and can be found at [Link to Terms of Service]. By using our app, you agree to these terms.

### References

### Appendix

### Copyright
© 2024 BlackMusic
-->
