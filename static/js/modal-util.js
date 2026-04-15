// Project Name: PosturePro
// File Name: modal-util.js
// Date: 24 May 2025
// Description: Modal utility for displaying alerts and confirmations in the PosturePro application. This replaces the default browser alerts with styled modals.
// Group: Sensor-4

// Modal utility for displaying alerts and confirmations
// This replaces the default browser alerts with styled modals

// Helper function to create a modal instance
function createModalAlert(title, message, confirmLabel = "OK", showCancel = false, onConfirm = null) {
  // Create unique ID for this modal
  const modalId = `modal-${Date.now()}`;
  
  // Define primary colors specifically for the modal
  // These color definitions are isolated to this modal instance
  const primaryColors = {
    50: "#eff6ff",
    100: "#dbeafe",
    200: "#bfdbfe",
    300: "#93c5fd",
    400: "#60a5fa",
    500: "#3b82f6",
    600: "#2563eb",
    700: "#1d4ed8",
    800: "#1e40af",
    900: "#1e3a8a",
    950: "#172554"
  };
  
  // Create the modal HTML with inline styles
  const modalHTML = `
  <div id="${modalId}" tabindex="-1" class="hidden overflow-y-auto overflow-x-hidden fixed top-0 right-0 left-0 z-50 w-full md:inset-0 h-modal md:h-full" style="font-family: 'Inter', sans-serif;">
    <div class="relative p-4 w-full max-w-lg h-full md:h-auto">
      <div class="relative p-4 bg-white rounded-lg shadow md:p-8">
        <div class="mb-4 text-sm font-light text-gray-500">
          <h3 class="mb-3 text-2xl font-bold text-gray-900">${title}</h3>
          <p>${message}</p>
        </div>
        <div class="justify-between items-center pt-0 space-y-4 sm:flex sm:space-y-0">
          <div></div>
          <div class="items-center space-y-4 sm:space-x-4 sm:flex sm:space-y-0">
            ${showCancel ? `<button id="${modalId}-close" type="button" class="py-2 px-4 w-full text-sm font-medium text-gray-500 bg-white rounded-lg border border-gray-200 sm:w-auto hover:bg-gray-100 focus:ring-4 focus:outline-none focus:ring-blue-300 hover:text-gray-900 focus:z-10">Cancel</button>` : ''}
            <button id="${modalId}-confirm" type="button" class="py-2 px-4 w-full text-sm font-medium text-center text-white rounded-lg sm:w-auto focus:ring-4 focus:outline-none focus:ring-blue-300">${confirmLabel}</button>
          </div>
        </div>
      </div>
    </div>
  </div>`;
  
  // Add the modal to the body
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // Get the modal element
  const modalEl = document.getElementById(modalId);
  
  // Create and initialize the modal
  if (typeof Modal !== 'undefined') {
    const modal = new Modal(modalEl, {
      placement: 'center'
    });
    
    // Add custom styling to modal
    const confirmButton = document.getElementById(`${modalId}-confirm`);
    if (confirmButton) {
      // Apply custom styles for primary button
      confirmButton.style.backgroundColor = '#1d4ed8'; // primary-700
      confirmButton.addEventListener('mouseenter', function() {
        this.style.backgroundColor = '#1e40af'; // primary-800
      });
      confirmButton.addEventListener('mouseleave', function() {
        this.style.backgroundColor = '#1d4ed8'; // primary-700
      });
    }
    
    // Show the modal
    modal.show();
    
    // Handle confirm button
    if (confirmButton) {
      confirmButton.addEventListener('click', function() {
        if (typeof onConfirm === 'function') {
          onConfirm();
        }
        modal.hide();
        // Remove the modal from the DOM after hiding
        setTimeout(() => {
          modalEl.remove();
        }, 300);
      });
    }
    
    // Handle close button if it exists
    if (showCancel) {
      const closeButton = document.getElementById(`${modalId}-close`);
      if (closeButton) {
        closeButton.addEventListener('click', function() {
          modal.hide();
          // Remove the modal from the DOM after hiding
          setTimeout(() => {
            modalEl.remove();
          }, 300);
        });
      }
    }
    
    return modal;
  } else {
    console.error('Modal library not loaded. Make sure Flowbite is properly initialized.');
    alert(`${title}\n${message}`); // Fallback to default alert
    modalEl.remove();
    return null;
  }
}

// Replace the default alert function
window.customAlert = function(message, title = "Information") {
  return createModalAlert(title, message);
};

// Add a confirmation dialog function
window.customConfirm = function(message, onConfirm, title = "Confirm", confirmLabel = "Confirm") {
  return createModalAlert(title, message, confirmLabel, true, onConfirm);
};

// Add a success alert
window.successAlert = function(message, title = "Success", onConfirmCallback) {
  return createModalAlert(title, message, "OK", false, onConfirmCallback);
};

// Add an error alert
window.errorAlert = function(message, title = "Error") {
  return createModalAlert(title, message, "OK");
};