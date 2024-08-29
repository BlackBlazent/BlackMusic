document.querySelectorAll('.home-sec-navtab-toggles2 li').forEach(tab => {
    tab.addEventListener('click', async () => {
        const url = tab.getAttribute('data-url');
        const response = await fetch(url);
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Clear previous content
        const newsDisplayer = document.getElementById('news-displayer');
        newsDisplayer.innerHTML = '';

        // Extract data and populate news stories
        const articles = doc.querySelectorAll('.article-selector'); // Adjust this selector
        articles.forEach(article => {
            const title = article.querySelector('.c-title').textContent; // Adjust this selector
            const link = article.querySelector('.c-title__link a').href; // Adjust this selector
            const author = article.querySelector('.c-tagline span').textContent; // Adjust this selector
            const authorLink = article.querySelector('div a').href; // Adjust this selector
            const time = article.querySelector('.c-timestamp  time').textContent; // Adjust this selector
            const imageSrc = article.querySelector('.lazy-image__img').src; // Adjust this selector
            
            const li = document.createElement('li');
            li.className = 'news-story-card9 list-card';
            li.innerHTML = `
                <div class="news-story-card-cover9">
                    <img class="news-story-card-cover-img-icon9" src="${imageSrc}" alt="Cover Image">
                </div>
                <div class="news-story-card-title9">
                    <h1 class="news-story-card-title-tx9">
                        <p class="all-the-surprise9"><a href="${link}" target="_blank">${title}</a></p>
                    </h1>
                </div>
                <div class="author-of-story-news9">
                    <h2 class="the-author-news9">Author:</h2>
                    <span class="ashley-iasimone9"><a href="${authorLink}" target="_blank">${author}</a></span>
                </div>
                <div class="news-time-posted9">
                    <span class="news-time-posted-tx9">${time}</span>
                </div>
            `;
            newsDisplayer.appendChild(li);
        });
    });
});