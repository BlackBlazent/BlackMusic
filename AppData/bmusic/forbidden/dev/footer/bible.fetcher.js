/*const API_KEY = 'a8795373dca57056475559149310c069';
        const verseTitleElement = document.getElementById('verse-title-header');
        const verseMessageElement = document.querySelector('.bible-verse-description-tx6');

        const BIBLE_ID = 'de4e12af7f28f599-02'; // Using ESV translation ID
        const VERSES = [
            'JER.29.11',
            'PSA.23',
            '1COR.13.4-8',
            'PHP.4.13',
            'JHN.3.16',
            'ROM.8.28',
            'ISA.41.10',
            'PSA.46.1',
            'GAL.5.22-23',
            'HEB.11.1',
            '2TI.1.7',
            '1COR.10.13',
            'PRO.22.6',
            'ISA.40.31',
            'JOS.1.9',
            'HEB.12.2',
            'MAT.11.28',
            'ROM.10.9-10',
            'PHP.2.3-4',
            'MAT.5.43-44',
        ];

        const verseIndex = Math.floor(Math.random() * VERSES.length);
        const verseID = VERSES[verseIndex];

        // Function to fetch the Bible verse
        async function fetchBibleVerse() {
            const apiUrl = `https://api.scripture.api.bible/v1/bibles/${BIBLE_ID}/verses/${verseID}`;

            try {
                const response = await fetch(apiUrl, {
                    headers: {
                        'api-key': API_KEY
                    }
                });
                const data = await response.json();
                console.log(data); // Log the entire response

                // Assuming the response data has 'content' and 'reference' fields
                const verseTitle = data.reference; // Adjust according to the actual response structure
                const verseMessage = data.content; // Adjust according to the actual response structure

                // Update the HTML elements
                verseTitleElement.textContent = verseTitle;
                verseMessageElement.innerHTML = verseMessage; // Use innerHTML if content has HTML tags
            } catch (error) {
                console.error('Error fetching Bible verse:', error);
            }
        }

        // Fetch the Bible verse when the page loads
        fetchBibleVerse();

        // Optionally, you can fetch a new verse every 24 hours
        setInterval(fetchBibleVerse, 24 * 60 * 60 * 1000); // 24 hours in milliseconds*/

        /*document.addEventListener('DOMContentLoaded', () => {
            fetch("https://cdn.jsdelivr.net/gh/wldeh/bible-api/bibles/en-asv/books/genesis/chapters/1/verses/1.json")
              .then(response => response.json())
              .then(data => {
                // Check data structure
                console.log(data); 
          
                // Default values in case properties are undefined
                const chapter = data.chapter || 'Unknown Chapter';
                const verse = data.verse || 'Unknown Verse';
                const text = data.text || 'No text available';
          
                // Display chapter and verse
                document.getElementById('verse-title-header').textContent = `Genesis ${chapter}:${verse}`;
                document.getElementById('verseRef').textContent = text;
              })
              .catch(error => console.error('Error fetching data:', error));
          });*/
          
          document.addEventListener('DOMContentLoaded', () => {
            const onlineUrl = "https://cdn.jsdelivr.net/gh/wldeh/bible-api/bibles/en-asv/books/genesis/chapters/1/verses/1.json";
            const offlineUrl = "./bible.verse.offline.json"; // Path to your local JSON file
        
            function fetchVerse(url) {
                return fetch(url)
                    .then(response => response.json())
                    .catch(error => {
                        console.error('Error fetching data:', error);
                        // Fallback to local JSON file if online fetch fails
                        if (url === onlineUrl) {
                            return fetchOfflineVerse();
                        }
                        return Promise.reject(error);
                    });
            }
        
            function fetchOfflineVerse() {
                return fetch(offlineUrl)
                    .then(response => response.json())
                    .catch(error => {
                        console.error('Error fetching offline data:', error);
                        return Promise.reject(error);
                    });
            }
        
            function displayVerse(data) {
                const chapter = data.chapter || 'Unknown Chapter';
                const verse = data.verse || 'Unknown Verse';
                const text = data.text || 'No text available';
        
                document.getElementById('verse-title-header').textContent = `Genesis ${chapter}:${verse}`;
                document.getElementById('verseRef').textContent = text;
            }
        
            fetchVerse(onlineUrl)
                .then(data => {
                    console.log(data); // Check the data structure
                    displayVerse(data);
                })
                .catch(error => {
                    console.error('Error displaying verse:', error);
                    // Handle any additional errors
                });
        });
        
          