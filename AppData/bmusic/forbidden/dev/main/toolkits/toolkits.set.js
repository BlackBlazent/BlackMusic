document.addEventListener('DOMContentLoaded', () => {
    const sections = {
        download: document.getElementById('downloader-i'),
        recognition: document.getElementById('recognition-i'),
        converter: document.getElementById('converter-i'),
        generator: document.getElementById('generator-i'),
    };

    const buttons = {
        download: document.getElementById('download-direct'),
        recognition: document.getElementById('recognition-direct'),
        converter: document.getElementById('converter-direct'),
        generator: document.getElementById('generator-direct'),
    };

    function showSection(section) {
        for (let key in sections) {
            sections[key].style.display = 'none';
            buttons[key].classList.remove('active'); // Remove the active class from all buttons
        }
        sections[section].style.display = 'block';
        buttons[section].classList.add('active'); // Add the active class to the clicked button
    }

    buttons.download.addEventListener('click', () => showSection('download'));
    buttons.recognition.addEventListener('click', () => showSection('recognition'));
    buttons.converter.addEventListener('click', () => showSection('converter'));
    buttons.generator.addEventListener('click', () => showSection('generator'));

    // Set default active section
    showSection('download');
});


// From Section Toggles Active Tabs

document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.bmusic-toolkit-tabs-toggle2 li');
    
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