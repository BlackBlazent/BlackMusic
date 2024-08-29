// CPU usage

document.addEventListener('DOMContentLoaded', () => {
    function updateCPUUsage(cpuUsage) {
        const bars = document.querySelectorAll('.level-scale-bar-con222');
        const percentageActor = document.getElementById('percentage-actor');

        // Update the percentage text
        percentageActor.textContent = `${cpuUsage}%`;

        // Determine the color based on CPU usage
        let color;
        if (cpuUsage < 30) {
            color = 'green';
        } else if (cpuUsage < 60) {
            color = 'yellow';
        } else if (cpuUsage < 90) {
            color = 'blue';
        } else {
            color = 'red';
        }

        // Update the bar colors
        bars.forEach(bar => {
            bar.style.backgroundColor = color;
        });
    }

    function getCurrentCPUUsage() {
        // Implement this function to return the current CPU usage percentage.
        // For demonstration, return a random number between 0 and 100.
        return Math.floor(Math.random() * 101);
    }

    // Initial update
    updateCPUUsage(getCurrentCPUUsage());

    // Update CPU usage every 3 seconds
    setInterval(() => {
        const cpuUsage = getCurrentCPUUsage(); // Replace with actual CPU usage retrieval logic
        updateCPUUsage(cpuUsage);
    }, 3000); // 3000 milliseconds = 3 seconds
});
