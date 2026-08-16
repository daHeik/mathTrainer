var CACHE_NAME = "1x1-trainer-v22";
var ASSETS = ["./", "./index.html", "./styles.css", "./app.js", "./flappy.html", "./tower.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", function(e){
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(c){ return c.addAll(ASSETS); })
      .then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){
        return k.indexOf("1x1-trainer-") === 0 && k !== CACHE_NAME;
      })
        .map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

// Network first so updates arrive when the server is reachable; the cache
// keeps the app working offline or when the Pi is down.
self.addEventListener("fetch", function(e){
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request).then(function(res){
      var copy = res.clone();
      caches.open(CACHE_NAME).then(function(c){ c.put(e.request, copy); });
      return res;
    }).catch(function(){
      return caches.match(e.request, { ignoreSearch: true }).then(function(hit){
        return hit || caches.match("./index.html");
      });
    })
  );
});
