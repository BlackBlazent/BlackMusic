document.addEventListener('DOMContentLoaded', () => {
    const sections = {
        home: document.getElementById('home-the-music-news-sec'),
        playground: document.getElementById('playground-for-the-tyrant-sec'),
        local: document.getElementById('localized-music'),
        online: document.getElementById('online-streaming-music'),
        library: document.getElementById('librarian-music'),
        toolkits: document.getElementById('toolkits-music')
    };

    const buttons = {
        home: document.getElementById('home-direct'),
        playground: document.getElementById('playground-direct'),
        local: document.getElementById('local-direct'),
        online: document.getElementById('online-direct'),
        library: document.getElementById('library-direct'),
        toolkits: document.getElementById('toolkits-direct')
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

    buttons.home.addEventListener('click', () => showSection('home'));
    buttons.playground.addEventListener('click', () => showSection('playground'));
    buttons.local.addEventListener('click', () => showSection('local'));
    buttons.online.addEventListener('click', () => showSection('online'));
    buttons.library.addEventListener('click', () => showSection('library'));
    buttons.toolkits.addEventListener('click', () => showSection('toolkits'));

    // Set default active section
    showSection('home');
});

document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.section-toggles-item5 li');
    
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
