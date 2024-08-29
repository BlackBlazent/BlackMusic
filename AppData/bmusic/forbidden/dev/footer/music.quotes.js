// Music quotes

document.addEventListener('DOMContentLoaded', () => {
    const authorSpan = document.getElementById('quotes-author');
    const popup = document.getElementById('dialog-pop-up');

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




// Music Qoutes Background images
/*
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors'); // Import CORS middleware

const app = express();
const port = 3000; // Make sure this matches your fetch URL

// Use CORS middleware
app.use(cors());

function getApiKey() {
    const filePath = path.resolve(__dirname, '../../app/database/api/quotes.py');
    const content = fs.readFileSync(filePath, 'utf8');
    const apiKeyMatch = content.match(/API_KEY\s*=\s*['"]([^'"]+)['"]/);
    return apiKeyMatch ? apiKeyMatch[1] : null;
}

app.get('/api/key', (req, res) => {
    const apiKey = getApiKey();
    if (apiKey) {
        res.json({ api_key: apiKey });
    } else {
        res.status(500).json({ error: 'API key not found' });
    }
});

app.use(express.static('public')); // Serve static files

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
*/

// Music Quote local background...
document.addEventListener("DOMContentLoaded", function() {
    const imageElement = document.getElementById('background-cover');
    const imageFolderPath = '../AppData/bmusic/assets/media/images/icons/general/quotes/';
    const images = [
        'bg_back.1.jpg',
        'bg_back.2.jpg',
        'bg_back.3.jpg',
        'bg_back.4.jpg',
        'bg_back.5.jpg',
        'bg_back.6.jpg',
        'bg_back.7.jpg',
        'bg_back.8.jpg',
        'bg_back.9.jpg',
        'bg_back.10.jpg',
        'bg_back.11.jpg',
        'bg_back.12.jpg',
        'bg_back.13.jpg',
        'bg_back.14.jpg',
        'bg_back.15.jpg'
        // ...
    ];

    let currentImageIndex = 0;

    function updateImage() {
        // Construct the full image path
        const imagePath = imageFolderPath + images[currentImageIndex];
        console.log('Updating image to:', imagePath); // Log the image path for troubleshooting
        // Update the src attribute of the image element
        imageElement.src = imagePath;

        // Update the current image index to the next one
        currentImageIndex = (currentImageIndex + 1) % images.length;
    }

    // Set the initial image
    updateImage();

    // Update the image every 20 seconds
    setInterval(updateImage, 20000); // 20000 milliseconds = 20 seconds
});







