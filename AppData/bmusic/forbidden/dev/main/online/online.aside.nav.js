// From Billboard Scraper Navigation Tabs Control

document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.online-music-subnav-left-toggl3 li');
    
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