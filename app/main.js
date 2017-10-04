/**
 * Main JS file.
 */

// Implicit dependencies
/* global Ractive */

// Wrap logic, so we don't clobber anything else
(function() {

  // Create main ractive app
  var r = Ractive({
    target: 'app-container',
    template: document.getElementById('template-app').innerHTML,
    data: {

    }
  });

  console.log(document.getElementById('template-app').innerHTML);
})();
