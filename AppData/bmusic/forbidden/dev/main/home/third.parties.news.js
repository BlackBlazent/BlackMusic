// From Agency Entertainment Industry Scraper Navigation Profile Tabs

document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.music-profile-industry-profile4 li');
    
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

// For Agency arrow functions

document.addEventListener('DOMContentLoaded', () => {
    const container = document.querySelector('.music-profile-industry-profile4');
    const items = document.querySelectorAll('.music-profile-industry12');
    const prevButton = document.querySelector('.music-production-left-arrow2');
    const nextButton = document.querySelector('.custom-style-right');
    
    let currentIndex = 0;
    const itemWidth = items[0].getBoundingClientRect().width; // Get the width of a single item
    const totalItems = items.length;

    function updateCarousel() {
        const offset = -currentIndex * 2; // Calculate offset based on item width
        container.style.transform = `translateX(${offset}px)`;
        container.style.transition = 'transform 0.5s ease'; // Add smooth transition
    }

    function showNext() {
        currentIndex = (currentIndex + 1) % totalItems; // Move to the next item
        updateCarousel();
    }

    function showPrev() {
        currentIndex = (currentIndex - 1 + totalItems) % totalItems; // Move to the previous item
        updateCarousel();
    }

    nextButton.addEventListener('click', showNext);
    prevButton.addEventListener('click', showPrev);

    // Initialize the carousel position
    updateCarousel();
});