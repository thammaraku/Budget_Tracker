const FILES_TO_CACHE = [
  "/",
  "/index.html",
  "/style.css",
  "/index.js",
  "/db.js",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/manifest.webmanifest",
];

// cache has control version
const CACHE_NAME = "static-cache-v1";
const DATA_CACHE_NAME = "data-cache-v1";


// install initial resource and cache
self.addEventListener("install", function(event) {

  console.log("install");

  const cacheResources = async () => {
    const resourceCache = await caches.open(CACHE_NAME);
    return resourceCache.addAll(FILES_TO_CACHE);
  }

  // Thammarak this is to override the existing previous service worker otherwise you will be see one is in waiting state
  // Any previous service worker running on this site. Override now!
  self.skipWaiting(); 

  // Thammarak this is to wait until finishing caching all the files above
  // Hey browser! Do not stop me. I am adding resources (such as pages and images) to the cache API.
  event.waitUntil(cacheResources()); 

  console.log("Your files were pre-cached successfully!");
});

// activate is after installed we need to immediately call activate to clean up old data
// in case we have version of cache it will delete old version and use new cache version
self.addEventListener("activate", function(event) {

  console.log("activate");

  const removeOldCache = async () => {
    const cacheKeyArray = await caches.keys();
  
    const cacheResultPromiseArray = cacheKeyArray.map(key => {
      // check if the key of cache match
      if (key !== CACHE_NAME && key !== DATA_CACHE_NAME) {
        console.log("Removing old cache data", key);
        return caches.delete(key);
      }
    });
  
    return Promise.all(cacheResultPromiseArray);
  }

  // Hey browser! Do not stop me. I am now deleting old caches from the cache API.
  event.waitUntil(removeOldCache());  

  self.clients.claim();
});

// fetch to grasp all the requests from web request url to check if already have in cache before send out to node server 
// this is the reason that it has to be https since service worker checks on every request
self.addEventListener("fetch", function(event) {

  console.log("fetch", event.request.url);

  const handleAPIDataRequest = async (event) => {
    try {
      // this one looks from server first to get the latest data from the server not the old version in cache then store the latest data
      const response = await fetch(event.request);
      // If the response was good, clone it and store it in the cache.
      if (response.status === 200) {
        console.log(`Adding API request to cache now: ${event.request.url}`);

        const apiCache = await caches.open(DATA_CACHE_NAME);
        await apiCache.put(event.request.url, response.clone());

        return response;
      }
    } catch(error) {
      // Network request failed, try to get it from the cache.
      console.log(`Network error occurred with API request. Now retrieving it from the cache: ${event.request.url}`)
      return await caches.match(event.request);
    }
  }
  
  const handleResourceRequest = async (event) => {
    const matchedCache = await caches.match(event.request);
    return matchedCache ||  await fetch(event.request);
  }
  
  // cache successful requests to the API
  if (event.request.url.includes("/api/")) {
    event.respondWith(handleAPIDataRequest(event));
  } else {
    // if the request is not for the API, serve static assets using "offline-first" approach.
    event.respondWith(handleResourceRequest(event));
  }

});