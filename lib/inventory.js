(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ResellerInventory = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var KEY = "reseller-inventory-v2";

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeSeedItem(raw) {
    var item = clone(raw);
    item.removed = false;
    item.soldHistory = Array.isArray(item.soldHistory) ? item.soldHistory : [];
    item.grade = item.grade || "";
    item.photoMatched = false;
    item.photo = null;
    item.photoAlt = "Photo needed";
    if (!item.photoSource) item.photoSource = "No exact photo is bundled for this package.";
    return item;
  }

  function emptyState() {
    return { version: 2, items: [], tombstones: [], migratedBought: false };
  }

  function readRaw(storage) {
    try {
      var raw = storage.getItem(KEY);
      if (!raw) return { missing: true };
      var data = JSON.parse(raw);
      if (!data || !Array.isArray(data.items)) return { invalid: true, raw: raw };
      data.tombstones = Array.isArray(data.tombstones) ? data.tombstones : [];
      data.version = 2;
      return { state: data };
    } catch (err) {
      return { invalid: true };
    }
  }

  function fillBlanks(local, seed) {
    var next = clone(local);
    Object.keys(seed).forEach(function (key) {
      if (key === "soldHistory" || key === "id") return;
      var value = next[key];
      if (value == null || value === "") next[key] = seed[key];
    });
    next.id = local.id;
    next.soldHistory = Array.isArray(local.soldHistory) ? local.soldHistory : [];
    next.removed = Boolean(local.removed);
    return next;
  }

  function mergeSeed(state, seedItems) {
    var next = {
      version: 2,
      items: (state.items || []).map(clone),
      tombstones: (state.tombstones || []).slice(),
      migratedBought: Boolean(state.migratedBought),
    };
    var tomb = {};
    next.tombstones.forEach(function (id) {
      tomb[id] = true;
    });
    var index = {};
    next.items.forEach(function (item, i) {
      index[item.id] = i;
    });
    (seedItems || []).forEach(function (raw) {
      var seed = normalizeSeedItem(raw);
      if (tomb[seed.id]) return;
      if (index[seed.id] == null) {
        index[seed.id] = next.items.length;
        next.items.push(seed);
      } else {
        next.items[index[seed.id]] = fillBlanks(next.items[index[seed.id]], seed);
      }
    });
    return next;
  }

  function load(storage, seedFile) {
    var read = readRaw(storage);
    if (read.invalid) {
      return { ok: false, error: "invalid", state: null };
    }
    var state = read.missing ? emptyState() : read.state;
    state = mergeSeed(state, (seedFile && seedFile.items) || []);
    state = migrateBought(storage, state);
    storage.setItem(KEY, JSON.stringify(state));
    return { ok: true, state: state, seeded: Boolean(read.missing) };
  }

  function migrateBought(storage, state) {
    if (state.migratedBought) return state;
    var raw = null;
    try {
      raw = storage.getItem("reseller-bought") || storage.getItem("reseller-books");
    } catch (err) {
      raw = null;
    }
    state.migratedBought = true;
    if (!raw) return state;
    var books = [];
    try {
      books = JSON.parse(raw) || [];
    } catch (err) {
      return state;
    }
    if (!Array.isArray(books)) return state;
    var have = {};
    state.items.forEach(function (item) {
      have[item.id] = true;
    });
    books.forEach(function (book) {
      if (!book || !book.name) return;
      var id = "inv-bought-" + String(book.id || book.name);
      if (have[id] || state.tombstones.indexOf(id) !== -1) return;
      have[id] = true;
      state.items.push(
        normalizeSeedItem({
          id: id,
          name: book.name,
          notes: book.size ? "Size " + book.size : "",
          cost: Number(book.cost) || 0,
          resaleLow: null,
          resaleHigh: null,
          resaleLabel: "",
          tag: "mainline",
          store: book.store || "",
          date: book.date || "",
          status: "On hand",
          category: "Cars",
          grade: "",
          catalogId: null,
        })
      );
    });
    return state;
  }

  function write(storage, state) {
    storage.setItem(KEY, JSON.stringify(state));
  }

  function visible(state) {
    return (state.items || []).filter(function (item) {
      return !item.removed;
    });
  }

  function portfolio(state, seedFile) {
    var rows = visible(state);
    var bands = seedFile || {};
    var invested = bands.retailBand || [125, 155];
    var target = bands.resaleBand || [285, 415];
    return {
      packages: rows.length,
      investedLabel: "$" + invested[0] + "–$" + invested[1],
      targetLabel: "$" + target[0] + "–$" + target[1],
      verifiedSupers: rows.filter(function (item) {
        return item.tag === "sth" && item.status !== "Sold";
      }).length,
      toVerify: rows.filter(function (item) {
        return item.tag === "verify-sth" && item.status !== "Sold";
      }).length,
    };
  }

  function markRemoved(state, id) {
    state.tombstones = state.tombstones || [];
    if (state.tombstones.indexOf(id) === -1) state.tombstones.push(id);
    state.items = state.items.filter(function (item) {
      return item.id !== id;
    });
    return state;
  }

  function upsertUser(state, incoming) {
    var id = incoming.id || "inv-user-" + Date.now();
    var prev = null;
    state.items.forEach(function (item) {
      if (item.id === id) prev = item;
    });
    var history = prev && Array.isArray(prev.soldHistory) ? prev.soldHistory.slice() : [];
    (incoming.soldHistory || []).forEach(function (entry) {
      history.push(entry);
    });
    var row = normalizeSeedItem(
      Object.assign({}, prev || {}, incoming, {
        id: id,
        soldHistory: history,
        photo: null,
        photoMatched: false,
        photoAlt: "Photo needed",
      })
    );
    if (prev) {
      state.items = state.items.map(function (item) {
        return item.id === id ? row : item;
      });
    } else {
      state.items.unshift(row);
    }
    return row;
  }

  function toCsv(items) {
    var headers = ["id", "name", "notes", "cost", "resaleLow", "resaleHigh", "tag", "status", "grade", "store", "date", "category"];
    function cell(value) {
      var text = value == null ? "" : String(value);
      if (/[",\n]/.test(text)) return '"' + text.replace(/"/g, '""') + '"';
      return text;
    }
    var lines = [headers.join(",")];
    (items || []).forEach(function (item) {
      lines.push(headers.map(function (key) { return cell(item[key]); }).join(","));
    });
    return lines.join("\n") + "\n";
  }

  function importJson(state, data) {
    var items = Array.isArray(data) ? data : data && data.items;
    if (!Array.isArray(items)) {
      return { ok: false, error: "This file has no items list." };
    }
    items.forEach(function (incoming, index) {
      if (!incoming || !incoming.name) return;
      var id = incoming.id ? String(incoming.id) : "inv-user-import-" + Date.now() + "-" + index;
      var prev = null;
      state.items.forEach(function (item) {
        if (item.id === id) prev = item;
      });
      var history = prev && Array.isArray(prev.soldHistory) ? prev.soldHistory.slice() : [];
      (incoming.soldHistory || []).forEach(function (entry) {
        history.push(entry);
      });
      var row = normalizeSeedItem(
        Object.assign({}, prev || {}, incoming, {
          id: id,
          soldHistory: history,
          photo: null,
          photoMatched: false,
        })
      );
      if (prev) {
        state.items = state.items.map(function (item) {
          return item.id === id ? row : item;
        });
      } else if ((state.tombstones || []).indexOf(id) === -1) {
        state.items.push(row);
      }
    });
    return { ok: true, state: state };
  }

  return {
    KEY: KEY,
    normalizeSeedItem: normalizeSeedItem,
    readRaw: readRaw,
    mergeSeed: mergeSeed,
    load: load,
    write: write,
    visible: visible,
    portfolio: portfolio,
    markRemoved: markRemoved,
    upsertUser: upsertUser,
    toCsv: toCsv,
    importJson: importJson,
  };
});
