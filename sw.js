var CACHE_NAME = "1x1-trainer-v75";
var ASSETS = ["./", "./index.html", "./styles.css", "./app.js", "./blank-paper.js", "./curriculum.js", "./arcade-extra.js", "./frog-punch.js", "./frog.html", "./chicken-shooter.js", "./chicken.html", "./doodle.html", "./tiles.html", "./maze.html", "./asteroid.html", "./golf.html", "./grab.html", "./pinball.html", "./merge.html", "./harbor.html", "./icons.svg", "./flappy.html", "./tower.html", "./gravity.html", "./brick.html", "./snake.html", "./snow.html", "./runner.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

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

// Resolve relative to this installation, including GitHub Pages project paths.
var assetUrls = new Set(ASSETS.map(function(path){
  return new URL(path, self.registration.scope).href;
}));

self.addEventListener("fetch", function(event){
  var request = event.request;
  if (request.method !== "GET" || request.headers.has("range")) return;
  var url = new URL(request.url);
  url.search = "";
  url.hash = "";
  if (!assetUrls.has(url.href)) return;

  function fallback(response){
    return caches.open(CACHE_NAME).then(function(cache){
      return cache.match(url.href);
    }).catch(function(){ return undefined; }).then(function(hit){
      return hit || response;
    });
  }

  event.respondWith(fetch(request).then(function(response){
    if (response.status >= 500) return fallback(response);
    if (response.status === 200 && !response.redirected && request.url === url.href){
      var copy = response.clone();
      event.waitUntil(caches.open(CACHE_NAME).then(function(cache){
        return cache.put(url.href, copy);
      }).catch(function(){ /* A full cache still permits online use. */ }));
    }
    return response;
  }, function(){ return fallback(Response.error()); }));
});
