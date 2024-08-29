// For Langauge the conatiner
function popupLangSelect() {
    document.getElementById(
        "select-app-lang"
    ).style.display = "block";
}
function closeLangSelect() {
    document.getElementById(
        "select-app-lang"
    ).style.display = "none";
}

/* Dragging Shop */

document.addEventListener('DOMContentLoaded', () => {
    const popups = document.querySelectorAll('.select-langauge-pop-window7');

    popups.forEach(popup => {
        let isDragging = false;
        let offsetX, offsetY;

        popup.addEventListener('mousedown', (e) => {
            // Start dragging
            isDragging = true;

            // Calculate the offset
            offsetX = e.clientX - popup.offsetLeft;
            offsetY = e.clientY - popup.offsetTop;
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                // Prevent text selection while dragging
                e.preventDefault();

                // Move the pop-up
                popup.style.left = `${e.clientX - offsetX}px`;
                popup.style.top = `${e.clientY - offsetY}px`;
            }
        });

        document.addEventListener('mouseup', () => {
            // Stop dragging
            isDragging = false;
        });
    });
});

// For manifest search result ""

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search-input');
    const ul = document.querySelector('.langauge-collection-items7');
    const listItems = document.querySelectorAll('.language-card31');

    // Function to filter and show list items based on search input
    function filterList() {
        const searchTerm = searchInput.value.toLowerCase(); // Get the search term in lowercase

        listItems.forEach(item => {
            const itemText = item.textContent.toLowerCase(); // Get the text of each item in lowercase
            if (itemText.includes(searchTerm)) {
                item.style.display = ''; // Show item if it matches the search term
            } else {
                item.style.display = 'none'; // Hide item if it doesn't match
            }
        });
    }

    // Add event listener to search input to filter list items on input
    searchInput.addEventListener('input', filterList);
});


// For langauge support

/*document.addEventListener('DOMContentLoaded', () => {
    const checkboxes = document.querySelectorAll('.check-land-used31');

    // Function to handle checkbox change
    function handleCheckboxChange(event) {
        if (event.target.checked) {
            checkboxes.forEach(checkbox => {
                if (checkbox !== event.target) {
                    checkbox.checked = false;
                }
            });
        }
    }

    // Add event listeners to each checkbox
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', handleCheckboxChange);
    });

    // Set Arabic checkbox as checked by default
    document.getElementById('for-english').checked = true;
});*/

document.addEventListener('DOMContentLoaded', () => {
    const checkboxes = document.querySelectorAll('.check-land-used31');
    const translateToggle = document.getElementById('ratogge-seeker');
    const toggleContainer = document.querySelector('.enable-disable-google-range');

    // Function to handle checkbox change
    function handleCheckboxChange(event) {
        if (event.target.checked) {
            checkboxes.forEach(checkbox => {
                if (checkbox !== event.target) {
                    checkbox.checked = false;
                }
            });
            // Trigger translation
            translatePage(event.target.id);
        }
    }

    // Add event listeners to each checkbox
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', handleCheckboxChange);
    });

    // Set default checkbox
    document.getElementById('for-english').checked = true;

    // Handle toggle switch
    translateToggle.addEventListener('click', () => {
        if (toggleContainer.classList.contains('active')) {
            toggleContainer.classList.remove('active');
            // Disable translation
            disableTranslation();
        } else {
            toggleContainer.classList.add('active');
            // Enable translation if checkbox is checked
            const selectedLanguage = Array.from(checkboxes).find(checkbox => checkbox.checked);
            if (selectedLanguage) {
                translatePage(selectedLanguage.id);
            }
        }
    });
});

function translatePage(languageId) {
    const languageMap = {
        'for-english': 'en',
        'for-arabic': 'ar'
        // Add more mappings for other languages
    };

    const languageCode = languageMap[languageId];

    if (languageCode) {
        // Load Google Translate script if not already loaded
        if (!document.getElementById('google-translate-script')) {
            const script = document.createElement('script');
            script.id = 'google-translate-script';
            script.src = `https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit`;
            document.body.appendChild(script);
        } else {
            // Reinitialize Google Translate if already loaded
            initializeTranslate(languageCode);
        }
    }
}

function initializeTranslate(languageCode) {
    window.googleTranslateElementInit = () => {
        new google.translate.TranslateElement({
            pageLanguage: 'en', // Original language of your content
            includedLanguages: languageCode
        }, 'google_translate_element');
    };
}

function disableTranslation() {
    // Clear Google Translate elements
    const googleTranslateElement = document.querySelector('#google_translate_element');
    if (googleTranslateElement) {
        googleTranslateElement.innerHTML = ''; // Clear translation elements
    }
    
    // Remove Google Translate script if necessary
    const script = document.getElementById('google-translate-script');
    if (script) {
        script.remove();
    }
    
    // Optionally, manually reset the content to default language (English)
    initializeTranslate('en');
}




// If online
/*
document.addEventListener('DOMContentLoaded', () => {
    const checkboxes = document.querySelectorAll('.check-land-used31');
    const apiKey = 'DMevShbOi41Ca9PtZwGPZD0FagDb63KD';
    const apiUrl = 'https://api.apilayer.com/language_translation/translate';

    // Function to handle checkbox change
    function handleCheckboxChange(event) {
        const selectedLanguage = event.target.id.replace('for-', '');
        if (event.target.checked) {
            checkboxes.forEach(checkbox => {
                if (checkbox !== event.target) {
                    checkbox.checked = false;
                }
            });
            translatePage(selectedLanguage);
        } else {
            // Uncheck all if deselected
            translatePage(null);
        }
    }

    // Function to translate the page
    function translatePage(language) {
        const elements = document.querySelectorAll('div, span, h1, h2, h3, h4, h5, h6, b, p, button, header');
        const texts = Array.from(elements).map(el => ({ element: el, text: el.textContent }));

        if (!language) {
            // Reset text if no language selected
            texts.forEach(({ element, text }) => {
                element.textContent = text;
            });
            return;
        }

        texts.forEach(({ element, text }) => {
            fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'apikey': apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: text,
                    target_lang: language
                })
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data && data.translated_text) {
                    element.textContent = data.translated_text;
                } else {
                    console.log('No translated text received:', data);
                }
            })
            .catch(error => console.log('Translation error:', error));
        });
    }

    // Add event listeners to each checkbox
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', handleCheckboxChange);
    });

    // Set default language checkbox as checked
    document.getElementById('for-english').checked = true;
    translatePage('en'); // Assuming 'en' is the code for English
});
*/