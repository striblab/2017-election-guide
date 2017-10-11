/**
 * Main JS file.
 */

// Implicit dependencies
/* global Ractive, _, Papa, L, Wherewolf, pym */

// Wrap logic, so we don't clobber anything else
(function() {
  // Setup Pym if available
  let localPym;
  if (pym) {
    localPym = new pym.Child({ polling: 500 });
  }

  // Setup mapbox access
  L.mapbox.accessToken =
    'pk.eyJ1Ijoic2hhZG93ZmxhcmUiLCJhIjoiS3pwY1JTMCJ9.pTSXx_LFgR3XBpCNNxWPKA';
  var geocoder = L.mapbox.geocoder('mapbox.places');

  // Default styling for map boundaries
  var defaultBoundaryStyles = {
    stroke: true,
    color: '#48bdcc',
    weight: 2,
    opacity: 0.9,
    fill: true,
    fillColor: '#48bdcc',
    fillOpacity: 0.15,
    interactive: false
  };
  var defaultLocationStyles = {
    stroke: true,
    color: '#cc8e48',
    weight: 1,
    opacity: 0.1,
    fill: true,
    fillColor: '#cc8e48',
    fillOpacity: 1,
    interactive: false,
    radius: 5
  };

  // Create main ractive app
  var r = Ractive({
    target: 'app-container',
    template: document.getElementById('template-app').innerHTML,
    components: components(),
    data: {
      canGeolocate: window.navigator && 'geolocation' in window.navigator,
      neededDatasets: 5,
      searchError: undefined,
      contests: []
    }
  });

  // Place to put some common data sets
  r._app = {};
  r._app.data = r._app.data || {};

  // Listen for datastets
  r.observe('datasets', function(n) {
    if (n && n.length === this.get('neededDatasets')) {
      this._app.where = Wherewolf();
      this._app.where.add('mplsCouncil', this._app.data.mplsCouncil);
      this._app.where.add('mplsPark', this._app.data.mplsPark);
      this._app.where.add('stPaulCity', this._app.data.stPaulCity);

      // Add boundaries for selection map
      this.set('mapInput.boundaries', [
        this._app.data.mplsCouncil,
        this._app.data.stPaulCity
      ]);
    }
  });

  // React to new coordinates
  r.observe('latitude', function(n) {
    if (n && this._app.where) {
      var results = this._app.where.find(
        {
          lat: n,
          lng: this.get('longitude')
        },
        { wholeFeature: true }
      );

      // Pull id out
      results = _.mapObject(results, function(r) {
        if (r) {
          r.id = r.properties.id;
        }

        return r;
      });

      // No results
      if (!results || !_.filter(results).length) {
        return this.set({
          searchError:
            'Unable to find any contests for this address, make sure it is in Minneapolis or St. Paul.',
          isSearching: false,
          contests: []
        });
      }

      // Filter candidates
      var candidates = _.filter(this._app.data.candidates, function(c) {
        if (results.stPaulCity && c.City === 'St. Paul') {
          c.boundary = results.stPaulCity;
          return true;
        }
        if (
          (results.mplsPark || results.mplsCouncil) &&
          c.City === 'Minneapolis' &&
          c.WardDistrict === 'All'
        ) {
          c.boundary = r._app.data.mplsCity;
          return true;
        }
        if (
          results.mplsPark &&
          c.City === 'Minneapolis' &&
          c.Race === 'Park Board' &&
          c.WardDistrict.toString() === results.mplsPark.id.toString()
        ) {
          c.boundary = results.mplsPark;
          return true;
        }
        if (
          results.mplsCouncil &&
          c.City === 'Minneapolis' &&
          c.Race === 'City Council' &&
          c.WardDistrict.toString() === results.mplsCouncil.id.toString()
        ) {
          c.boundary = results.mplsCouncil;
          return true;
        }
      });

      // Group by contests
      this.set('searchError', false);
      this.set(
        'contests',
        _.map(
          _.groupBy(candidates, function(c) {
            return [c.City, c.Race, c.WardDistrict].join('-');
          }),
          function(g) {
            return {
              boundary: g[0].boundary,
              City: g[0].City,
              Race: g[0].Race,
              WardDistrict: g[0].WardDistrict,
              WardDistrictDisplay: g[0].WardDistrictDisplay,
              ElectNum: g[0].ElectNum,
              candidates: g
            };
          }
        )
      );
    }
  });

  // When someone picks a point on the map, this gets marked true
  r.observe('updatingLocation', function(n) {
    if (n && n === true) {
      this.set({
        addressSearch: '',
        updatingLocation: false
      });
    }
  });

  // Basic geolocation function
  r.on('geolocate', function(context) {
    if (context && _.isObject(context.event)) {
      context.event.preventDefault();
    }
    var thisComponent = this;
    this.set({
      isSearching: true,
      contests: []
    });

    window.navigator.geolocation.getCurrentPosition(function(position) {
      thisComponent.set({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        updatingLocation: true,
        isSearching: false
      });
    }, function() {
      thisComponent.set({
        searchError: 'There was an issue finding your location, trying using the address search.',
        isSearching: false
      });
    });
  });

  // Address search
  r.on('searchAddress', function(context) {
    if (context && _.isObject(context.event)) {
      context.event.preventDefault();
    }

    if (!this.get('addressSearch')) {
      return;
    }

    this.set({
      contests: [],
      searchError: false,
      isSearching: true,
      longitude: undefined,
      latitude: undefined
    });

    geocode(
      this.get('addressSearch'),
      _.bind(function(error, coordinates, place) {
        if (error) {
          this.set({
            searchError: error,
            isSearching: false
          });
          return;
        }

        this.set({
          searchError: false,
          isSearching: false,
          addressSearch: place ? place : this.get('addressSearch'),
          longitude: coordinates[0],
          latitude: coordinates[1]
        });
      }, this)
    );
  });

  // Get data sets
  getJSON('data/minneapolis-city.geo.json', function(error, data) {
    if (error) {
      r.set('appError', 'There was an error getting some of the data needed.');
    }
    r._app.data.mplsCity = data;
    r.push('datasets', 'mplsCity');
  });
  getJSON('data/minneapolis-park.geo.json', function(error, data) {
    if (error) {
      r.set('appError', 'There was an error getting some of the data needed.');
    }
    r._app.data.mplsPark = data;
    r.push('datasets', 'mplsPark');
  });
  getJSON('data/minneapolis-council.geo.json', function(error, data) {
    if (error) {
      r.set('appError', 'There was an error getting some of the data needed.');
    }
    r._app.data.mplsCouncil = data;
    r.push('datasets', 'mplsCouncil');
  });
  getJSON('data/st-paul-city.geo.json', function(error, data) {
    if (error) {
      r.set('appError', 'There was an error getting some of the data needed.');
    }
    r._app.data.stPaulCity = data;
    r.push('datasets', 'stPaulCity');
  });
  getCSV('data/candidates.csv', function(error, data) {
    if (error) {
      r.set('appError', 'There was an error getting some of the data needed.');
    }
    r._app.data.candidates = data;
    r.push('datasets', 'candidates');
  });

  // Make ractive components
  function components() {
    var Map = Ractive.extend({
      template: document.getElementById('template-map').innerHTML,
      oninit: function() {
        this._app = this._app || {};

        // Render
        this.on('render', function() {
          // Make map
          this._app.map = L.mapbox.map(this.find('.map'), 'mapbox.light', {
            attributionControl: false,
            zoomControl: this.get('zoomControl'),
            scrollWheelZoom: this.get('scrollWheelZoom')
          });

          // Load boundary initally
          this.addBoundary(this.get('boundary'));

          // Location
          this.addLocation();

          // Enable input
          if (this.get('input')) {
            this.addInput();
          }
        });

        // Handle changes to boundary
        this.observe('boundary', this.addBoundary, { defer: true });

        // Handle changes to location
        this.observe('latitude', this.addLocation, { defer: true });

        return {
          zoomControl: false,
          scrollWheelZoom: false
        };
      },

      addInput: function() {
        var thisComponent = this;
        if (this._app.map) {
          this._app.map.on('click', function(e) {
            if (e && e.latlng) {
              thisComponent.set({
                updatingLocation: true,
                latitude: e.latlng.lat,
                longitude: e.latlng.lng
              });
            }
          });
        }
      },

      addLocation: function() {
        var location = {
          latitude: this.get('latitude'),
          longitude: this.get('longitude')
        };

        if (
          location &&
          location.latitude &&
          location.longitude &&
          this._app.map
        ) {
          if (this._app.locationLayer) {
            this._app.map.removeLayer(this._app.locationLayer);
            this._app.locationLayer = null;
          }

          this._app.locationLayer = L.circleMarker(
            [location.latitude, location.longitude],
            defaultLocationStyles
          ).addTo(this._app.map);

          if (this.get('input')) {
            this._app.map.setView([location.latitude, location.longitude], 15);
          }
        }
      },

      addBoundary: function(boundary) {
        let thisComponent = this;

        if (boundary && this._app.map) {
          if (this._app.boundaryLayer) {
            this._app.map.removeLayer(this._app.boundaryLayer);
            this._app.boundaryLayer = null;
          }

          this._app.boundaryLayer = L.featureGroup();
          _.each(_.isArray(boundary) ? boundary : [boundary], function(b) {
            L.geoJson(b, {
              style: function() {
                return defaultBoundaryStyles;
              }
            }).addTo(thisComponent._app.boundaryLayer);
          });

          this._app.boundaryLayer.addTo(this._app.map);
          this._app.map.fitBounds(this._app.boundaryLayer.getBounds(), {
            padding: [10, 10]
          });
        }
      }
    });

    return { Map: Map };
  }

  // Geocode address
  function geocode(address, done) {
    if (!_.isFunction(done)) {
      return console.error('callback is not a function.');
    }

    // Do geocode
    geocoder.query(
      {
        query: address,
        country: 'US'
      },
      function(error, response) {
        if (
          error ||
          (response && response.results && !response.results.features.length)
        ) {
          console.error(error ? error : response);
          return done(
            'Unable to locate the address provided, try being more specific.'
          );
        }

        done(
          null,
          response.results.features[0].center,
          response.results.features[0].place_name
        );
      }
    );
  }

  // Get CSV
  function getCSV(url, done) {
    if (!_.isFunction(done)) {
      return console.error('callback is not a function.');
    }

    getResource(url, function(error, response) {
      if (error) {
        return done(error);
      }

      try {
        var data = Papa.parse(response, { header: true });
        if (data && data.errors && data.errors.length) {
          return done(data.errors);
        }

        done(null, data.data);
      }
      catch (e) {
        console.error(e);
        done(e);
      }
    });
  }

  // Get JSON
  // http://youmightnotneedjquery.com/#json
  function getJSON(url, done) {
    if (!_.isFunction(done)) {
      return console.error('callback is not a function.');
    }

    getResource(url, function(error, response) {
      if (error) {
        return done(error);
      }

      try {
        var data = JSON.parse(response);
        done(null, data);
      }
      catch (e) {
        console.error(e);
        done(e);
      }
    });
  }

  // Get file
  function getResource(url, done) {
    if (!_.isFunction(done)) {
      return console.error('callback is not a function.');
    }

    var request = new XMLHttpRequest();
    request.open('GET', url, true);
    request.onload = function() {
      if (request.status >= 200 && request.status < 400) {
        done(null, request.responseText);
      }
      else {
        console.error(request);
        done(request);
      }
    };

    request.onerror = function() {
      done(arguments);
    };

    request.send();
  }
})();
