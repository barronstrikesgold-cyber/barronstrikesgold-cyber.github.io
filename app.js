(function () {
  var C = window.ResellerCash;
  var SOLD_KEY = "reseller-sold";
  var SHELF_KEY = "reseller-shelf";
  var SHIP_KEY = "reseller-ship";
  var BOOKS_KEY = "reseller-books";

  var SHOE_SIZE =
    "Read the US size from the tag. Men's 8 to 12 sell fastest, 10 and 11 strongest, tiny and huge sizes slower. No size tag is a pass.";
  var CLOTHES_SIZE =
    "Read the letter size on the tag, men's or women's. Streetwear M, L, and XL move fastest. XXS and XXXL slower. Missing size tag is a pass.";

  var CATALOG = {
    cars: [
      {
        id: "cuda",
        name: "Gold '70 AAR Cuda Super",
        photo: "/photos/cuda.jpg",
        shelf: "About $1",
        shelfNum: 1,
        listPrice: "No settled sale",
        checkedPrice: "No settled sale",
        source: "No settled sale fetched",
        date: "Just landed 2026 case P",
        checkedNote: "Do not invent a sold. Asking prices are not sales.",
        sentiment: "unknown",
        digest:
          "Spectraflame gold Super in 2026 case P. No settled sale, so cash is unknown. Check the Super flame and the case P card before you pay more than about $1.",
        fitness: "Watch",
        worth: true,
      },
      {
        id: "firebird",
        name: "Blue '67 Firebird 400 Super",
        photo: "/photos/firebird.jpg",
        shelf: "About $1",
        shelfNum: 1,
        listPrice: "No settled sale",
        checkedPrice: "No settled sale",
        source: "No settled sale fetched",
        date: "Just landed 2026 case Q",
        checkedNote: "Do not invent a sold. Asking prices are not sales.",
        sentiment: "unknown",
        digest:
          "Spectraflame blue Super in 2026 case Q. No settled sale, so leftover cash is unknown. Confirm the Super card and pass anything that is not this blue Super.",
        fitness: "Watch",
        worth: true,
      },
      {
        id: "skyline",
        name: "Black Nissan Skyline HT 2000GT-X regular TH",
        photo: "/photos/skyline.jpg",
        shelf: "About $1",
        shelfNum: 1,
        listPrice: "No settled sale",
        checkedPrice: "No settled sale",
        source: "No settled sale fetched",
        date: "2026 case P",
        checkedNote: "Do not invent a sold.",
        sentiment: "unknown",
        digest:
          "Black regular Treasure Hunt, silver flame, not Super. No settled sale. At about $1 it is a Watch if the TH flame is real; do not pay Super money.",
        fitness: "Watch",
        worth: true,
      },
      {
        id: "etb",
        name: "Pokémon 30th Celebration ETB",
        photo: "/photos/etb.jpg",
        shelf: "Printed $49.99",
        shelfNum: 49.99,
        listPrice: "No settled sale",
        checkedPrice: "No settled sale",
        source: "Printed retail",
        date: "Releases September 16, 2026",
        checkedNote: "Buy only at printed $49.99. Asking prices are not sales.",
        sentiment: "unknown",
        digest:
          "30th Celebration Elite Trainer Box. No settled sale yet. Watch only at printed $49.99; anything else on the shelf is a Pass.",
        fitness: "Watch",
        worth: true,
        buyUrl:
          "https://www.target.com/p/pok-233-mon-trading-card-game-30th-celebration-elite-trainer-box/-/A-1010892076",
        buyLabel: "Buy at Target",
      },
      {
        id: "f40",
        name: "Ferrari F40 Competizione Super",
        photo: "/photos/f40.jpg",
        shelf: "About $1",
        shelfNum: 1,
        listPrice: "$122",
        checkedPrice: "$122 tracked average",
        source: "HW Price Guide",
        date: "August 2026",
        checkedNote: "8 sales, down 12% from $138 in July.",
        sentiment: "down",
        digest:
          "Ferrari F40 Competizione Super Treasure Hunt. Tracked average $122 still clears about $1 on the peg after fees. Check Spectraflame and the Super flame; the trend is down, not a reason to skip a $1 Super.",
        fitness: "Strong",
        soldNum: 122,
        cashText: "about $105 before shipping",
      },
      {
        id: "civic",
        name: "Honda Civic Custom Super",
        photo: "/photos/civic.jpg",
        shelf: "About $1",
        shelfNum: 1,
        listPrice: "$61",
        checkedPrice: "$61 tracked average",
        source: "HW Price Guide",
        date: "August 2026",
        checkedNote: "36 sales, up 2%. Well off the spring highs.",
        sentiment: "flat to slightly up, well off the spring highs",
        digest:
          "Honda Civic Custom Super. August average $61 makes about $1 a Strong buy after fees. Check the Super card; this is not the old spring print.",
        fitness: "Strong",
        soldNum: 61,
      },
      {
        id: "lotus",
        name: "Lotus Sport Elise Super",
        photo: "/photos/lotus.jpg",
        shelf: "About $1",
        shelfNum: 1,
        listPrice: "$33",
        checkedPrice: "$33 tracked average",
        source: "HW Price Guide",
        date: "August 2026",
        checkedNote: "23 sales, down 14%. Orange Elise, not Elite.",
        sentiment: "down",
        digest:
          "Orange Lotus Sport Elise Super, not Elite. Still a $1 buy, but do not expect the old $50. Confirm Elise on the card and the orange Super.",
        fitness: "Watch",
        soldNum: 33,
      },
      {
        id: "impala",
        name: "'64 Impala Super",
        photo: "/photos/impala.jpg",
        shelf: "About $1",
        shelfNum: 1,
        listPrice: "$45",
        checkedPrice: "$45",
        source: "HW Price Guide",
        date: "July 2026",
        checkedNote: "22 sales, down 10%. No August figure fetched.",
        sentiment: "down",
        digest:
          "Teal '64 Impala Super. July tracked $45 still beats about $1 after fees, but the print is down and August was not fetched. Check the teal Super card.",
        fitness: "Watch",
        soldNum: 45,
      },
      {
        id: "mustang",
        name: "Ford Mustang GTD Super",
        photo: "/photos/mustang.jpg",
        shelf: "About $1",
        shelfNum: 1,
        listPrice: "$53",
        checkedPrice: "$53",
        source: "HW Price Guide",
        date: "May 2026",
        checkedNote: "41 sales, up 2% that month. No later month fetched.",
        sentiment: "unknown after May",
        digest:
          "Ford Mustang GTD Super. May $53 still works at about $1 after fees. No later month was fetched, so do not treat this as a live ticker. Check the Super card.",
        fitness: "Watch",
        soldNum: 53,
      },
      {
        id: "porsche",
        name: "Brown Porsche 911 Carrera RS 2.7 Super",
        photo: "/photos/porsche.jpg",
        shelf: "About $1",
        shelfNum: 1,
        listPrice: "No settled sale",
        checkedPrice: "No settled sale",
        source: "No settled sale fetched",
        date: "No sale date",
        checkedNote: "Do not invent a sold. Asking prices are not sales.",
        sentiment: "unknown",
        digest:
          "Brown Porsche 911 Carrera RS 2.7 Super. No settled sale, so leftover cash is unknown. At about $1 it is a Watch if the Super card is real.",
        fitness: "Watch",
      },
      {
        id: "matchbox",
        name: "Matchbox Super Chase",
        photo: "/photos/matchbox.jpg",
        shelf: "About $1",
        shelfNum: 1,
        listPrice: "No settled sale",
        checkedPrice: "No settled sale",
        source: "No settled sale fetched",
        date: "No sale date",
        checkedNote: "Only if the card says SUPER CHASE.",
        sentiment: "unknown",
        digest:
          "Matchbox Super Chase only if the card says SUPER CHASE. No settled sale. Pass any Matchbox that does not print those words.",
        fitness: "Watch",
      },
    ],
    sports: [
      {
        id: "topps-s1",
        name: "2026 Topps Series 1 Baseball value/blaster",
        photo: "/photos/topps-s1.jpg",
        shelf: "Printed often $24.99",
        shelfNum: 24.99,
        listPrice: "$16.80",
        checkedPrice: "$16.80, $14.40, $14.40, $14.40, $13.20",
        source: "Fanatics Collect",
        date: "September 7, 2026",
        checkedNote: "Sold under the printed $24.99 shelf.",
        sentiment: "under retail",
        digest:
          "2026 Topps Series 1 baseball value/blaster. Fanatics Collect sold it under the shelf on September 7, 2026. Fees wipe the rest, so printed $24.99 is a Pass.",
        fitness: "Pass",
        soldNum: 16.8,
        worth: true,
      },
      {
        id: "topps-fb",
        name: "2026 Topps Football blaster",
        photo: "/photos/topps-fb.jpg",
        shelf: "Printed retail",
        listPrice: "No settled sale",
        checkedPrice: "No settled sale",
        source: "No settled sale fetched",
        date: "Out August 21, 2026",
        checkedNote: "Do not invent a sold.",
        sentiment: "unknown",
        digest:
          "2026 Topps Football blaster, out August 21, 2026. No settled sale. At printed retail this is a Pass until a stored sold beats the shelf after fees.",
        fitness: "Pass",
        worth: true,
        buyUrl:
          "https://www.target.com/p/2026-topps-nfl-flagship-football-trading-card-value-box/-/A-1012944733",
        buyLabel: "Buy at Target",
      },
      {
        id: "fifa",
        name: "2026 Panini Prizm FIFA World Cup soccer blaster",
        photo: "/photos/fifa.jpg",
        shelf: "Printed about $34.95",
        shelfNum: 34.95,
        listPrice: "No settled sale",
        checkedPrice: "No settled sale",
        source: "No settled sale fetched",
        date: "2026 retail blister",
        checkedNote: "Printed about $34.95. Asking prices are not sales.",
        sentiment: "unknown",
        digest:
          "2026 Panini Prizm FIFA World Cup soccer blaster. No settled sale. Printed about $34.95 is a Pass until a stored sold clears fees.",
        fitness: "Pass",
        worth: true,
      },
      {
        id: "artifacts",
        name: "2026-27 Upper Deck Artifacts hockey blaster",
        photo: "/photos/artifacts.jpg",
        shelf: "Not on the shelf yet",
        listPrice: "No settled sale",
        checkedPrice: "No settled sale",
        source: "No settled sale fetched",
        date: "Not out until about September 23, 2026",
        checkedNote: "Do not invent a sold.",
        sentiment: "unknown",
        digest:
          "2026-27 Upper Deck Artifacts hockey blaster. Not out until about September 23, 2026. Pass until it is on the shelf and a sold exists.",
        fitness: "Pass",
        worth: true,
      },
      {
        id: "optic-fb",
        name: "2025 Panini Donruss Optic Football blaster",
        photo: "/photos/optic-fb.jpg",
        shelf: "Printed retail",
        listPrice: "No settled sale",
        checkedPrice: "No settled sale",
        source: "No settled sale fetched",
        date: "Still on some hooks",
        checkedNote: "Do not invent a sold.",
        sentiment: "unknown",
        digest:
          "2025 Donruss Optic football blaster still on some hooks. No settled sale. Printed price is a Pass.",
        fitness: "Pass",
      },
      {
        id: "chrome-fb",
        name: "2025 Topps Chrome Football hanger",
        photo: "/photos/chrome-fb.jpg",
        shelf: "Printed retail",
        listPrice: "No settled sale",
        checkedPrice: "No settled sale",
        source: "No settled sale fetched",
        date: "No sale date",
        checkedNote: "Do not invent a sold.",
        sentiment: "unknown",
        digest:
          "2025 Topps Chrome football hanger. No settled sale. Leave the printed hanger on the hook.",
        fitness: "Pass",
      },
      {
        id: "select-fb",
        name: "2025 Panini Select Football mega",
        photo: "/photos/select-fb.jpg",
        shelf: "Printed retail",
        listPrice: "No settled sale",
        checkedPrice: "No settled sale",
        source: "No settled sale fetched",
        date: "No sale date",
        checkedNote: "Do not invent a sold.",
        sentiment: "unknown",
        digest:
          "2025 Panini Select football mega. No settled sale. Printed mega price is a Pass.",
        fitness: "Pass",
      },
      {
        id: "wnba",
        name: "2025 Panini Prizm WNBA hanger",
        photo: "/photos/wnba.jpg",
        shelf: "Printed retail",
        listPrice: "No settled sale",
        checkedPrice: "No settled sale",
        source: "No settled sale fetched",
        date: "No sale date",
        checkedNote: "Do not invent a sold.",
        sentiment: "unknown",
        digest:
          "2025 Panini Prizm WNBA hanger. No settled sale. Printed hanger is a Pass.",
        fitness: "Pass",
      },
      {
        id: "bowman-bb",
        name: "2025-26 Bowman Basketball value box",
        photo: "/photos/bowman-bb.jpg",
        shelf: "Printed retail",
        listPrice: "No settled sale",
        checkedPrice: "No settled sale",
        source: "No settled sale fetched",
        date: "No sale date",
        checkedNote: "Do not invent a sold.",
        sentiment: "unknown",
        digest:
          "2025-26 Bowman basketball value box. No settled sale. Printed box is a Pass.",
        fitness: "Pass",
      },
    ],
    sneakers: [
      {
        id: "jordan-1",
        name: "Jordan 1",
        photo: "/photos/jordan-1.jpg",
        photoNote: "Stand-in of this model. Not the exact colorway.",
        shelf: "Shelf varies by colorway",
        listPrice: "By colorway. No single sold.",
        checkedPrice: "By colorway. No single sold.",
        source: "Category range only, not a sale",
        date: "No settled sale fetched",
        checkedNote: "General-release High often $150 to $250 new, used less. Check the exact colorway.",
        sentiment: "unknown",
        digest:
          "Air Jordan 1. There is no one sold price for a Jordan. Watch if clean with a US size 8 to 12 tag on; Pass if crushed or no size. Jordan 1 runs a bit snug.",
        fitness: "Watch",
        sizing: SHOE_SIZE + " Jordan 1 runs a bit snug.",
        worth: true,
      },
      {
        id: "dunk-sb",
        name: "Nike Dunk SB",
        photo: "/photos/dunk-sb.jpg",
        photoNote: "Stand-in of this model. Not the exact colorway.",
        shelf: "Shelf varies by colorway",
        listPrice: "By colorway. No single sold.",
        checkedPrice: "By colorway. No single sold.",
        source: "No settled sale fetched",
        date: "No sale date",
        checkedNote: "Stronger than regular Dunks. No single sold.",
        sentiment: "unknown",
        digest:
          "Nike Dunk SB is stronger than regular Dunks, but price is by colorway. Watch if clean and tagged. Dunk runs a bit snug. Pass with no size tag.",
        fitness: "Watch",
        sizing: SHOE_SIZE + " Dunk runs a bit snug.",
        worth: true,
      },
      {
        id: "nb-550",
        name: "New Balance 550",
        photo: "/photos/nb-550.jpg",
        photoNote: "Stand-in of this model. Not the exact colorway.",
        shelf: "General-release 550 often near retail",
        listPrice: "By colorway. No single sold.",
        checkedPrice: "By colorway. No single sold.",
        source: "No settled sale fetched",
        date: "No sale date",
        checkedNote: "General-release 550 often near retail. No single sold.",
        sentiment: "unknown",
        digest:
          "New Balance 550 is true to size and wider than Nike. Watch if clean. Pass beaters. No single sold for the silhouette.",
        fitness: "Watch",
        sizing: SHOE_SIZE + " New Balance 550 is true to size and wider.",
        worth: true,
      },
      {
        id: "jordan-3",
        name: "Jordan 3",
        photo: "/photos/jordan-3.jpg",
        photoNote: "Stand-in of this model. Not the exact colorway.",
        shelf: "Shelf varies by colorway",
        listPrice: "By colorway. No single sold.",
        checkedPrice: "By colorway. No single sold.",
        source: "Category range only, not a sale",
        date: "No settled sale fetched",
        checkedNote: "General-release High often $150 to $250 new, used less. Check the exact colorway.",
        sentiment: "unknown",
        digest:
          "Air Jordan 3. Price is by colorway, size, and condition. Watch if clean, size 8 to 12, size tag on. Pass if crushed or no size.",
        fitness: "Watch",
        sizing: SHOE_SIZE,
      },
      {
        id: "jordan-4",
        name: "Jordan 4",
        photo: "/photos/jordan-4.jpg",
        photoNote: "Stand-in of this model. Not the exact colorway.",
        shelf: "Shelf varies by colorway",
        listPrice: "By colorway. No single sold.",
        checkedPrice: "By colorway. No single sold.",
        source: "Category range only, not a sale",
        date: "No settled sale fetched",
        checkedNote: "General-release High often $150 to $250 new, used less. Check the exact colorway.",
        sentiment: "unknown",
        digest:
          "Air Jordan 4. No single sold. Watch if clean with a tagged US 8 to 12. Pass crushed pairs and missing tags.",
        fitness: "Watch",
        sizing: SHOE_SIZE,
      },
      {
        id: "jordan-11",
        name: "Jordan 11",
        photo: "/photos/jordan-11.jpg",
        photoNote: "Stand-in of this model. Not the exact colorway.",
        shelf: "Shelf varies by colorway",
        listPrice: "By colorway. No single sold.",
        checkedPrice: "By colorway. No single sold.",
        source: "Category range only, not a sale",
        date: "No settled sale fetched",
        checkedNote: "General-release High often $150 to $250 new, used less. Check the exact colorway.",
        sentiment: "unknown",
        digest:
          "Air Jordan 11. Check the exact colorway. Watch if clean and tagged in 8 to 12. Pass if crushed or no size.",
        fitness: "Watch",
        sizing: SHOE_SIZE,
      },
      {
        id: "nb-990",
        name: "New Balance 990",
        photo: "/photos/nb-990.jpg",
        photoNote: "Stand-in of this model. Not the exact colorway.",
        shelf: "Shelf varies by colorway",
        listPrice: "By colorway. No single sold.",
        checkedPrice: "By colorway. No single sold.",
        source: "No settled sale fetched",
        date: "No sale date",
        checkedNote: "No single sold.",
        sentiment: "unknown",
        digest:
          "New Balance 990. Watch if clean. Pass beaters. No invented sold.",
        fitness: "Watch",
        sizing: SHOE_SIZE,
      },
      {
        id: "nb-2002r",
        name: "New Balance 2002R",
        photo: "/photos/nb-2002r.jpg",
        photoNote: "Photo of a New Balance 2002R. Not a specific store pair.",
        shelf: "Shelf varies by colorway",
        listPrice: "By colorway. No single sold.",
        checkedPrice: "By colorway. No single sold.",
        source: "No settled sale fetched",
        date: "No sale date",
        checkedNote: "No single sold.",
        sentiment: "unknown",
        digest:
          "New Balance 2002R. Watch if clean. Pass beaters.",
        fitness: "Watch",
        sizing: SHOE_SIZE,
      },
      {
        id: "samba",
        name: "Adidas Samba",
        photo: "/photos/samba.jpg",
        photoNote: "Stand-in of this model. Not the exact colorway.",
        shelf: "Only if clean",
        listPrice: "No settled sale",
        checkedPrice: "No settled sale",
        source: "No settled sale fetched",
        date: "No sale date",
        checkedNote: "Only if clean. Asking prices are not sales.",
        sentiment: "unknown",
        digest:
          "Adidas Samba only if clean. No settled sale. Watch a tagged clean pair in 8 to 12. Pass dirty pairs and missing tags.",
        fitness: "Watch",
        sizing: SHOE_SIZE,
      },
      {
        id: "yeezy",
        name: "Yeezy 350 or 700",
        photo: "/photos/yeezy.jpg",
        photoNote: "Stand-in of this model. Not the exact colorway.",
        shelf: "Only if real",
        listPrice: "No settled sale",
        checkedPrice: "No settled sale",
        source: "No settled sale fetched",
        date: "No sale date",
        checkedNote: "Only if boost, insole, and size tag look real.",
        sentiment: "unknown",
        digest:
          "Yeezy 350 or 700 only if boost, insole, and size tag look real. No settled sale. Watch a real tagged pair. Pass fakes and no size tag.",
        fitness: "Watch",
        sizing: SHOE_SIZE,
      },
    ],
    tech: [
      {
        id: "iphone",
        name: "iPhone 12 or newer",
        photo: "/photos/iphone.jpg",
        photoNote: "Stand-in of this model. Not a specific storage or color.",
        shelf: "Only if it powers on",
        listPrice: "No settled sale",
        checkedPrice: "No settled sale",
        source: "No settled sale fetched",
        date: "No sale date",
        checkedNote: "Do not invent an iPhone sold.",
        sentiment: "unknown",
        digest:
          "iPhone 12 or newer. Fitness is Watch only if it powers on and is not iCloud locked. Locked or blacklisted is a pass. No invented sold.",
        fitness: "Watch",
        worth: true,
      },
      {
        id: "switch",
        name: "Nintendo Switch or OLED",
        photo: "/photos/switch.jpg",
        photoNote: "Stand-in of this model.",
        shelf: "Only if it powers on",
        listPrice: "No settled sale",
        checkedPrice: "No settled sale",
        source: "No settled sale fetched",
        date: "No sale date",
        checkedNote: "Do not invent a sold.",
        sentiment: "unknown",
        digest:
          "Nintendo Switch or OLED. Watch only if it powers on. A dead or locked unit is a pass. No invented sold.",
        fitness: "Watch",
        worth: true,
      },
      {
        id: "ipad",
        name: "iPad 8th gen or newer, or recent Air or Pro",
        photo: "/photos/ipad.jpg",
        photoNote: "Stand-in of this model.",
        shelf: "Only if it powers on",
        listPrice: "No settled sale",
        checkedPrice: "No settled sale",
        source: "No settled sale fetched",
        date: "No sale date",
        checkedNote: "Do not invent a sold.",
        sentiment: "unknown",
        digest:
          "iPad 8th gen or newer, or a recent Air or Pro. Watch only if it powers on and is not iCloud locked. Locked or blacklisted is a pass.",
        fitness: "Watch",
      },
      {
        id: "macbook",
        name: "MacBook 2018 or newer that boots",
        photo: "/photos/macbook.jpg",
        photoNote: "Stand-in of this model.",
        shelf: "Only if it boots",
        listPrice: "No settled sale",
        checkedPrice: "No settled sale",
        source: "No settled sale fetched",
        date: "No sale date",
        checkedNote: "Do not invent a sold.",
        sentiment: "unknown",
        digest:
          "MacBook 2018 or newer. Watch only if it boots and is not locked. A machine that will not sign in is a pass.",
        fitness: "Watch",
      },
      {
        id: "airpods",
        name: "AirPods Pro or Max that pair",
        photo: "/photos/airpods.jpg",
        photoNote: "Stand-in of this model.",
        shelf: "Only if they pair",
        listPrice: "No settled sale",
        checkedPrice: "No settled sale",
        source: "No settled sale fetched",
        date: "No sale date",
        checkedNote: "Do not invent a sold.",
        sentiment: "unknown",
        digest:
          "AirPods Pro or Max. Watch only if they pair. Dead cases or unmatched buds are a pass. No invented sold.",
        fitness: "Watch",
      },
      {
        id: "watch",
        name: "Apple Watch Series 6 or newer that pairs",
        photo: "/photos/watch.jpg",
        photoNote: "Stand-in of this model.",
        shelf: "Only if it pairs",
        listPrice: "No settled sale",
        checkedPrice: "No settled sale",
        source: "No settled sale fetched",
        date: "No sale date",
        checkedNote: "Do not invent a sold.",
        sentiment: "unknown",
        digest:
          "Apple Watch Series 6 or newer. Watch only if it pairs. Activation lock is a pass.",
        fitness: "Watch",
      },
    ],
    streetwear: [
      {
        id: "supreme",
        name: "Supreme box logo or known collab",
        photo: "/photos/supreme.jpg",
        photoNote: "Stand-in of a box-logo tee. Not a specific drop.",
        shelf: "Only with a letter size tag",
        listPrice: "No settled sale",
        checkedPrice: "No settled sale",
        source: "No settled sale fetched",
        date: "No sale date",
        checkedNote: "Do not invent a Supreme sold.",
        sentiment: "unknown",
        digest:
          "Supreme box logo or a known collab. No invented sold. Letter size is required. M, L, and XL move fastest. No tag is a pass.",
        fitness: "Watch",
        sizing: CLOTHES_SIZE,
        worth: true,
      },
      {
        id: "bape",
        name: "Tagged Bape",
        photo: "/photos/bape.jpg",
        photoNote: "Stand-in camo hoodie. Not a specific season.",
        shelf: "Only with a letter size tag",
        listPrice: "No settled sale",
        checkedPrice: "No settled sale",
        source: "No settled sale fetched",
        date: "No sale date",
        checkedNote: "Do not invent a sold.",
        sentiment: "unknown",
        digest:
          "Tagged Bape only. No invented sold. Read the letter size. No tag is a pass.",
        fitness: "Watch",
        sizing: CLOTHES_SIZE,
      },
      {
        id: "nike-adidas",
        name: "Tagged Nike or Adidas collab",
        photo: "/photos/collab-tee.jpg",
        photoNote: "Stand-in collab tee. Not a specific drop.",
        shelf: "Only with a letter size tag",
        listPrice: "No settled sale",
        checkedPrice: "No settled sale",
        source: "No settled sale fetched",
        date: "No sale date",
        checkedNote: "Do not invent a sold.",
        sentiment: "unknown",
        digest:
          "Tagged Nike or Adidas collab only. Letter size required. No tag is a pass. No invented sold.",
        fitness: "Watch",
        sizing: CLOTHES_SIZE,
      },
    ],
  };

  var TITLES = {
    cars: "Cars",
    sports: "Sports",
    sneakers: "Sneakers",
    tech: "Tech",
    streetwear: "Streetwear",
  };

  Object.keys(CATALOG).forEach(function (key) {
    CATALOG[key].forEach(function (item) {
      item._cat = key;
    });
  });

  var SHOE_SIZES = ["8", "8.5", "9", "9.5", "10", "10.5", "11", "11.5", "12"];
  var CLOTHES_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
  var FAST_SHOES = { 10: 1, 11: 1 };
  var FAST_CLOTHES = { M: 1, L: 1, XL: 1 };

  var STORES = {
    walmart: {
      name: "Walmart",
      look: "Look here: sports hangers and blasters, Pokémon box on Sept 16 only at $49.99, Hot Wheels peg about $1, electronics that power on. Skip printers and locked phones.",
      cats: ["cars", "sports", "tech"],
      ids: null,
      search: "https://www.walmart.com/search?q=",
    },
    target: {
      name: "Target",
      look: "Look here: sports hangers and blasters, Hot Wheels peg, streetwear with tags, Pokémon if printed $49.99.",
      cats: ["cars", "sports", "streetwear"],
      ids: null,
      search: "https://www.target.com/s?searchTerm=",
    },
    goodwill: {
      name: "Goodwill",
      look: "Look here: sneakers with a size tag (Jordan, Dunk SB, clean New Balance), streetwear with tags (Supreme, Bape), tech that powers on. Skip crushed shoes, no-tag clothes, printers.",
      cats: ["sneakers", "streetwear", "tech"],
      ids: null,
      search: "https://shopgoodwill.com/categories/search?q=",
    },
    bestbuy: {
      name: "Best Buy",
      look: "Look here: open-box or clearance Apple and a Switch only if it powers on and is not iCloud locked. No invented open-box price. Fitness Watch until a stored sold exists.",
      cats: null,
      ids: ["iphone", "ipad", "macbook", "airpods", "watch", "switch"],
      search: "https://www.bestbuy.com/site/searchpage.jsp?st=",
    },
    dollartree: {
      name: "Dollar Tree",
      look: "Scan the $1.25 checker. A red dot means the item is priced above $1.25, not a discount. Do not treat sticker color as a sale. Use Search this store. Name-brand food or party, seasonal before the holiday, books, craft tools, or a mis-tagged name brand can be worth a look. Skip random housewares with no sold. No generic Dollar Tree item is tracked here: no unique product photo and no settled sale.",
      cats: null,
      ids: [],
      search: "https://www.dollartree.com/searchresults?Ntt=",
    },
  };

  var CHECK = {
    walmart: "https://www.walmart.com/search?q=",
    target: "https://www.target.com/s?searchTerm=",
    bestbuy: "https://www.bestbuy.com/site/searchpage.jsp?st=",
    goodwill: "https://shopgoodwill.com/categories/search?q=",
    dollartree: "https://www.dollartree.com/searchresults?Ntt=",
    dollartreeJson: "https://www.dollartree.com/ccstoreui/v1/search?Ntt=",
    google: "https://www.google.com/search?q=",
    shopping: "https://www.google.com/search?tbm=shop&q=",
  };
  try {
    var checkNode = document.getElementById("check-json");
    if (checkNode) CHECK = JSON.parse(checkNode.textContent);
  } catch (err) {}

  function defaultPurchase(item) {
    var q = item.name;
    if (item._cat === "cars") {
      return {
        href: (CHECK.shopping || "https://www.google.com/search?tbm=shop&q=") + encodeURIComponent(q),
        label: "Check stores",
      };
    }
    if (item._cat === "sports") {
      return {
        href: (CHECK.target || "https://www.target.com/s?searchTerm=") + encodeURIComponent(q),
        label: "Buy",
      };
    }
    if (item._cat === "tech") {
      return {
        href: (CHECK.bestbuy || "https://www.bestbuy.com/site/searchpage.jsp?st=") + encodeURIComponent(q),
        label: "Buy",
      };
    }
    if (item._cat === "sneakers") {
      return {
        href: (CHECK.shopping || "https://www.google.com/search?tbm=shop&q=") + encodeURIComponent(q),
        label: "Buy",
      };
    }
    return {
      href: (CHECK.goodwill || "https://shopgoodwill.com/categories/search?q=") + encodeURIComponent(q),
      label: "Buy",
    };
  }

  Object.keys(CATALOG).forEach(function (key) {
    CATALOG[key].forEach(function (item) {
      if (!item.buyUrl) {
        var link = defaultPurchase(item);
        item.buyUrl = link.href;
        item.buyLabel = link.label;
      }
    });
  });

  var MARKS_KEY = "reseller-marks";
  var VISIT_KEY = "reseller-visit";
  var SIZE_KEY = "reseller-sizes";
  var BOUGHT_KEY = "reseller-bought";
  var CHECKED_AT_KEY = "reseller-checked-at";

  var NOT_TRACKED = {
    sneakers:
      "Not tracked yet: New Balance 991, 992, and 993. No unique product photo was fetched for those models.",
    streetwear:
      "Not tracked yet: Palace, Stussy, and Chrome Hearts. No unique product photo was fetched.",
  };

  var TODAY = "2026-09-09";
  var DATES = [];
  try {
    DATES = JSON.parse(document.getElementById("dates-json").textContent);
  } catch (err) {
    DATES = [];
  }

  var screen = document.getElementById("screen");
  var tabButtons = document.querySelectorAll(".tabbar [data-tab]");
  var homeHTML = screen.innerHTML;
  var lastList = { type: "home" };
  var lastReviewId = null;

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

  function sizeMap() {
    return readJson(SIZE_KEY, {});
  }

  function checkedAtMap() {
    return readJson(CHECKED_AT_KEY, {});
  }

  function marksMap() {
    return readJson(MARKS_KEY, {});
  }

  function stampRefresh(id) {
    var map = checkedAtMap();
    var when = new Date().toISOString();
    if (id) map[id] = when;
    map.hunt = when;
    writeJson(CHECKED_AT_KEY, map);
    return when;
  }

  function trackedLine(item) {
    var date =
      item.date && item.date !== "No sale date" ? item.date : "no settled date";
    var extra = checkedAtMap()[item.id];
    return extra
      ? "Tracked · " + date + " · refreshed " + extra.slice(0, 16).replace("T", " ")
      : "Tracked · " + date;
  }

  function visitIds() {
    return readJson(VISIT_KEY, []);
  }

  function shipping() {
    var n = Number(localStorage.getItem(SHIP_KEY));
    return Number.isFinite(n) ? n : 0;
  }

  function boughtList() {
    var next = readJson(BOUGHT_KEY, null);
    if (next) return next;
    return readJson(BOOKS_KEY, []);
  }

  function allItems() {
    return Object.keys(CATALOG).reduce(function (list, key) {
      return list.concat(
        CATALOG[key].map(function (item) {
          item._cat = key;
          return item;
        })
      );
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

  function storedSize(item) {
    return sizeMap()[item.id] || "";
  }

  function fitnessFor(item) {
    if (item._cat === "dollartree") {
      var sold = storedSold(item);
      var shelf = storedShelf(item);
      var net = C.leftoverCash(sold, shipping());
      if (
        sold != null &&
        net != null &&
        (shelf === 1.25 || shelf === 0.01) &&
        net > shelf
      ) {
        return "Watch";
      }
      return "Pass";
    }
    return C.itemFitness({
      fitness: item.fitness,
      rule: item.rule,
      sold: storedSold(item),
      shelf: storedShelf(item),
      shipping: shipping(),
    });
  }

  function fitRank(name) {
    if (name === "Strong") return 0;
    if (name === "Watch") return 1;
    return 2;
  }

  function sortStrongFirst(items) {
    return items.slice().sort(function (a, b) {
      var d = fitRank(fitnessFor(a)) - fitRank(fitnessFor(b));
      if (d) return d;
      return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
    });
  }

  function itemKind(item) {
    if (item._cat === "sneakers") return "shoe";
    if (item._cat === "streetwear") return "clothes";
    return "";
  }

  function sentimentLabel(raw) {
    var t = String(raw || "").toLowerCase();
    if (t === "up" || t.indexOf("up") === 0) return "up";
    if (t.indexOf("down") !== -1) return "down";
    if (t.indexOf("flat") !== -1) return "flat";
    return "unknown";
  }

  function checkHref(base, query) {
    return base + encodeURIComponent(query || "");
  }

  function checkLinksHtml(query) {
    return (
      '<section class="check-block"><p class="kicker">Check</p><div class="check">' +
      '<a href="' +
      escapeHtml(checkHref(CHECK.walmart, query)) +
      '" target="_blank" rel="noopener noreferrer">Walmart</a>' +
      '<a href="' +
      escapeHtml(checkHref(CHECK.target, query)) +
      '" target="_blank" rel="noopener noreferrer">Target</a>' +
      '<a href="' +
      escapeHtml(checkHref(CHECK.bestbuy, query)) +
      '" target="_blank" rel="noopener noreferrer">Best Buy</a>' +
      '<a href="' +
      escapeHtml(checkHref(CHECK.dollartree, query)) +
      '" target="_blank" rel="noopener noreferrer">Check Dollar Tree</a>' +
      '<a href="' +
      escapeHtml(checkHref(CHECK.goodwill, query)) +
      '" target="_blank" rel="noopener noreferrer">ShopGoodwill</a>' +
      '<a href="' +
      escapeHtml(checkHref(CHECK.google, query + " Goodwill")) +
      '" target="_blank" rel="noopener noreferrer">Google · Goodwill</a>' +
      '<a href="' +
      escapeHtml(checkHref(CHECK.google, query)) +
      '" target="_blank" rel="noopener noreferrer">Google</a>' +
      '<a href="' +
      escapeHtml(checkHref(CHECK.shopping, query)) +
      '" target="_blank" rel="noopener noreferrer">Google Shopping</a>' +
      '</div><p class="secondary">Local Goodwill pegs are usually not online.</p></section>'
    );
  }

  function retailText(item) {
    if (item.retailLabel) return item.retailLabel;
    if (item.id === "etb") return "Printed $49.99";
    if (item.id === "topps-s1") return "Often $24.99";
    if (item._cat === "cars" && item.shelfNum === 1) return "About $1";
    if (item._cat === "dollartree") {
      return "$1.25 as of 2026 unless a red dot or scan says otherwise";
    }
    if (item.shelfNum != null && /printed|about \$/i.test(item.shelf || "")) {
      return item.shelf;
    }
    return "Retail unknown";
  }

  function retailNum(item) {
    var typed = shelfMap()[item.id];
    if (typed != null && typed !== "") {
      var n = Number(typed);
      if (Number.isFinite(n)) return n;
    }
    if (item.id === "etb") return 49.99;
    if (item.id === "topps-s1") return 24.99;
    if (item._cat === "cars" && item.shelfNum === 1) return 1;
    if (item._cat === "dollartree") return 1.25;
    if (item.shelfNum != null && /printed|about \$/i.test(item.shelf || "")) {
      return item.shelfNum;
    }
    return null;
  }

  function resellText(item) {
    if (item.id === "topps-s1") {
      return "$13.20 to $16.80, September 7, 2026. Do not list above that.";
    }
    if (item.soldNum != null) {
      return (
        item.listPrice +
        (item.date && item.date !== "No sale date" ? ", " + item.date : "")
      );
    }
    return "none";
  }

  function leftoverListed(item) {
    var sold = storedSold(item);
    var retail = retailNum(item);
    var ship = shipping();
    var net = C.leftoverCash(sold, ship);
    if (net == null) return "Unknown";
    if (retail == null) {
      return (
        "$" +
        net.toFixed(2) +
        " after about 13% fees and shipping. Retail unknown."
      );
    }
    return (
      "$" +
      net.toFixed(2) +
      " after about 13% fees and shipping" +
      (net > retail ? " · beats retail" : " · does not beat retail")
    );
  }

  function priceLinesHtml(item) {
    return (
      '<section class="price-lines"><p><span class="kicker">Retail</span> ' +
      escapeHtml(retailText(item)) +
      "</p><p><span class=\"kicker\">Recommended resell</span> " +
      escapeHtml(resellText(item)) +
      "</p><p class=\"result\" id=\"left-out\">" +
      escapeHtml(leftoverListed(item)) +
      "</p></section>"
    );
  }

  function pullControlsHtml(query) {
    return (
      '<div class="actions">' +
      '<button type="button" data-refresh="item" data-query="' +
      escapeHtml(query) +
      '">Refresh</button>' +
      '<button type="button" data-pull-prices="' +
      escapeHtml(query) +
      '">Pull prices</button></div>' +
      '<p class="secondary" id="pull-status"></p>' +
      '<p class="secondary" id="refresh-time"></p>'
    );
  }

  function parseDollarTreePrice(data) {
    try {
      var rec = data.resultsList.records[0];
      var inner = rec.records && rec.records[0] ? rec.records[0] : rec;
      var attrs = inner.attributes || {};
      var raw = attrs["sku.activePrice"] || attrs["sku.listPrice"];
      var n = raw && raw[0] != null ? Number(raw[0]) : NaN;
      if (Number.isFinite(n)) return n;
    } catch (err) {}
    return null;
  }

  function pullLivePrices(query, statusEl, itemId) {
    if (!statusEl) return;
    statusEl.textContent = "Trying their site…";
    var when = stampRefresh(itemId);
    var timeEl = document.getElementById("refresh-time");
    if (timeEl) timeEl.textContent = "Checked " + when.slice(0, 16).replace("T", " ");
    var jsonBase =
      CHECK.dollartreeJson ||
      "https://www.dollartree.com/ccstoreui/v1/search?Ntt=";
    var url = checkHref(jsonBase, query);
    fetch(url, { mode: "cors", credentials: "omit" })
      .then(function (res) {
        if (!res.ok) throw new Error("blocked");
        var type = res.headers.get("content-type") || "";
        if (type.indexOf("json") === -1) throw new Error("no-json");
        return res.json();
      })
      .then(function (data) {
        var price = parseDollarTreePrice(data);
        if (price == null) {
          statusEl.textContent = "Could not read their site from here";
          return;
        }
        statusEl.textContent =
          "Could not match a sold for this item. Last checked number kept.";
      })
      .catch(function () {
        statusEl.textContent = "Could not read their site from here";
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

  function fitnessClass(name) {
    if (name === "Strong") return " is-strong";
    if (name === "Pass") return " is-pass";
    return " is-watch";
  }

  function storeItems(id) {
    var store = STORES[id];
    if (!store) return [];
    if (store.ids) {
      return store.ids
        .map(findItem)
        .filter(Boolean);
    }
    var list = [];
    (store.cats || []).forEach(function (cat) {
      list = list.concat(CATALOG[cat] || []);
    });
    return list;
  }

  function rowHtml(item) {
    var fit = fitnessFor(item);
    var mark = marksMap()[item.id];
    return (
      '<button class="row" type="button" data-item="' +
      escapeHtml(item.id) +
      '">' +
      '<img class="thumb" src="' +
      escapeHtml(item.photo) +
      '" alt="">' +
      '<span class="row-copy"><strong>' +
      escapeHtml(item.name) +
      "</strong><span class=\"price-line\">" +
      escapeHtml(item.listPrice) +
      "</span>" +
      (mark === "found" ? '<span class="found-mark">Found</span>' : "") +
      '<span class="tracked">' +
      escapeHtml(trackedLine(item)) +
      "</span></span>" +
      '<span class="verdict' +
      fitnessClass(fit) +
      '">' +
      escapeHtml(fit) +
      "</span>" +
      "</button>"
    );
  }

  function dateStatus(iso) {
    return iso < TODAY ? "Out" : "Upcoming";
  }

  function visitBlock() {
    var ids = visitIds();
    if (!ids.length) return "";
    var names = ids
      .map(findItem)
      .filter(Boolean)
      .map(function (item) {
        return escapeHtml(item.name);
      });
    if (!names.length) return "";
    return (
      '<div class="visit"><strong>This visit</strong><p>' +
      names.join(", ") +
      '</p><button class="save" type="button" id="visit-done">Done</button></div>'
    );
  }

  function renderHunt(query) {
    setTabs("hunt");
    var q = (query || "").trim();
    lastList = { type: q ? "search" : "home", q: q };
    if (q) {
      var hits = sortStrongFirst(
        allItems().filter(function (item) {
          return item.name.toLowerCase().indexOf(q.toLowerCase()) !== -1;
        })
      );
      screen.innerHTML =
        '<header class="header">' +
        '<button class="back" type="button" data-go="home">‹ Reseller</button>' +
        "<h1>Hunt</h1>" +
        '<button class="refresh" type="button" data-refresh="hunt" data-query="' +
        escapeHtml(q) +
        '">Refresh</button></header>' +
        '<main class="list">' +
        '<label class="search"><span>Search</span><input id="hunt-search" type="search" value="' +
        escapeHtml(q) +
        '" autocomplete="off"></label>' +
        pullControlsHtml(q) +
        (hits.length
          ? hits.map(rowHtml).join("")
          : '<div class="look"><p class="fitness is-pass">Pass</p><p>If it is not on this list, leave it.</p></div>') +
        "</main>";
      var input = document.getElementById("hunt-search");
      if (input) {
        input.focus();
        input.setSelectionRange(q.length, q.length);
      }
      return;
    }
    screen.innerHTML = homeHTML + visitBlock();
    var hunt = document.getElementById("hunt-search");
    if (hunt) hunt.value = "";
  }

  function renderStoresHub() {
    setTabs("stores");
    lastList = { type: "stores" };
    screen.innerHTML =
      '<header class="header"><h1>Stores</h1></header>' +
      '<main class="cats">' +
      '<button class="cat" type="button" data-store="walmart">Walmart <span class="chev">›</span></button>' +
      '<button class="cat" type="button" data-store="target">Target <span class="chev">›</span></button>' +
      '<button class="cat" type="button" data-store="goodwill">Goodwill <span class="chev">›</span></button>' +
      '<button class="cat" type="button" data-store="bestbuy">Best Buy <span class="chev">›</span></button>' +
      '<button class="cat" type="button" data-store="dollartree">Dollar Tree <span class="chev">›</span></button>' +
      "</main>";
  }

  function renderStore(id, from) {
    var store = STORES[id];
    if (!store) return;
    setTabs(from === "stores" ? "stores" : "hunt");
    lastList = { type: "store", id: id, from: from || "home" };
    var items = sortStrongFirst(storeItems(id));
    screen.innerHTML =
      '<header class="header">' +
      '<button class="back" type="button" data-go="' +
      (from === "stores" ? "stores" : "home") +
      '">‹ Back</button>' +
      "<h1>" +
      escapeHtml(store.name) +
      "</h1>" +
      '<form class="search store-head-search" data-store-search="' +
      escapeHtml(id) +
      '"><input id="store-q" type="search" placeholder="Search this store" enterkeyhint="search" autocomplete="off"></form>' +
      "</header>" +
      '<main class="list">' +
      '<div class="look"><p>' +
      escapeHtml(store.look) +
      "</p></div>" +
      items.map(rowHtml).join("") +
      "</main>";
  }

  function renderList(cat) {
    setTabs("hunt");
    lastList = { type: "cat", id: cat };
    var items = sortStrongFirst(CATALOG[cat] || []);
    screen.innerHTML =
      '<header class="header">' +
      '<button class="back" type="button" data-go="home">‹ Reseller</button>' +
      "<h1>" +
      escapeHtml(TITLES[cat] || cat) +
      "</h1></header>" +
      '<main class="list">' +
      (NOT_TRACKED[cat]
        ? '<div class="look"><p>' + escapeHtml(NOT_TRACKED[cat]) + "</p></div>"
        : "") +
      items.map(rowHtml).join("") +
      "</main>";
  }

  function sizeChips(item) {
    var kind = itemKind(item);
    if (!kind) return "";
    var sizes = kind === "shoe" ? SHOE_SIZES : CLOTHES_SIZES;
    var fast = kind === "shoe" ? FAST_SHOES : FAST_CLOTHES;
    var current = storedSize(item);
    var label =
      kind === "shoe"
        ? "US size. Men’s 8 to 12 fastest, 10 and 11 strongest. No size tag is a pass."
        : "Letter size. M, L, and XL fastest. No size tag is a pass.";
    return (
      '<p class="sizing">' +
      escapeHtml(item.sizing || label) +
      '</p><div class="chips">' +
      sizes
        .map(function (size) {
          return (
            '<button class="chip' +
            (current === size ? " is-on" : "") +
            (fast[size] ? " is-fast" : "") +
            '" type="button" data-size="' +
            escapeHtml(size) +
            '">' +
            escapeHtml(size) +
            "</button>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function buyBar(item) {
    var href = item.buyUrl;
    var label = item.buyLabel || "Buy";
    var buy = href
      ? '<a class="buy" href="' +
        escapeHtml(href) +
        '" target="_blank" rel="noopener noreferrer">' +
        escapeHtml(label) +
        "</a>"
      : '<button class="buy" type="button" data-no-buy="1">No purchase link yet</button>';
    return (
      '<div class="sticky"><button class="pass" type="button" data-go="back">Pass</button>' +
      buy +
      "</div>"
    );
  }

  function renderReview(id) {
    var item = findItem(id);
    if (!item) return;
    lastReviewId = id;
    var fit = fitnessFor(item);
    var shelf = storedShelf(item);
    var mark = marksMap()[id];
    screen.innerHTML =
      '<header class="header">' +
      '<button class="back" type="button" data-go="back">‹ Back</button>' +
      '<button class="refresh" type="button" data-refresh="item" data-query="' +
      escapeHtml(item.name) +
      '">Refresh</button>' +
      "</header>" +
      '<div class="hero"><img src="' +
      escapeHtml(item.photo) +
      '" alt="' +
      escapeHtml(item.name) +
      '"></div>' +
      '<div class="copy">' +
      "<h2>" +
      escapeHtml(item.name) +
      "</h2>" +
      '<p class="tracked">' +
      escapeHtml(trackedLine(item)) +
      "</p>" +
      (item.photoNote
        ? '<p class="photo-note">' + escapeHtml(item.photoNote) + "</p>"
        : "") +
      '<p class="fitness' +
      fitnessClass(fit) +
      '">Fitness: ' +
      escapeHtml(fit) +
      "</p>" +
      priceLinesHtml(item) +
      (item.checkedNote
        ? '<p class="secondary">' + escapeHtml(item.checkedNote) + "</p>"
        : "") +
      "<p>Sentiment: " +
      escapeHtml(sentimentLabel(item.sentiment)) +
      "</p>" +
      '<p class="digest">' +
      escapeHtml(item.digest) +
      "</p>" +
      sizeChips(item) +
      "<p>Look for: " +
      escapeHtml(item.shelf) +
      "</p>" +
      '<label class="field"><span>Type shelf</span><input id="shelf-in" type="number" inputmode="decimal" step="0.01" value="' +
      (shelf != null ? escapeHtml(String(shelf)) : "") +
      '"></label>' +
      pullControlsHtml(item.name) +
      '<div class="actions">' +
      '<button type="button" data-mark="found">' +
      (mark === "found" ? "Found ✓" : "Found") +
      "</button>" +
      '<button type="button" data-mark="left">Left it</button>' +
      '<button type="button" id="copy-notes">Copy notes</button>' +
      "</div>" +
      checkLinksHtml(item.name) +
      "</div>" +
      buyBar(item);
  }

  function renderDates() {
    setTabs("dates");
    lastList = { type: "dates" };
    var rows = DATES.slice().sort(function (a, b) {
      return a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0;
    });
    var html = "";
    var last = "";
    rows.forEach(function (item) {
      var status = dateStatus(item.iso);
      if (item.dateLabel !== last) {
        html +=
          '<p class="group-title">' +
          escapeHtml(item.dateLabel) +
          " · " +
          status +
          "</p>";
        last = item.dateLabel;
      }
      html +=
        '<button class="row" type="button" data-date="' +
        escapeHtml(item.id) +
        '">' +
        '<span class="row-copy"><span class="date-kicker">' +
        escapeHtml(item.dateLabel) +
        "</span><strong>" +
        escapeHtml(item.name) +
        '</strong><span class="price-line">' +
        escapeHtml(item.category) +
        "</span></span>" +
        '<span class="chev" aria-hidden="true">›</span>' +
        "</button>";
    });
    screen.innerHTML =
      '<header class="header"><h1>Dates</h1></header><main class="list">' +
      html +
      "</main>";
  }

  function findDate(id) {
    return DATES.filter(function (item) {
      return item.id === id;
    })[0];
  }

  function renderDateDetail(id) {
    var item = findDate(id);
    if (!item) return;
    setTabs("dates");
    var status = dateStatus(item.iso);
    var buy = item.buyUrl
      ? '<a class="buy-link" href="' +
        escapeHtml(item.buyUrl) +
        '" target="_blank" rel="noopener noreferrer">' +
        escapeHtml(item.buyLabel || "Buy") +
        "</a>"
      : '<p class="no-buy">No buy link yet. Use Check.</p>';
    screen.innerHTML =
      '<header class="header">' +
      '<button class="back" type="button" data-go="dates">‹ Dates</button>' +
      "</header>" +
      (item.photo
        ? '<div class="hero"><img src="' +
          escapeHtml(item.photo) +
          '" alt="' +
          escapeHtml(item.name) +
          '"></div>'
        : "") +
      '<div class="copy">' +
      "<h2>" +
      escapeHtml(item.name) +
      "</h2>" +
      (item.photoNote
        ? '<p class="photo-note">' + escapeHtml(item.photoNote) + "</p>"
        : "") +
      "<p>" +
      escapeHtml(item.dateLabel) +
      " · " +
      status +
      "</p>" +
      "<p>Category: " +
      escapeHtml(item.category) +
      "</p>" +
      "<p>Format: " +
      escapeHtml(item.format) +
      "</p>" +
      "<p>Printed or shelf: " +
      escapeHtml(item.printed) +
      "</p>" +
      "<p>" +
      escapeHtml(item.sold) +
      "</p>" +
      "<p>Sentiment: " +
      escapeHtml(sentimentLabel(item.sentiment)) +
      "</p>" +
      '<p class="digest">' +
      escapeHtml(item.digest) +
      "</p>" +
      '<p class="fitness' +
      fitnessClass(item.fitness) +
      '">Fitness: ' +
      escapeHtml(item.fitness) +
      "</p>" +
      checkLinksHtml(item.name) +
      buy +
      "</div>";
  }

  function money(n) {
    return "$" + n.toFixed(2);
  }

  function renderProfit() {
    setTabs("profit");
    var items = allItems();
    screen.innerHTML =
      '<header class="header"><h1>Profit</h1></header>' +
      '<main class="panel">' +
      '<p class="note">Shelf versus stored sold, about 13% fees, editable shipping, leftover cash. Not a live ticker.</p>' +
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
    itemEl.value = lastReviewId || (items[0] ? items[0].id : "");
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
      var net = C.leftoverCash(soldVal, shipVal);
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
      outEl.textContent = money(net) + " after about 13% fees and ship" + extra;
    }

    itemEl.addEventListener("change", fillItem);
    [shelfEl, soldEl, shipEl].forEach(function (el) {
      el.addEventListener("input", paint);
    });
    fillItem();
  }

  function renderBought() {
    setTabs("bought");
    var books = boughtList();
    var item = lastReviewId ? findItem(lastReviewId) : null;
    screen.innerHTML =
      '<header class="header"><h1>Bought</h1></header>' +
      '<main class="panel">' +
      '<label class="field"><span>Name</span><input id="book-name" type="text" autocomplete="off" value="' +
      (item ? escapeHtml(item.name) : "") +
      '"></label>' +
      '<label class="field"><span>Cost</span><input id="book-cost" type="number" inputmode="decimal" step="0.01"></label>' +
      '<label class="field"><span>Store</span><select id="book-store">' +
      '<option>Walmart</option><option>Target</option><option>Goodwill</option><option>Best Buy</option><option>Dollar Tree</option>' +
      "</select></label>" +
      '<label class="field"><span>Date</span><input id="book-date" type="date"></label>' +
      '<label class="field"><span>Size</span><input id="book-size" type="text" autocomplete="off" value="' +
      (item ? escapeHtml(storedSize(item)) : "") +
      '"></label>' +
      '<p class="note">Shoes need a US size. Clothes need a letter size. No size tag is a pass.</p>' +
      '<p class="gate hidden" id="size-gate">Add a size before you mark shoes or clothes bought.</p>' +
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
                escapeHtml(book.store || "") +
                " · " +
                escapeHtml(book.date) +
                (book.size ? " · " + escapeHtml(book.size) : "") +
                '</p><button type="button" data-del="' +
                escapeHtml(book.id) +
                '">Delete</button></div>'
              );
            })
            .join("")
        : '<p class="note">No buys yet.</p>') +
      "</div></main>";
    document.getElementById("book-date").value = new Date()
      .toISOString()
      .slice(0, 10);
  }

  function goBack() {
    if (lastList.type === "store") renderStore(lastList.id, lastList.from);
    else if (lastList.type === "cat") renderList(lastList.id);
    else if (lastList.type === "dates") renderDates();
    else if (lastList.type === "search") renderHunt(lastList.q);
    else if (lastList.type === "stores") renderStoresHub();
    else renderHunt();
  }

  function needsSize(name) {
    var item = allItems().filter(function (row) {
      return row.name === name;
    })[0];
    return item ? itemKind(item) : "";
  }

  function copyNotes(item) {
    var size = storedSize(item);
    var text = [
      item.name,
      size ? "Size: " + size : "",
      "Last checked price: " + item.checkedPrice,
      "Source: " + item.source,
      "Date: " + item.date,
      item.digest,
    ]
      .filter(Boolean)
      .join("\n");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
      return;
    }
    var area = document.createElement("textarea");
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    document.body.removeChild(area);
  }

  document.addEventListener("input", function (event) {
    if (event.target && event.target.id === "hunt-search") {
      renderHunt(event.target.value);
      return;
    }
    if (event.target && event.target.id === "shelf-in" && lastReviewId) {
      var item = findItem(lastReviewId);
      var val = event.target.value === "" ? null : Number(event.target.value);
      var shelves = shelfMap();
      if (val == null || !Number.isFinite(val)) delete shelves[item.id];
      else shelves[item.id] = val;
      writeJson(SHELF_KEY, shelves);
      var out = document.getElementById("left-out");
      if (out) out.textContent = leftoverListed(item);
    }
  });

  document.addEventListener("submit", function (event) {
    var form = event.target.closest("[data-store-search]");
    if (!form) return;
    event.preventDefault();
    var sid = form.getAttribute("data-store-search");
    var store = STORES[sid];
    if (!store) return;
    var q = document.getElementById("store-q");
    var query = q ? q.value : "";
    window.open(checkHref(store.search, query), "_blank", "noopener,noreferrer");
  });

  document.addEventListener("click", function (event) {
    var open = event.target.closest("[data-open]");
    if (open) {
      renderList(open.getAttribute("data-open"));
      return;
    }
    var storeBtn = event.target.closest("[data-store]");
    if (storeBtn) {
      var from = document.querySelector(".tabbar [data-tab].is-on");
      var tab = from ? from.getAttribute("data-tab") : "hunt";
      renderStore(storeBtn.getAttribute("data-store"), tab === "stores" ? "stores" : "home");
      return;
    }
    var storeSearch = event.target.closest("[data-store-search]");
    if (storeSearch && storeSearch.tagName !== "FORM") {
      var sid = storeSearch.getAttribute("data-store-search");
      var store = STORES[sid];
      var q = document.getElementById("store-q");
      var query = q ? q.value : "";
      window.open(checkHref(store.search, query), "_blank", "noopener,noreferrer");
      return;
    }
    var itemBtn = event.target.closest("[data-item]");
    if (itemBtn) {
      renderReview(itemBtn.getAttribute("data-item"));
      return;
    }
    var dateBtn = event.target.closest("[data-date]");
    if (dateBtn) {
      renderDateDetail(dateBtn.getAttribute("data-date"));
      return;
    }
    var sizeBtn = event.target.closest("[data-size]");
    if (sizeBtn && lastReviewId) {
      var sizes = sizeMap();
      sizes[lastReviewId] = sizeBtn.getAttribute("data-size");
      writeJson(SIZE_KEY, sizes);
      renderReview(lastReviewId);
      return;
    }
    var markBtn = event.target.closest("[data-mark]");
    if (markBtn && lastReviewId) {
      var marks = marksMap();
      var kind = markBtn.getAttribute("data-mark");
      marks[lastReviewId] = kind;
      writeJson(MARKS_KEY, marks);
      if (kind === "found") {
        var visit = visitIds();
        if (visit.indexOf(lastReviewId) === -1) visit.push(lastReviewId);
        writeJson(VISIT_KEY, visit);
      }
      renderReview(lastReviewId);
      return;
    }
    if (event.target.closest("#copy-notes") && lastReviewId) {
      copyNotes(findItem(lastReviewId));
      return;
    }
    if (event.target.closest("#visit-done")) {
      writeJson(VISIT_KEY, []);
      renderHunt();
      return;
    }
    var pullBtn = event.target.closest("[data-pull-prices]");
    if (pullBtn) {
      pullLivePrices(
        pullBtn.getAttribute("data-pull-prices") || "",
        document.getElementById("pull-status"),
        lastReviewId
      );
      return;
    }
    var refreshBtn = event.target.closest("[data-refresh]");
    if (refreshBtn) {
      var q = refreshBtn.getAttribute("data-query") || "";
      var status = document.getElementById("pull-status");
      if (!status) {
        status = document.createElement("p");
        status.id = "pull-status";
        status.className = "secondary";
        refreshBtn.parentNode.appendChild(status);
      }
      pullLivePrices(q, status, lastReviewId);
      return;
    }
    if (event.target.closest("[data-no-buy]")) {
      return;
    }
    var go = event.target.closest("[data-go]");
    if (go) {
      var dest = go.getAttribute("data-go");
      if (dest === "home") renderHunt();
      else if (dest === "dates") renderDates();
      else if (dest === "stores") renderStoresHub();
      else goBack();
      return;
    }
    var tab = event.target.closest("[data-tab]");
    if (tab) {
      var name = tab.getAttribute("data-tab");
      if (name === "hunt") renderHunt();
      if (name === "stores") renderStoresHub();
      if (name === "dates") renderDates();
      if (name === "profit") renderProfit();
      if (name === "bought") renderBought();
      return;
    }
    var save = event.target.closest("#book-save");
    if (save) {
      var nameEl = document.getElementById("book-name");
      var costEl = document.getElementById("book-cost");
      var dateEl = document.getElementById("book-date");
      var storeEl = document.getElementById("book-store");
      var sizeEl = document.getElementById("book-size");
      var name = (nameEl.value || "").trim();
      if (!name) return;
      var kind = needsSize(name);
      var size = (sizeEl.value || "").trim();
      if (kind && !size) {
        var gate = document.getElementById("size-gate");
        if (gate) gate.classList.remove("hidden");
        return;
      }
      var books = boughtList();
      books.unshift({
        id: String(Date.now()),
        name: name,
        cost: costEl.value || "0",
        store: storeEl.value || "",
        date: dateEl.value || new Date().toISOString().slice(0, 10),
        size: size,
      });
      writeJson(BOUGHT_KEY, books);
      renderBought();
      return;
    }
    var del = event.target.closest("[data-del]");
    if (del) {
      var books = boughtList().filter(function (book) {
        return book.id !== del.getAttribute("data-del");
      });
      writeJson(BOUGHT_KEY, books);
      renderBought();
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
