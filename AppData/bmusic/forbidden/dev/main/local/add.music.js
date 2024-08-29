/*document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.querySelector('#file-1069\\:28071');
    const musicDisplayer = document.querySelector('#music-displayer');
    const playPauseBtn = document.querySelector('#pause-play');
    const nextBtn = document.querySelector('#next-music');
    const prevBtn = document.querySelector('#previous-play');
    const resetBtn = document.querySelector('#reset-play');
    const loopBtn = document.querySelector('#loop-play');
    const shuffleBtn = document.querySelector('#shuffle-play');
    const gotoBtn = document.querySelector('#goto-play');
    const speakerBtn = document.querySelector('#adjusterVol')

    let audioContext = new (window.AudioContext || window.webkitAudioContext)();
    let audioElement = new Audio();
    let audioSource = audioContext.createMediaElementSource(audioElement);
    let trackList = [];
    let currentTrackIndex = 0;
    let isPlaying = false;

    // Load tracks from folder
    fileInput.addEventListener('change', (event) => {
        const files = event.target.files;
        trackList = [];

        // Display music list
        musicDisplayer.innerHTML = ''; // Clear existing list
        for (let file of files) {
            if (file.type.startsWith('audio/')) {
                trackList.push(file);
                const listItem = document.createElement('li');
                listItem.classList.add('music-local-play-listed40');
                listItem.innerHTML = `
                    <div class="local-music-contents-con49">
                        <div class="music-name43">
                            <span class="music-name-tx43 local-music-title">${file.name}</span>
                        </div>
                        <div class="artist-name49">
                            <span class="artist-name-tx49 local-music-artist">Unknown Artist</span>
                        </div>
                        <div class="genre-name49">
                            <span class="artist-name-tx49 local-music-genre">Unknown Genre</span>
                        </div>
                        <div class="album-name49">
                            <span class="artist-name-tx49 local-music-album">Unknown Album</span>
                        </div>
                        <div class="duration-name49">
                            <span class="artist-name-tx49 local-music-time">Unknown</span>
                        </div>
                        <div class="folder-name49">
                            <span class="artist-name-tx49 local-music-path-folder">Uploaded Folder</span>
                        </div>
                        <div class="year-name49">
                            <span class="artist-name-tx49 local-music-year">Unknown</span>
                        </div>
                        <div class="music-note30">
                            <img class="music-note-img-icon30" src="../AppData/bmusic/assets/media/images/icons/general/controls/music-note-img.svg">
                        </div>
                    `;
                musicDisplayer.appendChild(listItem);
            }
        }
        // Optionally save the list to local.db
        saveMusicList();
    });

    function saveMusicList() {
        // Your SQLite database code to save trackList here
    }

    function loadTrack(index) {
        const track = trackList[index];
        if (track) {
            const url = URL.createObjectURL(track);
            audioElement.src = url;
            audioElement.load();
        }
    }

    playPauseBtn.addEventListener('click', () => {
        if (isPlaying) {
            audioElement.pause();
            isPlaying = false;
        } else {
            loadTrack(currentTrackIndex);
            audioElement.play();
            isPlaying = true;
        }
    });

    nextBtn.addEventListener('click', () => {
        currentTrackIndex = (currentTrackIndex + 1) % trackList.length;
        loadTrack(currentTrackIndex);
        if (isPlaying) audioElement.play();
    });

    prevBtn.addEventListener('click', () => {
        currentTrackIndex = (currentTrackIndex - 1 + trackList.length) % trackList.length;
        loadTrack(currentTrackIndex);
        if (isPlaying) audioElement.play();
    });

    resetBtn.addEventListener('click', () => {
        loadTrack(currentTrackIndex);
        if (isPlaying) audioElement.play();
    });

    loopBtn.addEventListener('click', () => {
        audioElement.loop = !audioElement.loop;
        loopBtn.classList.toggle('active', audioElement.loop);
    });

    shuffleBtn.addEventListener('click', () => {
        // Implement shuffle functionality
        const shuffleBtn = document.getElementById('shuffle-play'); // Assuming this is the ID of your shuffle button

// Function to shuffle an array
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]]; // Swap elements
    }
}

// Function to handle shuffle button click
shuffleBtn.addEventListener('click', () => {
    shuffleArray(trackList); // Shuffle the track list

    // Update the player with the shuffled track list
    track_index = 0; // Reset the track index
    loadTrack(track_index); // Load the first track of the shuffled list

    console.log('Track list shuffled:', trackList);
});

// Function to load a track
function loadTrack(index) {
    if (index >= 0 && index < trackList.length) {
        const track = trackList[index];
        curr_track.src = track.path;
        track_art.src = track.image;
        track_name.textContent = track.name;
        track_artist.textContent = track.artist;

        // Start playback if the player is currently playing
        if (isPlaying) {
            curr_track.play();
        }
    }
}

    });

    gotoBtn.addEventListener('click', () => {
        // Implement goto functionality
    });
    speakerBtn.addEventListener()
});
*/

// Original
/*
document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.querySelector('#file-1069\\:28071');
    const musicDisplayer = document.querySelector('#music-displayer');
    const playPauseBtn = document.querySelector('#pause-play-ico'); // Select the image by its ID
    const nextBtn = document.querySelector('#next-music');
    const prevBtn = document.querySelector('#previous-play');
    const resetBtn = document.querySelector('#reset-play');
    const loopBtn = document.querySelector('#loop-play');
    const shuffleBtn = document.querySelector('#shuffle-play');
    const gotoBtn = document.querySelector('#goto-play');
    const speakerBtn = document.querySelector('#adjusterVol');
    const musicCover = document.querySelector('#music-cover'); // Album arts
    const durationTime = document.querySelector('#loadingAudioDuration'); // For audio duration indicator

    let audioElement = new Audio();
    let trackList = [];
    let currentTrackIndex = 0;
    let isPlaying = false;
    let isTrackLoaded = false; // Flag to check if the current track is loaded

    // Set default icon to play toggle
    playPauseBtn.src = '../AppData/bmusic/assets/media/images/icons/general/controls/play-toggle-img.png'; // Play icon

    // Load tracks from folder
    fileInput.addEventListener('change', (event) => {
        const files = event.target.files;
        trackList = [];

        // Display music list
        musicDisplayer.innerHTML = ''; // Clear existing list
        for (let file of files) {
            if (file.type.startsWith('audio/')) {
                trackList.push(file);
                const listItem = document.createElement('li');
                listItem.classList.add('music-local-play-listed40');
                listItem.innerHTML = `
                    <div class="local-music-contents-con49">
                      </div>
                      <div class="music-name43">
                        <span class="music-name-tx43 local-music-title" id="music-title">${file.name}</span>
                      </div>
                      <div class="artist-name49">
                        <span class="artist-name-tx49 local-music-artist" id="artist-name">Unkown</span>
                      </div>
                      <div class="genre-name49">
                        <span class="artist-name-tx49 local-music-genre" id="music-genre">Unkown</span>
                      </div>
                      <div class="album-name49">
                        <span class="artist-name-tx49 local-music-album" id="music-album">Unkown</span>
                      </div>
                      <div class="duration-name49">
                        <span class="artist-name-tx49 local-music-time" id="music-duration">00:00</span>
                      </div>
                      <div class="ratings-system35">
                        <img class="star-one-icon35" id="star-1" alt="" src="../AppData/bmusic/assets/media/images/icons/general/controls/star-two.svg">
                        
                        <img class="star-two-icon35" id="star-2" alt="" src="../AppData/bmusic/assets/media/images/icons/general/controls/star-two.svg">
                        
                        <img class="star-three-icon35" id="star-3" alt="" src="../AppData/bmusic/assets/media/images/icons/general/controls/star-two.svg">
                        
                        <img class="star-four-icon35" id="star-4" alt="" src="../AppData/bmusic/assets/media/images/icons/general/controls/star-two.svg">
                        
                        <img class="star-five-icon35" id="star-5" alt="" src="../AppData/bmusic/assets/media/images/icons/general/controls/star-two.svg">
                        
                      </div>
                      <div class="added-name49">
                        <span class="artist-name-tx49 local-music-favorites" id="if-added-not">Not Added</span>
                      </div>
                      <div class="folder-name49">
                        <span class="artist-name-tx49 local-music-path-folder" id="music-path">Uploaded Folder</span>
                      </div>
                      <div class="year-name49">
                        <span class="artist-name-tx49 local-music-year" id="music-year">0000</span>
                      </div>
                      <div class="music-note30">
                        <img class="music-note-img-icon30" id="music-play-indent" alt="" src="../AppData/bmusic/assets/media/images/icons/general/controls/music-note-img.svg">
                        
                      </div>
                `;
                listItem.addEventListener('click', () => {
                    // Remove active class from all items
                    const allItems = musicDisplayer.querySelectorAll('li');
                    allItems.forEach(item => item.classList.remove('active'));
                    
                    // Add active class to the clicked item
                    listItem.classList.add('active');
                    
                    // Update current track index
                    currentTrackIndex = Array.from(allItems).indexOf(listItem);
                    loadTrack(currentTrackIndex);
                    if (isPlaying) audioElement.play();
                });

                musicDisplayer.appendChild(listItem);
            }
        }
        // Optionally save the list to local.db
        saveMusicList();
    });

    // Saving music list
    
    function saveMusicList() {
        // Your SQLite database code to save trackList here
    }

    // Start here... Album Art cover

    function loadTrack(index) {
        const track = trackList[index];
        if (track) {
            const url = URL.createObjectURL(track);
            if (!isTrackLoaded || audioElement.src !== url) {
                audioElement.src = url;
                audioElement.load();
                isTrackLoaded = true; // Mark track as loaded
            }
            
            // Update active class
            const allItems = musicDisplayer.querySelectorAll('li');
            allItems.forEach(item => item.classList.remove('active'));
            if (allItems[index]) {
                allItems[index].classList.add('active');
            }
    
            // Update cover image
            loadAlbumArt(track).then(coverImage => {
                if (coverImage) {
                    musicCover.src = coverImage;
                } else {
                    // Fallback cover image
                    musicCover.src = '../AppData/bmusic/assets/media/images/icons/general/enumarators/album.defualt.art.png';
                }
            }).catch(err => {
                console.error('Error loading album art:', err);
                musicCover.src = '../AppData/bmusic/assets/media/images/icons/general/enumarators/album.defualt.art.png'; // Default cover image
            });
        }
    }
    

    function loadAlbumArt(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function(event) {
                const dataView = new DataView(event.target.result);
                let offset = 0;
                const length = dataView.byteLength;
    
                // Look for ID3v2 header
                if (dataView.getUint8(0) === 0x49 && dataView.getUint8(1) === 0x44 && dataView.getUint8(2) === 0x33) {
                    offset = 10; // Skip ID3v2 header
    
                    while (offset < length) {
                        if (dataView.getUint8(offset) === 0x41 && dataView.getUint8(offset + 1) === 0x50 && dataView.getUint8(offset + 2) === 0x49 && dataView.getUint8(offset + 3) === 0x43) {
                            // Found APIC (Album Art) frame
                            offset += 10; // Skip frame header
    
                            const mimeTypeLength = dataView.getUint8(offset);
                            offset += mimeTypeLength + 1;
                            const pictureType = dataView.getUint8(offset);
                            offset += 1;
                            const descriptionLength = dataView.getUint8(offset);
                            offset += descriptionLength + 1;
    
                            // Extract album art data
                            const pictureDataLength = dataView.getUint32(offset + 1, false);
                            const albumArtBuffer = new Uint8Array(pictureDataLength);
                            for (let i = 0; i < pictureDataLength; i++) {
                                albumArtBuffer[i] = dataView.getUint8(offset + 1 + i);
                            }
    
                            // Convert buffer to base64
                            const base64 = btoa(String.fromCharCode.apply(null, albumArtBuffer));
                            resolve(`data:image/jpeg;base64,${base64}`);
                            return;
                        } else {
                            const frameSize = dataView.getUint32(offset + 4, false);
                            offset += frameSize + 10;
                        }
                    }
                }
                resolve(null); // No album art found
            };
            reader.onerror = function(error) {
                reject(error);
            };
            reader.readAsArrayBuffer(file);
        });
    }
    

    // End of album cover/art 

    function playTrack(index) {
        currentTrackIndex = index;
        loadTrack(currentTrackIndex);
        audioElement.play();
        isPlaying = true;
        updatePlayPauseIcon(); // Update icon when starting playback
        startDurationIndicator(); // Start the duration indicator
    }

    function updatePlayPauseIcon() {
        // Toggle icon based on isPlaying state
        if (isPlaying) {
            playPauseBtn.src = '../AppData/bmusic/assets/media/images/icons/general/controls/pause-play-img.svg'; // Pause icon
        } else {
            playPauseBtn.src = '../AppData/bmusic/assets/media/images/icons/general/controls/play-toggle-img.png'; // Play icon
        }
    }

    playPauseBtn.addEventListener('click', () => {
        if (isPlaying) {
            audioElement.pause();
            isPlaying = false;
        } else {
            if (!isTrackLoaded) {
                loadTrack(currentTrackIndex); // Load track if not loaded
            }
            audioElement.play();
            isPlaying = true;
        }
        updatePlayPauseIcon(); // Update the icon when toggling
    });

    nextBtn.addEventListener('click', () => {
        const nextIndex = (currentTrackIndex + 1) % trackList.length;
        playTrack(nextIndex);
    });

    prevBtn.addEventListener('click', () => {
        const prevIndex = (currentTrackIndex - 1 + trackList.length) % trackList.length;
        playTrack(prevIndex);
    });

    resetBtn.addEventListener('click', () => {
        // if (isPlaying) audioElement.play();
        loadTrack(currentTrackIndex);
        if (isPlaying) audioElement.play();
    });

    loopBtn.addEventListener('click', () => {
        audioElement.loop = !audioElement.loop;
        loopBtn.classList.toggle('active', audioElement.loop);
    });

    shuffleBtn.addEventListener('click', () => {
        function shuffleArray(array) {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]]; // Swap elements
            }
        }

        shuffleArray(trackList); // Shuffle the track list
        currentTrackIndex = 0; // Reset the track index
        playTrack(currentTrackIndex); // Load the first track of the shuffled list
        console.log('Track list shuffled:', trackList);
    });

    gotoBtn.addEventListener('click', () => {
        // Implement goto functionality
    });

    speakerBtn.addEventListener('input', (event) => {
        // Get the volume from the input event
        const volumeValue = event.target.value;
        // Map the volume from 0 to 170 to the audioElement volume range (0.0 to 1.0)
        const mappedVolume = Math.max(0, Math.min(170, volumeValue)) / 170;
        // Set the audio element's volume
        audioElement.volume = mappedVolume;
        console.log('Volume adjusted to:', mappedVolume);
    });

    // Error handling
    audioElement.addEventListener('error', (event) => {
        console.error('Error with audio playback:', event);
    });

    audioElement.addEventListener('canplay', () => {
        console.log('Audio can play');
    });

    audioElement.addEventListener('play', () => {
        console.log('Audio started playing');
    });

    audioElement.addEventListener('pause', () => {
        console.log('Audio paused');
    });

    // Handle track end
    audioElement.addEventListener('ended', () => {
        if (!audioElement.loop) {
            const nextIndex = (currentTrackIndex + 1) % trackList.length;
            playTrack(nextIndex);
        }
    });
});
*/

document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.querySelector('#file-1069\\:28071');
    const musicDisplayer = document.querySelector('#music-displayer');
    const playPauseBtn = document.querySelector('#pause-play-ico'); // Select the image by its ID
    const nextBtn = document.querySelector('#next-music');
    const prevBtn = document.querySelector('#previous-play');
    const resetBtn = document.querySelector('#reset-play');
    const loopBtn = document.querySelector('#loop-play');
    const shuffleBtn = document.querySelector('#shuffle-play');
    const gotoBtn = document.querySelector('#goto-play');
    const speakerBtn = document.querySelector('#adjusterVol');
    const musicCover = document.querySelector('#music-cover'); // Album arts
    const durationTime = document.querySelector('#loadingAudioDuration'); // For audio duration indicator

    let audioElement = new Audio();
    let trackList = [];
    let currentTrackIndex = 0;
    let isPlaying = false;
    let isTrackLoaded = false; // Flag to check if the current track is loaded

    // Set default icon to play toggle
    playPauseBtn.src = '../AppData/bmusic/assets/media/images/icons/general/controls/play-toggle-img.png'; // Play icon

    // Load tracks from folder
    fileInput.addEventListener('change', (event) => {
        const files = event.target.files;
        trackList = [];

        // Display music list
        musicDisplayer.innerHTML = ''; // Clear existing list
        for (let file of files) {
            if (file.type.startsWith('audio/')) {
                trackList.push(file);
                const listItem = document.createElement('li');
                listItem.classList.add('music-local-play-listed40');
                listItem.innerHTML = `
                    <div class="local-music-contents-con49">
                      </div>
                      <div class="music-name43">
                        <span class="music-name-tx43 local-music-title" id="music-title">${file.name}</span>
                      </div>
                      <div class="artist-name49">
                        <span class="artist-name-tx49 local-music-artist" id="artist-name">Unkown</span>
                      </div>
                      <div class="genre-name49">
                        <span class="artist-name-tx49 local-music-genre" id="music-genre">Unkown</span>
                      </div>
                      <div class="album-name49">
                        <span class="artist-name-tx49 local-music-album" id="music-album">Unkown</span>
                      </div>
                      <div class="duration-name49">
                        <span class="artist-name-tx49 local-music-time" id="music-duration">00:00</span>
                      </div>
                      <div class="ratings-system35">
                        <img class="star-one-icon35" id="star-1" alt="" src="../AppData/bmusic/assets/media/images/icons/general/controls/star-two.svg">
                        
                        <img class="star-two-icon35" id="star-2" alt="" src="../AppData/bmusic/assets/media/images/icons/general/controls/star-two.svg">
                        
                        <img class="star-three-icon35" id="star-3" alt="" src="../AppData/bmusic/assets/media/images/icons/general/controls/star-two.svg">
                        
                        <img class="star-four-icon35" id="star-4" alt="" src="../AppData/bmusic/assets/media/images/icons/general/controls/star-two.svg">
                        
                        <img class="star-five-icon35" id="star-5" alt="" src="../AppData/bmusic/assets/media/images/icons/general/controls/star-two.svg">
                        
                      </div>
                      <div class="added-name49">
                        <span class="artist-name-tx49 local-music-favorites" id="if-added-not">Not Added</span>
                      </div>
                      <div class="folder-name49">
                        <span class="artist-name-tx49 local-music-path-folder" id="music-path">Uploaded Folder</span>
                      </div>
                      <div class="year-name49">
                        <span class="artist-name-tx49 local-music-year" id="music-year">0000</span>
                      </div>
                      <div class="music-note30">
                        <img class="music-note-img-icon30" id="music-play-indent" alt="" src="../AppData/bmusic/assets/media/images/icons/general/controls/music-note-img.svg">
                        
                      </div>
                `;
                listItem.addEventListener('click', () => {
                    // Remove active class from all items
                    const allItems = musicDisplayer.querySelectorAll('li');
                    allItems.forEach(item => item.classList.remove('active'));
                    
                    // Add active class to the clicked item
                    listItem.classList.add('active');
                    
                    // Update current track index
                    currentTrackIndex = Array.from(allItems).indexOf(listItem);
                    loadTrack(currentTrackIndex);
                    if (isPlaying) audioElement.play();
                });

                musicDisplayer.appendChild(listItem);
            }
        }
        // Optionally save the list to local.db
        saveMusicList();
    });

    // Saving music list
    
    function saveMusicList() {
        // Your SQLite database code to save trackList here
    }

    // Start here... Album Art cover

    function loadTrack(index) {
        const track = trackList[index];
        if (track) {
            const url = URL.createObjectURL(track);
            if (!isTrackLoaded || audioElement.src !== url) {
                audioElement.src = url;
                audioElement.load();
                isTrackLoaded = true; // Mark track as loaded
            }
            
            // Update active class
            const allItems = musicDisplayer.querySelectorAll('li');
            allItems.forEach(item => item.classList.remove('active'));
            if (allItems[index]) {
                allItems[index].classList.add('active');
            }
    
            // Update cover image
            loadAlbumArt(track).then(coverImage => {
                if (coverImage) {
                    musicCover.src = coverImage;
                } else {
                    // Fallback cover image
                    musicCover.src = '../AppData/bmusic/assets/media/images/icons/general/enumarators/album.defualt.art.png';
                }
            }).catch(err => {
                console.error('Error loading album art:', err);
                musicCover.src = '../AppData/bmusic/assets/media/images/icons/general/enumarators/album.defualt.art.png'; // Default cover image
            });
        }
    }
    

    function loadAlbumArt(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function(event) {
                const dataView = new DataView(event.target.result);
                let offset = 0;
                const length = dataView.byteLength;
    
                // Look for ID3v2 header
                if (dataView.getUint8(0) === 0x49 && dataView.getUint8(1) === 0x44 && dataView.getUint8(2) === 0x33) {
                    offset = 10; // Skip ID3v2 header
    
                    while (offset < length) {
                        if (dataView.getUint8(offset) === 0x41 && dataView.getUint8(offset + 1) === 0x50 && dataView.getUint8(offset + 2) === 0x49 && dataView.getUint8(offset + 3) === 0x43) {
                            // Found APIC (Album Art) frame
                            offset += 10; // Skip frame header
    
                            const mimeTypeLength = dataView.getUint8(offset);
                            offset += mimeTypeLength + 1;
                            const pictureType = dataView.getUint8(offset);
                            offset += 1;
                            const descriptionLength = dataView.getUint8(offset);
                            offset += descriptionLength + 1;
    
                            // Extract album art data
                            const pictureDataLength = dataView.getUint32(offset + 1, false);
                            const albumArtBuffer = new Uint8Array(pictureDataLength);
                            for (let i = 0; i < pictureDataLength; i++) {
                                albumArtBuffer[i] = dataView.getUint8(offset + 1 + i);
                            }
    
                            // Convert buffer to base64
                            const base64 = btoa(String.fromCharCode.apply(null, albumArtBuffer));
                            resolve(`data:image/jpeg;base64,${base64}`);
                            return;
                        } else {
                            const frameSize = dataView.getUint32(offset + 4, false);
                            offset += frameSize + 10;
                        }
                    }
                }
                resolve(null); // No album art found
            };
            reader.onerror = function(error) {
                reject(error);
            };
            reader.readAsArrayBuffer(file);
        });
    }
    

    // End of album cover/art 

    function playTrack(index) {
        currentTrackIndex = index;
        loadTrack(currentTrackIndex);
        audioElement.play();
        isPlaying = true;
        updatePlayPauseIcon(); // Update icon when starting playback
        startDurationIndicator(); // Start the duration indicator
    }

    function updatePlayPauseIcon() {
        // Toggle icon based on isPlaying state
        if (isPlaying) {
            playPauseBtn.src = '../AppData/bmusic/assets/media/images/icons/general/controls/pause-play-img.svg'; // Pause icon
        } else {
            playPauseBtn.src = '../AppData/bmusic/assets/media/images/icons/general/controls/play-toggle-img.png'; // Play icon
        }
    }

    playPauseBtn.addEventListener('click', () => {
        if (isPlaying) {
            audioElement.pause();
            isPlaying = false;
        } else {
            if (!isTrackLoaded) {
                loadTrack(currentTrackIndex); // Load track if not loaded
            }
            audioElement.play();
            isPlaying = true;
        }
        updatePlayPauseIcon(); // Update the icon when toggling
    });

    nextBtn.addEventListener('click', () => {
        const nextIndex = (currentTrackIndex + 1) % trackList.length;
        playTrack(nextIndex);
    });

    prevBtn.addEventListener('click', () => {
        const prevIndex = (currentTrackIndex - 1 + trackList.length) % trackList.length;
        playTrack(prevIndex);
    });

    resetBtn.addEventListener('click', () => {
        // if (isPlaying) audioElement.play();
        loadTrack(currentTrackIndex);
        if (isPlaying) audioElement.play();
    });

    loopBtn.addEventListener('click', () => {
        audioElement.loop = !audioElement.loop;
        loopBtn.classList.toggle('active', audioElement.loop);
    });

    shuffleBtn.addEventListener('click', () => {
        function shuffleArray(array) {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]]; // Swap elements
            }
        }

        shuffleArray(trackList); // Shuffle the track list
        currentTrackIndex = 0; // Reset the track index
        playTrack(currentTrackIndex); // Load the first track of the shuffled list
        console.log('Track list shuffled:', trackList);
    });

    gotoBtn.addEventListener('click', () => {
        // Implement goto functionality
    });

    speakerBtn.addEventListener('input', (event) => {
        // Get the volume from the input event
        const volumeValue = event.target.value;
        // Map the volume from 0 to 170 to the audioElement volume range (0.0 to 1.0)
        const mappedVolume = Math.max(0, Math.min(170, volumeValue)) / 170;
        // Set the audio element's volume
        audioElement.volume = mappedVolume;
        console.log('Volume adjusted to:', mappedVolume);
    });

    // Error handling
    audioElement.addEventListener('error', (event) => {
        console.error('Error with audio playback:', event);
    });

    audioElement.addEventListener('canplay', () => {
        console.log('Audio can play');
    });

    audioElement.addEventListener('play', () => {
        console.log('Audio started playing');
    });

    audioElement.addEventListener('pause', () => {
        console.log('Audio paused');
    });

    // Handle track end
    audioElement.addEventListener('ended', () => {
        if (!audioElement.loop) {
            const nextIndex = (currentTrackIndex + 1) % trackList.length;
            playTrack(nextIndex);
        }
    });
});













