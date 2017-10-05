/**
 * Main JS file.
 */

// Implicit dependencies
/* global Ractive, _, Papa, L, Wherewolf */

// Wrap logic, so we don't clobber anything else
(function() {
  // Setup mapbox access
  L.mapbox.accessToken =
    'pk.eyJ1Ijoic2hhZG93ZmxhcmUiLCJhIjoiS3pwY1JTMCJ9.pTSXx_LFgR3XBpCNNxWPKA';
  var geocoder = L.mapbox.geocoder('mapbox.places');

  // Create main ractive app
  var r = Ractive({
    target: 'app-container',
    template: document.getElementById('template-app').innerHTML,
    data: {
      neededDatasets: 4,
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
    }
  });

  // React to new coordinates
  r.observe('latitude', function(n) {
    if (n && this._app.where) {
      var results = this._app.where.find({
        lat: n,
        lng: this.get('longitude')
      });

      console.log(results);

      // No results
      if (!results || !_.filter(results).length) {
        return this.set({
          searchError:
            'Unable to find any contests for this address, make sure it is in the Twin Cities.'
        });
      }

      // Filter candidates
      var candidates = _.filter(this._app.data.candidates, function(c) {
        if (results.stPaulCity && c.City === 'St. Paul') {
          return true;
        }
        if (
          (results.mplsPark || results.mplsCouncil) &&
          c.City === 'Minneapolis' &&
          c.WardDistrict === 'All'
        ) {
          return true;
        }
        if (
          results.mplsPark &&
          c.City === 'Minneapolis' &&
          c.Race === 'Park Board' &&
          c.WardDistrict.toString() === results.mplsPark.id.toString()
        ) {
          return true;
        }
        if (
          results.mplsCouncil &&
          c.City === 'Minneapolis' &&
          c.Race === 'City Council' &&
          c.WardDistrict.toString() === results.mplsCouncil.id.toString()
        ) {
          return true;
        }
      });

      // Group by contests
      this.set(
        'contests',
        _.map(
          _.groupBy(candidates, function(c) {
            return [c.City, c.Race, c.WardDistrict].join('-');
          }),
          function(g) {
            return {
              City: g[0].City,
              Race: g[0].Race,
              WardDistrict: g[0].WardDistrict,
              WardDistrictDisplay: g[0].WardDistrictDisplay,
              candidates: g
            };
          }
        )
      );
    }
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
