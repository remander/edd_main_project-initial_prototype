// Project Name: PosturePro
// File Name: faq-procedure.js
// Date: 24 May 2025
// Description: FAQ procedure for PosturePro application. Provides functionality to handle the dropdown menu for FAQ categories and display relevant questions.
// Group: Sensor-4

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
  const items = document.querySelectorAll('.faq-accordion button');

  function toggleAccordion() {
    const itemToggle = this.getAttribute('aria-expanded');

    // Close all accordion items (fixed: added 'let' declaration)
    for (let i = 0; i < items.length; i++) {
      items[i].setAttribute('aria-expanded', 'false');
    }

    // Open the clicked item if it was closed
    if (itemToggle === 'false') {
      this.setAttribute('aria-expanded', 'true');
    }
  }

  // Add event listeners to all accordion buttons
  items.forEach((item) => item.addEventListener('click', toggleAccordion));
  
  console.log(`FAQ accordion initialized with ${items.length} items`);
});