# 2017 Election Guide

Election guide for 2017 Twin Cities elections

## Data

Boundary data from the following sources and stored in the `data/` folder for easy access and processing.

* Minneapolis City Council wards from [http://opendata.minneapolismn.gov/](http://opendata.minneapolismn.gov/datasets/city-council-wards).
* Minneapolis Bark Board districts were emailed and manually edited to include
* St. Paul city combined from [information.stpaul.gov](https://information.stpaul.gov/City-Administration/Council-Ward-Shapefile-Map/tseu-m286).
* St. Paul school board ?

Candidate information is managed in this [spreadsheet](https://docs.google.com/spreadsheets/d/1moYou5n4gAuVdrBLv3l2MFtW2n4Mqy9vRAGzjcdB4Dw/).

### Processing

For use int he browser and to optimize performance, the data files need to be converted:

* Minneapolis city council districts: `ogr2ogr -f "GeoJSON" data/minneapolis-council.geo.json data/sources/Minneapolis-City_Council_Wards/City_Council_Wards.shp -t_srs "EPSG:4326" -sql "SELECT BDNUM AS id FROM City_Council_Wards"`
* Minneapolis city boundarys: `ogr2ogr -f "GeoJSON" data/minneapolis-city.geo.json data/sources/Minneapolis-City_Council_Wards/City_Council_Wards.shp -t_srs "EPSG:4326" -dialect sqlite -sql "SELECT ST_Union(Geometry) FROM City_Council_Wards"`
* Minneapolis park board districts: `ogr2ogr -f "GeoJSON" data/minneapolis-park.geo.json "data/sources/Minneapolis-park-board-districts/2017 Commissioner Districts-edited.shp" -t_srs "EPSG:4326" -sql "SELECT OBJECTID AS id FROM '2017 Commissioner Districts-edited'"`
* St. Paul city boundary: `ogr2ogr -f "GeoJSON" data/st-paul-city.geo.json "data/sources/St-Paul-Council Ward - Shapefile - Map/st-paul-city-council.shp" -t_srs "EPSG:4326" -dialect sqlite -sql "SELECT ST_Union(Geometry) FROM 'st-paul-city-council'"`
    * Note: Had issue with `ogr2ogr` so this was manually done in QGIS.

Easy command line option to get new data from the spread sheet.

    wget "https://docs.google.com/spreadsheets/d/e/2PACX-1vQW3uF1XBcCsp02d61siYLGUA_As8IRKu4daH9Aqt6WQ7fc83uzcObUb2v0fm0nYSWMU1Zfab8aqLgL/pub?output=csv" -O data/candidates.csv

## Embed

This project is best used as a full, standalone page, or an embed.  The best way to embed the piece is with the following code:

```html
<div data-pym-src="http://static.startribune.com/projects/2017-election-guide">Loading...</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pym/1.1.2/pym.v1.min.js" type="text/javascript"></script>
```

## Development

### Local

This project is a static HTML page, so serve it locally with your preferred web server.  For instance:

* With Python: `python -m SimpleHTTPServer`
* With Node: `npm install -g http-server && http-server`
* Or try [Served](http://enjalot.github.io/served/)

## Publish and deploy

This project should be published to: `s3://static.startribune.com/projects/2017-election-guide`

## License

Code is licensed under the MIT license included here.  Content (such as images, video, audio, copy, fonts) can only be reused with express permission by Star Tribune.
