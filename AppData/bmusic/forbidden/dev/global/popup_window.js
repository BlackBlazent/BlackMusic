// select all <a> elements on the page
const allLinks = document.querySelectorAll('a');

// add click event listener to each <a> element
allLinks.forEach(link => {
  link.addEventListener('click', event => {
    event.preventDefault(); // prevent the default link behavior

    // get the URL and window dimensions from the link's href attribute and any additional data attributes
    const url = link.getAttribute('href');
    const width = link.getAttribute('data-width') || '800';
    const height = link.getAttribute('data-height') || '600';

    // calculate the position to center the pop-up window on the screen
    const left = (window.innerWidth / 2) - (width / 2);
    const top = (window.innerHeight / 2) - (height / 2);

    // open the URL in a new pop-up window with the specified dimensions and position
    window.open(url, '_blank', `width=${width},height=${height},left=${left},top=${top}`);
  });
});