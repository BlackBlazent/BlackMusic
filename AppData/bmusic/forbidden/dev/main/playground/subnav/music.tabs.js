document.addEventListener('DOMContentLoaded', () => {
    const sections = {
        tracks: document.getElementById('tracksMusic'),
        albums: document.getElementById('albumsMusic'),
        genres: document.getElementById('genreMusics'),
        artists: document.getElementById('artistMusics'),
        favorites: document.getElementById('favoritesMusic'),
        playlists: document.getElementById('playlistMusics')
    };

    const buttons = {
        tracks: document.getElementById('forTracks'),
        albums: document.getElementById('forAlbums'),
        genres: document.getElementById('forGenre'),
        artists: document.getElementById('forArtists'),
        favorites: document.getElementById('forFavorites'),
        playlists: document.getElementById('forPlaylist')
    };

    const loader = document.getElementById('page-loader');

    function showSection(section) {
        // Show the loader
        loader.style.display = 'block';

        // Delay the hiding of loader to give a smooth transition
        setTimeout(() => {
            for (let key in sections) {
                sections[key].style.display = 'none';
                buttons[key].classList.remove('active'); // Remove the active class from all buttons
            }
            sections[section].style.display = 'block';
            buttons[section].classList.add('active'); // Add the active class to the clicked button

            // Hide the loader after the section has been shown
            loader.style.display = 'none';
        }, 500); // Adjust delay to suit your needs
    }

    buttons.tracks.addEventListener('click', () => showSection('tracks'));
    buttons.albums.addEventListener('click', () => showSection('albums'));
    buttons.genres.addEventListener('click', () => showSection('genres'));
    buttons.artists.addEventListener('click', () => showSection('artists'));
    buttons.favorites.addEventListener('click', () => showSection('favorites'));
    buttons.playlists.addEventListener('click', () => showSection('playlists'));

    // Set default active section
    showSection('tracks');
});

document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.playlist-navbar-navigation-ite3 li');
    
    function setActiveTab(selectedTab) {
        // Remove 'active-tab' class from all tabs
        tabs.forEach(tab => tab.classList.remove('active-tab'));
        
        // Add 'active-tab' class to the selected tab
        selectedTab.classList.add('active-tab');
    }

    // Set the default active tab
    setActiveTab(tabs[0]); // Set the first tab as default active

    // Add click event listeners to all tabs
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            setActiveTab(tab);
        });
    });
});
