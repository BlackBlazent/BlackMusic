/*const imageElement = document.getElementById('background-cover');

// Function to fetch the API key from the server
async function fetchApiKey() {
    try {
        const response = await fetch('http://localhost:3000/api/key'); // Ensure the port matches your server
        const data = await response.json();
        return data.api_key;
    } catch (error) {
        console.error('Error fetching API key:', error);
    }
}

// Function to fetch a new background image from NASA API
async function fetchNewBackgroundImage() {
    const apiKey = await fetchApiKey();
    if (!apiKey) {
        console.error('No API key available');
        return;
    }

    try {
        const response = await fetch(`https://api.nasa.gov/planetary/apod?api_key=${apiKey}`);
        const data = await response.json();
        const imageUrl = data.url; // Adjust according to the JSON structure returned by your API

        // Update the image source
        imageElement.src = imageUrl;
    } catch (error) {
        console.error('Error fetching image:', error);
    }
}

// Update the background image every 5 seconds
setInterval(fetchNewBackgroundImage, 5000);

// Fetch an image immediately when the page loads
fetchNewBackgroundImage(); */

document.addEventListener('DOMContentLoaded', () => {
    const quotesDisplay = document.getElementById('quotes-display');

    function fetchQuotes() {
        return fetch("https://type.fit/api/quotes")
            .then(response => response.json())
            .then(data => {
                // Check if data is an array and has at least one item
                if (Array.isArray(data) && data.length > 0) {
                    return data;
                } else {
                    throw new Error('No quotes found');
                }
            })
            .catch(error => {
                console.error('Error fetching quotes:', error);
                return []; // Return an empty array in case of error
            });
    }

    function displayQuote(quotes) {
        if (quotes.length === 0) {
            quotesDisplay.textContent = 'No quotes available.';
            return;
        }

        // Select a random quote
        const randomIndex = Math.floor(Math.random() * quotes.length);
        const quote = quotes[randomIndex];

        // Display the quote
        quotesDisplay.textContent = `"${quote.text}" - ${quote.author || 'Unknown'}`;
    }

    // Fetch and display a quote
    fetchQuotes()
        .then(quotes => displayQuote(quotes))
        .catch(error => {
            console.error('Error displaying quote:', error);
        });
});
