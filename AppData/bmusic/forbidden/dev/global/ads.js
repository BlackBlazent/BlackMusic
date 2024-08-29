document.addEventListener('DOMContentLoaded', () => {
    const authorSpan = document.getElementById('showAds');
    const popup = document.getElementById('showAdsPopup');

    // Function to show the pop-up
    function showPopup() {
        popup.style.display = 'block';
    }

    // Function to hide the pop-up
    function hidePopup() {
        popup.style.display = 'none';
    }

    // Event listener for hovering over the author span
    authorSpan.addEventListener('mouseenter', showPopup);

    // Event listener for leaving the author span
    authorSpan.addEventListener('mouseleave', (event) => {
        // Set a timeout to allow for moving the mouse to the pop-up
        setTimeout(() => {
            if (!popup.contains(event.relatedTarget)) {
                hidePopup();
            }
        }, 100);
    });

    // Event listener for hovering over the pop-up
    popup.addEventListener('mouseenter', showPopup);

    // Event listener for leaving the pop-up
    popup.addEventListener('mouseleave', hidePopup);
});

// Ads Services