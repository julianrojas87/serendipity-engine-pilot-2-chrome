import * as jsonld from 'jsonld';
import { Store } from 'n3';
import * as turf from '@turf/turf';
import { QueryEngine } from '@comunica/query-sparql';

const CORS_PROXY = 'https://proxy.linkeddatafragments.org/';

/**
 * RDF-JS store containing the triples of NMBS stations.
 */
let stationStore = null;

document.onreadystatechange = async () => {
  if (document.readyState === 'complete') {
    console.log('EXTENSION TEST!');

    stationStore = await fetchStationsData();

    if (isSearchPage()) {
      onSearchPage();
    } else {
      onEventPage();
    }
  }
};

/**
 * This function adds the extra info to the page of the event.
 */
async function onEventPage() {
  const url = new URL(document.URL);
  const urlParts = url.pathname.split('/');
  const lastPart = urlParts[urlParts.length - 1];
  console.debug(lastPart);

  if (!isValidEventID(lastPart)) {
    return;
  }

  addExtraInfoToPage(lastPart);
}

/**
 * This function adds click listeners to the search results, so that the extra info is added to a search result when
 * it is expanded.
 */
function onSearchPage() {
  const links = document.querySelectorAll('a.app-event-teaser-link');

  links.forEach(node => {
    node.addEventListener('click', () => {
      console.log(node);

      const url = new URL(node.href);
      const urlParts = url.pathname.split('/');
      addExtraInfoToPage(urlParts[urlParts.length - 1]);
    });
  });

  const paginationItems = document.querySelectorAll('.v-pagination__list > li');

  paginationItems.forEach(node => {
    node.addEventListener('click', () => {
      console.log(node);
      onSearchPage();
    });
  });
}

/**
 * This function adds extra info about an event to a page.
 * @param {string} eventID - The ID of the event.
 */
async function addExtraInfoToPage(eventID) {
  console.log(`Adding info for event with ID "${eventID}".`);
  console.log('Fetching data from Uit API.');
  const response = await getUitData(eventID);
  console.log('Received data from Uit API.');
  const result = await response.json();
  console.log(result);

  if (result && result.data && result.data.event) {
    if (result.data.event.attendanceMode === 'online') {
      console.log('The event takes place online, so we don\'t add anything.');
      return;
    }

    console.log('Fetching coordinates.');
    const response2 = await getCoordinates(result.data.event.location.id);
    console.log(response2);
    console.log('Received coordinates.');

    // await delay(2000);
    // addRowToInfoHeader('Bounding box: ' + getBoundingBox(response2).bbox);

    addStationRow(getBoundingBox(response2, 5));
    addMuseumRow(getBoundingBox(response2, 10));
  }
}

/**
 * This function adds a row to the info table with information about the closest train stations.
 * @param {object} options - The bounding box where to look for stations.
 */
async function addStationRow(options) {
  try {
    console.log('Fetching stations.');
    const bindingsStream = await getClosestTrainStations(options.bbox);

    let alreadyOneStation = false;
    const stations = [];

    bindingsStream.on('data', (binding) => {
      const distance = turf.distance(
        turf.point([options.long, options.lat]),
        turf.point([parseFloat(binding.get('long').value), parseFloat(binding.get('lat').value)]),
        'kilometers'
      );

      stations.push({
        station: binding.get('station').value,
        name: binding.get('name').value,
        distance
      });
    });

    bindingsStream.on('end', () => {
      console.log('Received stations.');

      stations.sort((a, b) => {
        return parseFloat(a.distance) - parseFloat(b.distance);
      });

      for (const station of stations) {
        if (!alreadyOneStation) {
          const infoDiv = document.querySelector('.app-event-details__content__header__info');
          //console.log(infoDiv);
          const newDiv = document.createElement('div');
          newDiv.classList.add('app-event-details__content__header__info__ages');
          newDiv.classList.add('app-event-details__list-item-with-icon');
          newDiv.innerHTML = '<div class="icons app-icon app-icon-redesign-age">🚂</div><div data-v-f777bbd1 id="stations"></div>';
          infoDiv?.appendChild(newDiv);
        }

        const stationsDiv = document.querySelector('#stations');

        if (stationsDiv) {
          if (alreadyOneStation) {
            stationsDiv.innerHTML += ', ';
          }

          stationsDiv.innerHTML += `<a href="${station.station}">${station.name} (${Math.round((station.distance + Number.EPSILON) * 100) / 100} km)</a>`;
          alreadyOneStation = true;
        }
      }
    });
  } catch (err) {
    console.error('An issue was encountered when executing a SPARQL for NMBS stations');
    console.error(err);
  }
}

/**
 * This function adds a row to the info table with information about the closest museums.
 * @param {object} options - The minimum and maximum of both the longitude and latitude.
 */
async function addMuseumRow(options) {
  try {
    console.log('Fetching museums.');
    // let museums = await queryWorldKG({
    //   type: 'Museum',
    //   ...options.bbox
    // });

    let museums = await querySophox({
      type: 'museum',
      ...options
    });

    if (museums) {
      museums.sort((a, b) => {
        return parseFloat(a.distance.value) - parseFloat(b.distance.value);
      });
      museums = museums.map(binding => {
        return `<a href="${binding.website ? binding.website.value : binding.osmid.value}" target="_blank">${binding.name.value} (${Math.round((parseFloat(binding.distance.value) + Number.EPSILON) * 100) / 100} km)</a>`;
      });

      const museumsHTML = `<div class="icons app-icon app-icon-redesign-age">🏛️</div><div data-v-f777bbd1>${museums.join(', ')}</div>`;
      addRowToInfoHeader({ html: museumsHTML });
    }
  } catch (err) {
    console.error('An issue was encountered when executing a SPARQL for museums');
    console.error(err);
  }
}

/**
 * This function adds a row to the info table.
 * You can either provide the HTML or the text and the icon.
 * @param {string} text - The text to be included in the new row.
 * @param {string} html - The HTML of the new row.
 * @param {string} icon - The icon to be included in the new row.
 */
function addRowToInfoHeader({ text, html, icon }) {
  const infoDiv = document.querySelector('.app-event-details__content__header__info');
  //console.log(infoDiv);
  const newDiv = document.createElement('div');
  newDiv.classList.add('app-event-details__content__header__info__ages');
  newDiv.classList.add('app-event-details__list-item-with-icon');

  if (text) {
    newDiv.innerText = `${icon} ${text}`;
  } else {
    newDiv.innerHTML = html;
  }

  //console.log(newDiv);
  infoDiv?.appendChild(newDiv);
  // const app = infoDiv?.appendChild(newDiv);
  // console.log(app);
}

/**
 * This function returns the Uit data from an event.
 * @param {string} eventID - The ID of the event for which the data is wanted.
 * @returns {Response} - The response of the fetch.
 */
async function getUitData(eventID) {
  return await fetch('https://api.uit.be/', {
    'credentials': 'omit',
    'headers': {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:122.0) Gecko/20100101 Firefox/122.0',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.5',
      'Content-Type': 'application/json',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'cross-site',
      'Pragma': 'no-cache',
      'Cache-Control': 'no-cache'
    },
    'referrer': 'https://www.uitinvlaanderen.be/',
    // eslint-disable-next-line
    'body': `{\"operationName\":\"GetEventDetail\",\"variables\":{\"id\":\"${eventID}\"},\"query\":\"query GetEventDetail($id: ID!) {\\n  event(id: $id) {\\n    id\\n    name\\n    onlineUrl\\n    status {\\n      type\\n      reason\\n      __typename\\n    }\\n    description\\n    production {\\n      id\\n      name\\n      __typename\\n    }\\n    isOnline\\n    location {\\n      id\\n      name\\n      address {\\n        country\\n        locality\\n        postalCode\\n        streetAddress\\n        __typename\\n      }\\n      __typename\\n    }\\n    images {\\n      url\\n      alt\\n      isMain\\n      copyrightHolder\\n      __typename\\n    }\\n    videos {\\n      thumbnailUrl\\n      name\\n      description\\n      uploadDate\\n      id\\n      url\\n      embedUrl\\n      copyrightHolder\\n      __typename\\n    }\\n    typicalAgeRange {\\n      minimum\\n      maximum\\n      allAges\\n      __typename\\n    }\\n    contactPoint {\\n      email\\n      phone\\n      url\\n      __typename\\n    }\\n    organizer {\\n      id\\n      name\\n      contactPoint {\\n        email\\n        phone\\n        url\\n        __typename\\n      }\\n      uitPasBenefits {\\n        id\\n        title\\n        points\\n        __typename\\n      }\\n      __typename\\n    }\\n    benefits\\n    target\\n    calendar {\\n      type\\n      summary {\\n        small\\n        large\\n        __typename\\n      }\\n      startDate\\n      endDate\\n      openingHours {\\n        opens\\n        closes\\n        dayOfWeek\\n        __typename\\n      }\\n      __typename\\n    }\\n    types {\\n      id\\n      name\\n      __typename\\n    }\\n    themes {\\n      id\\n      name\\n      __typename\\n    }\\n    facilities {\\n      id\\n      name\\n      __typename\\n    }\\n    municipality {\\n      key\\n      name\\n      __typename\\n    }\\n    languageIcons\\n    bookingInfo {\\n      availabilityStarts\\n      availabilityEnds\\n      phone\\n      email\\n      description\\n      url\\n      urlLabel\\n      __typename\\n    }\\n    prices {\\n      category\\n      name\\n      value\\n      __typename\\n    }\\n    isLiked\\n    curatorArticles {\\n      url\\n      title\\n      text\\n      publisher\\n      publisherLogo\\n      __typename\\n    }\\n    subEvent {\\n      startDate\\n      endDate\\n      status {\\n        type\\n        reason\\n        __typename\\n      }\\n      __typename\\n    }\\n    audienceType\\n    attendanceMode\\n    bookingAvailability\\n    __typename\\n  }\\n}\\n\"}`,
    'method': 'POST',
    'mode': 'cors'
  });
}

/**
 * This function returns the coordinates of an Uit location.
 * @param {string} locationID - The ID of the location.
 * @returns {object} - An object with both the longitude and latitude.
 */
async function getCoordinates(locationID) {
  const response2 = await fetch('https://io.uitdatabank.be/place/' + locationID);
  const result2 = await response2.json();
  return result2.geo;
}

/**
 * This function returns a bounding box for a given longitude and latitude.
 * @param {object} options - An object with a longitude and latitude.
 * @param {number} maxDistance - The maximum distance allowed for the produced bounding box.
 * @returns {object} - An object with the minimum and maximum longitude and latitude.
 */
function getBoundingBox(options, maxDistance) {
  const point = turf.point([options.longitude, options.latitude]);
  const buffered = turf.buffer(point, maxDistance, { units: 'kilometers' });
  const bbox = turf.bbox(buffered);
  const bboxPolygon = turf.bboxPolygon(bbox);
  const longMin = bboxPolygon.bbox[0];
  const longMax = bboxPolygon.bbox[2];
  const latMin = bboxPolygon.bbox[1];
  const latMax = bboxPolygon.bbox[3];
  return {
    long: options.longitude,
    lat: options.latitude,
    maxDistance,
    bbox: { longMin, longMax, latMin, latMax }
  };
}

/**
 * This function queries the iRail endpoint for the closest train stations in a given bounding box and
 * returns the results.
 * @param {object} boundingBox - The bounding box where to search for the stations.
 * @returns {object} - A binding stream.
 */
async function getClosestTrainStations(boundingBox) {
  const trainStationQuery = trainStationQueryTemplate(boundingBox);

  // We execute the query to get the nearest train stations.
  const myEngine = new QueryEngine();
  const bindingsStream = await myEngine.queryBindings(trainStationQuery, {
    sources: [stationStore],
  });

  return bindingsStream;
}

const trainStationQueryTemplate = ({ longMin, longMax, latMin, latMax }) => {
  return `
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
PREFIX schema: <http://schema.org/>
PREFIX wgs: <http://www.w3.org/2003/01/geo/wgs84_pos#>
PREFIX gtfs: <http://vocab.gtfs.org/terms#>
SELECT *
WHERE {
  ?station a gtfs:Station;
           schema:name ?name;
           wgs:lat ?lat;
           wgs:long ?long.

  FILTER(xsd:double(?lat) >= ${latMin} && xsd:double(?lat) <= ${latMax})
  FILTER(xsd:double(?long) >= ${longMin} && xsd:double(?long) <= ${longMax})
}`;
};

/**
 * This function queries the WorldKG for a given bounding box and returns the results.
 * @param {object} options - An object with the type and the properties of a bounding box.
 * @returns {Array} - The bindings of the results.
 */
// eslint-disable-next-line no-unused-vars
async function queryWorldKG(options) {
  const worldkgQuery = worldKgQueryTemplate(options);
  //console.log(worldkgQuery);

  // myEngine = new Comunica.QueryEngine();
  // bindingsStream = await myEngine.queryBindings(worldkgQuery, {
  //   sources: ['https://www.worldkg.org/sparql'],
  // });
  // bindings = await bindingsStream.toArray();
  // console.log(bindings.map(binding => `${binding.get('name').value} at ${binding.get('p').value}`));

  // There is an issue with the SPARQL endpoint, so we can't use Comunica.
  // That's why we use a fetch with the query as a query parameter.
  // This could be resolved by creating our own Comunica engine,
  // but the SPARQL endpoint is probably not spec compliant.
  const worldKgUrl = 'https://www.worldkg.org/sparql?' + new URLSearchParams({
    query: worldkgQuery,
    format: 'application/sparql-results+json'
  });
  const proxyUrl = CORS_PROXY + encodeURIComponent(worldKgUrl);
  const response = await fetch(proxyUrl,);

  if (response.ok) {
    const result = await response.json();
    console.log('WorldKG results: ', result);
    return result.results.bindings;
  }
}

const worldKgQueryTemplate = ({ type, longMin, longMax, latMin, latMax }) => {
  return `
PREFIX wkgs: <http://www.worldkg.org/schema/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX geo: <http://www.opengis.net/ont/geosparql#>

SELECT  ?p ?name
WHERE {
 ?p a wkgs:${type}; rdfs:label ?name .
 ?p wkgs:spatialObject [geo:asWKT ?fWKT] .
 FILTER ( bif:st_Within ( ?fWKT ,"POLYGON((${longMin} ${latMin}, ${longMin} ${latMax}, ${longMax} ${latMin}, ${longMax} ${latMax}))"^^geo:wktLiteral ) )
}`;
};

/**
 * This function queries the Sophox KG based on a given maximum distance and returns the results.
 * @param {object} options - An object with the type, location and maximum distance.
 * @returns {Array} - The bindings of the results.
 */
async function querySophox(options) {
  //const SOPHOX_URL = 'https://sophox.org/sparql?';
  const SOPHOX_URL = 'https://era.ilabt.imec.be/virtuoso/sparql?';
  const sophoxQuery = new URLSearchParams({ query: sophoxQueryTemplate(options) });
  const proxyUrl = SOPHOX_URL + sophoxQuery.toString();

  const response = await fetch(proxyUrl, {
    'headers': {
      'Accept': 'application/sparql-results+json',
    }
  });

  if (response.ok) {
    const result = await response.json();
    return result.results.bindings;
  }
}

const sophoxQueryTemplate = ({ type, long, lat, maxDistance }) => {
  // Query using Virtuoso geospatial functions
  return `
PREFIX osmt: <https://wiki.openstreetmap.org/wiki/Key:>
PREFIX osmm: <https://www.openstreetmap.org/meta/>
PREFIX bif: <http://www.openlinksw.com/schemas/bif#>

SELECT ?osmid ?name ?website ?distance 
FROM <https://openstreetmap.org/graph>
WHERE {
  ?osmid osmt:tourism "${type}" ;
         osmt:name ?name ;
         osmm:loc ?geom .
  
  OPTIONAL {
     ?osmid osmt:website ?website .
  }
  
  BIND(bif:st_distance(bif:st_geomfromtext(bif:st_astext(?geom)), bif:st_geomfromtext("POINT(${long} ${lat})")) AS ?distance)
  FILTER(?distance < ${maxDistance})
}
ORDER BY ASC(?distance)
LIMIT 5
  `;
  // Query for standard GeoSPARQL
  /*return `
PREFIX osmt: <https://wiki.openstreetmap.org/wiki/Key:>
PREFIX osmm: <https://www.openstreetmap.org/meta/>
PREFIX geof: <http://www.opengis.net/def/geosparql/function/>

SELECT ?osmid ?name ?website ?distance WHERE {
  ?osmid osmt:tourism "${type}" ;
         osmt:name ?name ;
         osmm:loc ?geom .
  
  OPTIONAL {
     ?osmid osmt:website ?website .
  }
  
  BIND(geof:distance(?geom, "POINT(${long} ${lat})"^^geo:wktLiteral) AS ?distance)
  FILTER(?distance < ${maxDistance})
}
ORDER BY ASC(?distance)
LIMIT 5
`;*/
};

/**
 * This function returns true if we think that the given string is a valid event ID.
 * @param {string} str - The string to check.
 * @returns {boolean} - True if we think the string is an event ID.
 */
function isValidEventID(str) {
  return str.split('-').length > 2 && !str.includes('=');
}

/**
 * This function returns true if the user is on the search page.
 * @returns {boolean} - True if the user is on the search page.
 */
function isSearchPage() {
  return document.querySelector('.app-results-search-facet-group') !== null;
}
/**
 * This function returns a RDF-JS Store object containing the NMBS station quads.
 * @returns {Store} - RDF-JS Store instance.
 */
async function fetchStationsData() {
  const response = await fetch('https://graph.irail.be/sncb/stops');
  const rdf = await jsonld.toRDF(await response.json());
  const store = new Store(rdf);
  return store;
}
