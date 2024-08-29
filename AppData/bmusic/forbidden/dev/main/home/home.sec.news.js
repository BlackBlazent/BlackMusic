// Function to show the pop-up | Select Country
function popupNews() {
    const popup = document.getElementById("popup-home-news-country");
    popup.style.display = "block";

    // Hide pop-up when clicking outside of it or clicking elements inside it
    document.addEventListener('click', (event) => {
        const isClickInside = popup.contains(event.target) || event.target.id === "toggle-popup-button";
        if (!isClickInside) {
            popup.style.display = "none";
        } else if (popup.contains(event.target)) {
            // Close pop-up if any element inside the pop-up is clicked
            popup.style.display = "none";
        }
    });

    // Hide pop-up when the mouse leaves the pop-up
    popup.addEventListener('mouseleave', () => {
        popup.style.display = "none";
    });
}









