// Switching tabs

document.addEventListener('DOMContentLoaded', () => {
    const sections = {
        global: document.getElementById('GlobalNews'),
        charts: document.getElementById('GlobalCharts'),
        popular: document.getElementById('GlobalPopular'),
        billboard: document.getElementById('GlobalBillboard'),
        awards: document.getElementById('GlobalAwards')
    };

    const buttons = {
        global: document.getElementById('forGlobalNews'),
        charts: document.getElementById('forChartNews'),
        popular: document.getElementById('forPopularNews'),
        billboard: document.getElementById('forBillboardNews'),
        awards: document.getElementById('forAwardsNews')
    };

    const loader = document.getElementById('page-loader');

    function showSection(section) {
        // Show the loader
        loader.style.display = 'block';

        // Delay the hiding of loader to give a smooth transition
        setTimeout(() => {
            for (let key in sections) {
                sections[key].style.display = 'none';
                buttons[key].classList.remove('active'); // Remove the active class from all buttons
            }
            sections[section].style.display = 'block';
            buttons[section].classList.add('active'); // Add the active class to the clicked button

            // Hide the loader after the section has been shown
            loader.style.display = 'none';
        }, 500); // Adjust delay to suit your needs
    }

    buttons.global.addEventListener('click', () => showSection('global'));
    buttons.charts.addEventListener('click', () => showSection('charts'));
    buttons.popular.addEventListener('click', () => showSection('popular'));
    buttons.billboard.addEventListener('click', () => showSection('billboard'));
    buttons.awards.addEventListener('click', () => showSection('awards'));

    // Set default active section
    showSection('global');
});

document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.home-sec-navtab-toggles2 switch-tab-content li');
    
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


// From Billboard Scraper Navigation Tabs Control
/*
document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.home-sec-navtab-toggles2 li');
    
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
*/

// From Billboard scraper

// Global News

const axios = require('axios');
const cheerio = require('cheerio');

// Function to scrape Billboard Global News
async function scrapeGlobalNews() {
  try {
    const { data } = await axios.get('https://www.billboard.com/t/global/');
    const $ = cheerio.load(data);

    const articles = [];

    $('.a-crop-3x2').each((i, element) => {
      const coverImage = $(element).find('img').attr('src');
      const titleElement = $(element).siblings().find('#title-of-a-story a');
      const title = titleElement.text().trim();
      const link = titleElement.attr('href');
      const author = $(element).siblings().find('a span').text().trim();
      const timePosted = $(element).siblings().find('.c-timestamp').text().trim();

      articles.push({
        coverImage,
        title,
        link: `https://www.billboard.com${link}`,
        author,
        timePosted
      });
    });

    return articles;
  } catch (error) {
    console.error('Error scraping Global News:', error);
  }
}


// Function to render articles
function renderArticles(articles) {
    const newsContainer = document.getElementById('news-displayer');
    newsContainer.innerHTML = '';
  
    articles.forEach(article => {
      const listItem = document.createElement('li');
      listItem.className = 'news-story-card9 list-card';
      listItem.innerHTML = `
        <div class="news-story-card-cover9">
          <img class="news-story-card-cover-img-icon9" id="cover-article" alt="" src="${article.coverImage}">
        </div>
        <div class="news-story-card-title9">
          <h1 class="news-story-card-title-tx9">
            <p class="all-the-surprise9" id="title-of-a-story">
              <a class="lrv-a-unstyle-link" href="${article.link}" target="_blank" id="music-news-title">${article.title}</a>
            </p>
          </h1>
        </div>
        <div class="author-of-story-news9">
          <h2 class="the-author-news9">Author:</h2>
          <span class="ashley-iasimone9"><a href="#" target="_blank" id="music-news-author">${article.author}</a></span>
        </div>
        <div class="news-time-posted9">
          <span class="news-time-posted-tx9">${article.timePosted}</span>
        </div>
      `;
      newsContainer.appendChild(listItem);
    });
  }
  
  // Fetch and display articles when Global News tab is active
  document.addEventListener('DOMContentLoaded', async () => {
    if (document.querySelector('.forGlobalNews')) {
      const articles = await scrapeGlobalNews();
      renderArticles(articles);
    }
  });
