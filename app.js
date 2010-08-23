require.paths.unshift(__dirname + "/lib");
require.paths.unshift(__dirname + "/lib/jsdom/lib");
require.paths.unshift(__dirname + "/lib/htmlparser/lib");

var http = require('http'),
    Url = require('url'),
    htmlparser = require('node-htmlparser'),
    dom = require('jsdom/level1/core').dom.level1.core,
    index = require('jsdom/browser/index'),
    sizzleInit = require('sizzle').sizzleInit,
    Step = require('step'),
    Class = require('class'),
    Hash = require('hash'),
    nStore = require('nstore');

const HOST = "scriptures.lds.org";
var server = http.createClient(80, HOST);

var reqCache = nStore.new("cache.db", onLoad);

// Loads content from the web.  Local cache is kept in an nStore database.
function load(pathname, callback) {
  if (reqCache.index.hasOwnProperty(pathname)) {
    reqCache.get(pathname, callback);
    return;
  }
  var request = server.request('GET', pathname, { Host: HOST });
  request.end();
  request.on('response', function (response) {
    response.setEncoding('utf8');
    var body = "";
    response.on('data', function (chunk) {
      body += chunk
    });
    response.on('end', function () {
      reqCache.save(pathname, body, function (err) {
        callback(null, body);
      });
    });
    response.on('error', callback);
  });
  request.on('error', callback);
}


// Simple wrapper around node's http client, htmlparser, jsdom, and sizzle
function fetch(pathname, callback) {
  load(pathname, function (err, html) {
    if (err) return callback(err);
    var browser = index.windowAugmentation(dom, {parser: htmlparser});
    browser.document.body.innerHTML = html;
    var Sizzle = sizzleInit(browser, browser.document);
    callback(null, Sizzle, browser.document);
  });
}

// Grabs the main sections from the index page
function scrape(url, callback) {
  fetch(url, function (err, Sizzle) {
    if (err) return callback(err);
    var base = Url.parse(Sizzle("base")[0].href || url).pathname;
    var result = Hash.new();
    var scope = Sizzle(".contents")[0];
    Sizzle("a", scope).forEach(function (a) {
      var href = a.href;
      var name = a.textContent.trim();
      var match = href.match(/(.*)\/contents/);
      var code;
      if (match) {
        code = match[1];
      } else {
        code = href;
      }
      result[code] = {name: name, href: Url.resolve(base, href)}
    });
    callback(null, result);
  });
}


function onLoad() {
  scrape("/", function (err, volumes) {
    if (err) throw err;
    console.dir(volumes);
    scrape(volumes.bm.href, function (err, books) {
      if (err) throw err;
      console.dir(books);
    });
  });
}
