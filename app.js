(function () {
  var C = window.ResellerCash;
  var SOLD_KEY = "reseller-sold";
  var SHELF_KEY = "reseller-shelf";
  var SHIP_KEY = "reseller-ship";
  var BOOKS_KEY = "reseller-books";

  var CATALOG = {
    cars: [
      {
        id: "cuda",
        name: "Gold '70 AAR Cuda Super",
        photo: "/photos/cuda.jpg",
        look: "Spectraflame gold Super. Case P.",
        shelf: "About $1",
        sale: "No settled sale",
        shelfNum: 1,
        rule: "buy",
      },
      {
        id: "firebird",
        name: "Blue '67 Firebird 400 Super",
        photo: "/photos/firebird.jpg",
        look: "Spectraflame blue Super. Case Q.",
        shelf: "About $1",
        sale: "No settled sale",
        shelfNum: 1,
        rule: "buy",
      },
      {
        id: "skyline",
        name: "Black Nissan Skyline HT 2000GT-X regular TH",
        photo: "/photos/skyline.jpg",
        look: "Black regular Treasure Hunt. Case P. Silver flame, not Super.",
        shelf: "About $1",
        sale: "No settled sale",
        shelfNum: 1,
        rule: "buy",
      },
      {
        id: "f40",
        name: "Ferrari F40 Competizione Super",
        photo: "/photos/f40.jpg",
        look: "Super Treasure Hunt.",
        shelf: "About $1",
        sale: "August 2026 tracked average $122",
        shelfNum: 1,
        soldNum: 122,
        rule: "buy",
      },
      {
        id: "civic",
        name: "Honda Civic Custom Super",
        photo: "/photos/civic.jpg",
        look: "Super Treasure Hunt.",
        shelf: "About $1",
        sale: "About $73 on one tracker",
        shelfNum: 1,
        soldNum: 73,
        rule: "buy",
      },
      {
        id: "lotus",
        name: "Lotus Sport Elise",
        photo: "/photos/lotus.jpg",
        look: "Orange Super. Elise, not Elite.",
        shelf: "About $1",
        sale: "Closer to $50",
        shelfNum: 1,
        soldNum: 50,
        rule: "buy",
      },
      {
        id: "mustang",
        name: "Ford Mustang GTD Super",
        photo: "/photos/mustang.jpg",
        look: "Super Treasure Hunt.",
        shelf: "About $1",
        sale: "About $53 in May 2026",
        shelfNum: 1,
        soldNum: 53,
        rule: "buy",
      },
      {
        id: "impala",
        name: "'64 Impala Super",
        photo: "/photos/impala.jpg",
        look: "Teal Super.",
        shelf: "About $1",
        sale: "About $51",
        shelfNum: 1,
        soldNum: 51,
        rule: "buy",
      },
      {
        id: "porsche",
        name: "Brown Porsche 911 Carrera RS 2.7 Super",
        photo: "/photos/porsche.jpg",
        look: "Brown Super.",
        shelf: "About $1",
        sale: "No settled sale",
        shelfNum: 1,
        rule: "buy",
      },
      {
        id: "matchbox",
        name: "Matchbox Super Chase",
        photo: "/photos/matchbox.jpg",
        look: "Buy only if the card says SUPER CHASE.",
        shelf: "About $1",
        sale: "No settled sale",
        shelfNum: 1,
        rule: "buy",
      },
      {
        id: "etb",
        name: "Pokémon 30th Celebration ETB",
        photo: "/photos/etb.jpg",
        look: "Sept 16. Buy only at printed $49.99.",
        shelf: "Printed $49.99",
        sale: "No settled sale",
        shelfNum: 49.99,
        rule: "buy",
      },
    ],
    sports: [
      {
        id: "topps-s1",
        name: "2026 Topps Series 1 Baseball value/blaster",
        photo: "/photos/topps-s1.jpg",
        look: "Sports blister. Leave it.",
        shelf: "Printed often $24.99",
        sale: "Fanatics Collect sold Sep 7 2026 about $13 to $17",
        shelfNum: 24.99,
        rule: "leave",
      },
      {
        id: "topps-fb",
        name: "2026 Topps Football blaster",
        photo: "/photos/topps-fb.jpg",
        look: "Sports blister. Leave it.",
        shelf: "No printed price stored",
        sale: "No settled sale",
        rule: "leave",
      },
      {
        id: "optic-fb",
        name: "2025 Panini Donruss Optic Football blaster",
        photo: "/photos/optic-fb.jpg",
        look: "Sports blister. Leave it.",
        shelf: "No printed price stored",
        sale: "No settled sale",
        rule: "leave",
      },
      {
        id: "chrome-fb",
        name: "2025 Topps Chrome Football hanger",
        photo: "/photos/chrome-fb.jpg",
        look: "Sports blister. Leave it.",
        shelf: "No printed price stored",
        sale: "No settled sale",
        rule: "leave",
      },
      {
        id: "select-fb",
        name: "2025 Panini Select Football mega",
        photo: "/photos/select-fb.jpg",
        look: "Sports blister. Leave it.",
        shelf: "No printed price stored",
        sale: "No settled sale",
        rule: "leave",
      },
      {
        id: "wnba",
        name: "2025 Panini Prizm WNBA hanger",
        photo: "/photos/wnba.jpg",
        look: "Sports blister. Leave it.",
        shelf: "No printed price stored",
        sale: "No settled sale",
        rule: "leave",
      },
      {
        id: "bowman-bb",
        name: "2025-26 Bowman Basketball value box",
        photo: "/photos/bowman-bb.jpg",
        look: "Sports blister. Leave it.",
        shelf: "No printed price stored",
        sale: "No settled sale",
        rule: "leave",
      },
      {
        id: "fifa",
        name: "2026 Panini Prizm FIFA World Cup soccer blaster",
        photo: "/photos/fifa.jpg",
        look: "Sports blister. Leave it.",
        shelf: "No printed price stored",
        sale: "No settled sale",
        rule: "leave",
      },
      {
        id: "artifacts",
        name: "2026-27 Upper Deck Artifacts hockey blaster",
        photo: "/photos/artifacts.jpg",
        look: "Not out until about Sept 23. Leave it.",
        shelf: "No printed price stored",
        sale: "No settled sale",
        rule: "leave",
      },
    ],
    sneakers: [
      ["jordan-1", "Jordan 1"],
      ["jordan-3", "Jordan 3"],
      ["jordan-4", "Jordan 4"],
      ["jordan-11", "Jordan 11"],
      ["dunk-sb", "Nike Dunk SB"],
      ["nb-990", "New Balance 990"],
      ["nb-991", "New Balance 991"],
      ["nb-992", "New Balance 992"],
      ["nb-993", "New Balance 993"],
      ["nb-2002r", "New Balance 2002R"],
      ["nb-550", "New Balance 550"],
      ["samba", "clean Samba"],
      ["yeezy", "real Yeezy 350/700"],
    ].map(function (pair) {
      return {
        id: pair[0],
        name: pair[1],
        photo: "/photos/sneakers.svg",
        look: "Leave it unless a stored sold beats the shelf after fees.",
        shelf: "Enter shelf in Cash",
        sale: "No settled sale",
        rule: "sold-beats-shelf",
      };
    }),
    tech: [
      ["iphone", "iPhone 12 or newer that powers on and is not iCloud locked"],
      ["ipad", "iPad 8th gen or newer"],
      ["macbook", "MacBook 2018+"],
      ["airpods", "AirPods Pro or Max that pair"],
      ["watch", "Apple Watch Series 6+"],
      ["switch", "Nintendo Switch or OLED that powers on"],
    ].map(function (pair) {
      return {
        id: pair[0],
        name: pair[1],
        photo: "/photos/tech.svg",
        look: "Leave it without a stored sold.",
        shelf: "Enter shelf in Cash",
        sale: "No settled sale",
        rule: "sold-beats-shelf",
      };
    }),
    streetwear: [
      ["supreme", "Supreme box logo or known collab"],
      ["bape", "tagged Bape"],
      ["palace", "Palace"],
      ["stussy", "Stussy"],
      ["chrome-hearts", "Chrome Hearts"],
      ["nike-adidas", "tagged Nike or Adidas collab"],
    ].map(function (pair) {
      return {
        id: pair[0],
        name: pair[1],
        photo: "/photos/streetwear.svg",
        look: "Leave it without a stored sold.",
        shelf: "Enter shelf in Cash",
        sale: "No settled sale",
        rule: "sold-beats-shelf",
      };
    }),
  };

  var TITLES = {
    cars: "Cars",
    sports: "Sports",
    sneakers: "Sneakers",
    tech: "Tech",
    streetwear: "Streetwear",
  };

  var screen = document.getElementById("screen");
  var tabButtons = document.querySelectorAll(".tabbar [data-tab]");
  var homeHTML = screen.innerHTML;
  var view = "home";
  var activeTab = "finds";

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function soldMap() {
    return readJson(SOLD_KEY, {});
  }

  function shelfMap() {
    return readJson(SHELF_KEY, {});
  }

  function shipping() {
    var n = Number(localStorage.getItem(SHIP_KEY));
    return Number.isFinite(n) ? n : 0;
  }

  function allItems() {
    return Object.keys(CATALOG).reduce(function (list, key) {
      return list.concat(CATALOG[key]);
    }, []);
  }

  function findItem(id) {
    return allItems().filter(function (item) {
      return item.id === id;
    })[0];
  }

  function storedSold(item) {
    var stored = soldMap()[item.id];
    if (stored != null && stored !== "") return Number(stored);
    return item.soldNum != null ? item.soldNum : null;
  }

  function storedShelf(item) {
    var stored = shelfMap()[item.id];
    if (stored != null && stored !== "") return Number(stored);
    return item.shelfNum != null ? item.shelfNum : null;
  }

  function verdictFor(item) {
    return C.itemVerdict({
      rule: item.rule,
      sold: storedSold(item),
      shelf: storedShelf(item),
      shipping: shipping(),
    });
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setTabs(on) {
    tabButtons.forEach(function (btn) {
      btn.classList.toggle("is-on", btn.getAttribute("data-tab") === on);
    });
  }

  function renderHome() {
    view = "home";
    activeTab = "finds";
    setTabs("finds");
    screen.innerHTML = homeHTML;
  }

  function renderList(cat) {
    view = "list";
    var items = CATALOG[cat] || [];
    screen.innerHTML =
      '<header class="header">' +
      '<button class="back" type="button" data-go="home">‹ Reseller</button>' +
      "<h1>" +
      escapeHtml(TITLES[cat]) +
      "</h1>" +
      "</header>" +
      '<main class="list">' +
      items
        .map(function (item) {
          var verdict = verdictFor(item);
          return (
            '<button class="row" type="button" data-item="' +
            escapeHtml(item.id) +
            '">' +
            '<img class="thumb" src="' +
            escapeHtml(item.photo) +
            '" alt="">' +
            '<span class="row-copy"><strong>' +
            escapeHtml(item.name) +
            "</strong></span>" +
            '<span class="verdict' +
            (verdict === "Buy" ? " is-buy" : "") +
            '">' +
            escapeHtml(verdict) +
            "</span>" +
            "</button>"
          );
        })
        .join("") +
      "</main>";
  }

  function renderReview(id) {
    var item = findItem(id);
    if (!item) return;
    view = "review";
    var sale = item.sale || "No settled sale";
    screen.innerHTML =
      '<header class="header">' +
      '<button class="back" type="button" data-go="back">‹ Back</button>' +
      "</header>" +
      '<div class="hero"><img src="' +
      escapeHtml(item.photo) +
      '" alt=""></div>' +
      '<div class="copy">' +
      "<h2>" +
      escapeHtml(item.name) +
      "</h2>" +
      "<p>" +
      escapeHtml(item.look) +
      "</p>" +
      '<p class="meta">Shelf: ' +
      escapeHtml(item.shelf) +
      "</p>" +
      '<p class="meta">' +
      escapeHtml(sale) +
      "</p>" +
      "</div>" +
      '<div class="sticky">' +
      '<button class="pass" type="button" data-go="back">Pass</button>' +
      '<button class="buy" type="button" data-go="back">Buy</button>' +
      "</div>";
  }

  function money(n) {
    return "$" + n.toFixed(2);
  }

  function renderCash() {
    view = "cash";
    activeTab = "cash";
    setTabs("cash");
    var items = allItems();
    var first = items[0];
    var selected = first ? first.id : "";
    screen.innerHTML =
      '<header class="header"><h1>Cash</h1></header>' +
      '<main class="panel">' +
      '<p class="note">Shelf vs stored sold, minus about 13% fees and shipping.</p>' +
      '<label class="field"><span>Item</span><select id="cash-item">' +
      items
        .map(function (item) {
          return (
            '<option value="' +
            escapeHtml(item.id) +
            '">' +
            escapeHtml(item.name) +
            "</option>"
          );
        })
        .join("") +
      "</select></label>" +
      '<label class="field"><span>Shelf</span><input id="cash-shelf" type="number" inputmode="decimal" step="0.01"></label>' +
      '<label class="field"><span>Stored sold</span><input id="cash-sold" type="number" inputmode="decimal" step="0.01" placeholder="Unknown"></label>' +
      '<label class="field"><span>Shipping</span><input id="cash-ship" type="number" inputmode="decimal" step="0.01"></label>' +
      '<p class="result" id="cash-out"></p>' +
      "</main>";

    var itemEl = document.getElementById("cash-item");
    var shelfEl = document.getElementById("cash-shelf");
    var soldEl = document.getElementById("cash-sold");
    var shipEl = document.getElementById("cash-ship");
    var outEl = document.getElementById("cash-out");
    itemEl.value = selected;
    shipEl.value = String(shipping());

    function fillItem() {
      var item = findItem(itemEl.value);
      if (!item) return;
      var shelf = storedShelf(item);
      var sold = storedSold(item);
      shelfEl.value = shelf != null ? String(shelf) : "";
      soldEl.value = sold != null ? String(sold) : "";
      paint();
    }

    function paint() {
      var item = findItem(itemEl.value);
      var soldVal = soldEl.value === "" ? null : Number(soldEl.value);
      var shelfVal = shelfEl.value === "" ? null : Number(shelfEl.value);
      var shipVal = Number(shipEl.value) || 0;
      localStorage.setItem(SHIP_KEY, String(shipVal));
      if (item) {
        var solds = soldMap();
        var shelves = shelfMap();
        if (soldVal == null) delete solds[item.id];
        else solds[item.id] = soldVal;
        if (shelfVal == null) delete shelves[item.id];
        else shelves[item.id] = shelfVal;
        writeJson(SOLD_KEY, solds);
        writeJson(SHELF_KEY, shelves);
      }
      var net = C.cashLeft(soldVal, shipVal);
      if (net == null) {
        outEl.textContent = "Unknown";
        return;
      }
      var extra =
        shelfVal == null
          ? ""
          : net > shelfVal
            ? " — beats shelf"
            : " — does not beat shelf";
      outEl.textContent = money(net) + " after fees and ship" + extra;
    }

    itemEl.addEventListener("change", fillItem);
    [shelfEl, soldEl, shipEl].forEach(function (el) {
      el.addEventListener("input", paint);
    });
    fillItem();
  }

  function renderBooks() {
    view = "books";
    activeTab = "books";
    setTabs("books");
    var books = readJson(BOOKS_KEY, []);
    screen.innerHTML =
      '<header class="header"><h1>Books</h1></header>' +
      '<main class="panel">' +
      '<label class="field"><span>Name</span><input id="book-name" type="text" autocomplete="off"></label>' +
      '<label class="field"><span>Cost</span><input id="book-cost" type="number" inputmode="decimal" step="0.01"></label>' +
      '<label class="field"><span>Date</span><input id="book-date" type="date"></label>' +
      '<button class="save" type="button" id="book-save">Save</button>' +
      '<div id="book-list">' +
      (books.length
        ? books
            .map(function (book) {
              return (
                '<div class="book"><p><strong>' +
                escapeHtml(book.name) +
                "</strong><br>" +
                escapeHtml(String(book.cost)) +
                " · " +
                escapeHtml(book.date) +
                '</p><button type="button" data-del="' +
                escapeHtml(book.id) +
                '">Delete</button></div>'
              );
            })
            .join("")
        : '<p class="note">No checks yet.</p>') +
      "</div></main>";
    document.getElementById("book-date").value = new Date()
      .toISOString()
      .slice(0, 10);
  }

  var lastList = "cars";

  document.addEventListener("click", function (event) {
    var open = event.target.closest("[data-open]");
    if (open) {
      lastList = open.getAttribute("data-open");
      renderList(lastList);
      return;
    }
    var itemBtn = event.target.closest("[data-item]");
    if (itemBtn) {
      renderReview(itemBtn.getAttribute("data-item"));
      return;
    }
    var go = event.target.closest("[data-go]");
    if (go) {
      var dest = go.getAttribute("data-go");
      if (dest === "home") renderHome();
      else renderList(lastList);
      return;
    }
    var tab = event.target.closest("[data-tab]");
    if (tab) {
      var name = tab.getAttribute("data-tab");
      if (name === "finds") renderHome();
      if (name === "cash") renderCash();
      if (name === "books") renderBooks();
      return;
    }
    var save = event.target.closest("#book-save");
    if (save) {
      var nameEl = document.getElementById("book-name");
      var costEl = document.getElementById("book-cost");
      var dateEl = document.getElementById("book-date");
      var name = (nameEl.value || "").trim();
      if (!name) return;
      var books = readJson(BOOKS_KEY, []);
      books.unshift({
        id: String(Date.now()),
        name: name,
        cost: costEl.value || "0",
        date: dateEl.value || new Date().toISOString().slice(0, 10),
      });
      writeJson(BOOKS_KEY, books);
      renderBooks();
      return;
    }
    var del = event.target.closest("[data-del]");
    if (del) {
      var books = readJson(BOOKS_KEY, []).filter(function (book) {
        return book.id !== del.getAttribute("data-del");
      });
      writeJson(BOOKS_KEY, books);
      renderBooks();
    }
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then(function (regs) {
      regs.forEach(function (reg) {
        reg.unregister();
      });
    });
  }
  if (window.caches) {
    caches.keys().then(function (keys) {
      keys.forEach(function (key) {
        caches.delete(key);
      });
    });
  }
})();
