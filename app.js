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
        id: "nb-991",
        name: "New Balance 991",
        photo: "/photos/nb-990.jpg",
        photoNote: "Stand-in 990-family photo. Not the exact 991 colorway.",
        shelf: "Shelf varies by colorway",
        listPrice: "By colorway. No single sold.",
        checkedPrice: "By colorway. No single sold.",
        source: "No settled sale fetched",
        date: "No sale date",
        checkedNote: "No single sold.",
        sentiment: "unknown",
        digest:
          "New Balance 991. Watch if clean. Pass beaters.",
        fitness: "Watch",
        sizing: SHOE_SIZE,
      },
      {
        id: "nb-992",
        name: "New Balance 992",
        photo: "/photos/nb-990.jpg",
        photoNote: "Stand-in 990-family photo. Not the exact 992 colorway.",
        shelf: "Shelf varies by colorway",
        listPrice: "By colorway. No single sold.",
        checkedPrice: "By colorway. No single sold.",
        source: "No settled sale fetched",
        date: "No sale date",
        checkedNote: "No single sold.",
        sentiment: "unknown",
        digest:
          "New Balance 992. Watch if clean. Pass beaters.",
        fitness: "Watch",
        sizing: SHOE_SIZE,
      },
      {
        id: "nb-993",
        name: "New Balance 993",
        photo: "/photos/nb-990.jpg",
        photoNote: "Stand-in 990-family photo. Not the exact 993 colorway.",
        shelf: "Shelf varies by colorway",
        listPrice: "By colorway. No single sold.",
        checkedPrice: "By colorway. No single sold.",
        source: "No settled sale fetched",
        date: "No sale date",
        checkedNote: "No single sold.",
        sentiment: "unknown",
        digest:
          "New Balance 993. Watch if clean. Pass beaters.",
        fitness: "Watch",
        sizing: SHOE_SIZE,
      },
      {
        id: "nb-2002r",
        name: "New Balance 2002R",
        photo: "/photos/nb-550.jpg",
        photoNote: "Stand-in of this model family. Not the exact 2002R colorway.",
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
        id: "palace",
        name: "Palace",
        photo: "/photos/hoodie.jpg",
        photoNote: "Stand-in hoodie. Not a specific Palace drop.",
        shelf: "Only with a letter size tag",
        listPrice: "No settled sale",
        checkedPrice: "No settled sale",
        source: "No settled sale fetched",
        date: "No sale date",
        checkedNote: "Do not invent a sold.",
        sentiment: "unknown",
        digest:
          "Palace with a size tag. No invented sold. M, L, and XL move fastest. No tag is a pass.",
        fitness: "Watch",
        sizing: CLOTHES_SIZE,
      },
      {
        id: "stussy",
        name: "Stussy",
        photo: "/photos/hoodie.jpg",
        photoNote: "Stand-in hoodie. Not a specific Stussy drop.",
        shelf: "Only with a letter size tag",
        listPrice: "No settled sale",
        checkedPrice: "No settled sale",
        source: "No settled sale fetched",
        date: "No sale date",
        checkedNote: "Do not invent a sold.",
        sentiment: "unknown",
        digest:
          "Stussy with a size tag. No invented sold. No tag is a pass.",
        fitness: "Watch",
        sizing: CLOTHES_SIZE,
      },
      {
        id: "chrome-hearts",
        name: "Chrome Hearts",
        photo: "/photos/hoodie.jpg",
        photoNote: "Stand-in garment photo. Not a specific Chrome Hearts piece.",
        shelf: "Only with a letter size tag",
        listPrice: "No settled sale",
        checkedPrice: "No settled sale",
        source: "No settled sale fetched",
        date: "No sale date",
        checkedNote: "Do not invent a sold.",
        sentiment: "unknown",
        digest:
          "Chrome Hearts with a size tag. No invented sold. No tag is a pass.",
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
  var lastList = "cars";

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

  function fitnessFor(item) {
    return C.itemFitness({
      fitness: item.fitness,
      rule: item.rule,
      sold: storedSold(item),
      shelf: storedShelf(item),
      shipping: shipping(),
    });
  }

  function cashLine(item) {
    if (item.cashText) {
      return "Leftover cash: " + item.cashText;
    }
    var net = C.leftoverCash(storedSold(item), shipping());
    if (net == null) return "Unknown cash";
    return "Leftover cash: $" + net.toFixed(2) + " after about 13% fees, before extra shipping";
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

  function rowHtml(item) {
    var fit = fitnessFor(item);
    return (
      '<button class="row" type="button" data-item="' +
      escapeHtml(item.id) +
      '">' +
      '<img class="thumb" src="' +
      escapeHtml(item.photo) +
      '" alt="">' +
      '<span class="row-copy"><strong>' +
      escapeHtml(item.name) +
      "</strong><span class=" +
      '"price-line">' +
      escapeHtml(item.listPrice) +
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

  function renderDates() {
    setTabs("dates");
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
      : '<p class="no-buy">No buy link yet</p>';
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
      '<section class="checked">' +
      '<p class="kicker">Checked</p>' +
      "<p>Printed or shelf: " +
      escapeHtml(item.printed) +
      "</p>" +
      "<p>" +
      escapeHtml(item.sold) +
      "</p>" +
      "</section>" +
      "<p>Sentiment: " +
      escapeHtml(item.sentiment) +
      "</p>" +
      '<p class="digest">' +
      escapeHtml(item.digest) +
      "</p>" +
      (item.sizing
        ? '<p class="sizing">' + escapeHtml(item.sizing) + "</p>"
        : "") +
      '<p class="fitness' +
      fitnessClass(item.fitness) +
      '">' +
      escapeHtml(item.fitness) +
      "</p>" +
      buy +
      "</div>";
  }

  function renderHome() {
    setTabs("finds");
    screen.innerHTML = homeHTML;
  }

  function renderList(cat) {
    var items = CATALOG[cat] || [];
    var look = items.filter(function (item) {
      return item.worth;
    });
    var rest = items.filter(function (item) {
      return !item.worth;
    });
    screen.innerHTML =
      '<header class="header">' +
      '<button class="back" type="button" data-go="home">‹ Reseller</button>' +
      "<h1>" +
      escapeHtml(TITLES[cat]) +
      "</h1>" +
      "</header>" +
      '<main class="list">' +
      (look.length
        ? '<p class="group-title">Worth a look</p>' + look.map(rowHtml).join("")
        : "") +
      (rest.length
        ? '<p class="group-title">On the list</p>' + rest.map(rowHtml).join("")
        : "") +
      "</main>";
  }

  function renderReview(id) {
    var item = findItem(id);
    if (!item) return;
    var fit = fitnessFor(item);
    screen.innerHTML =
      '<header class="header">' +
      '<button class="back" type="button" data-go="back">‹ Back</button>' +
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
      (item.photoNote ? "<p class=\"photo-note\">" + escapeHtml(item.photoNote) + "</p>" : "") +
      '<section class="checked">' +
      '<p class="kicker">Checked</p>' +
      '<p class="price">' +
      escapeHtml(item.checkedPrice) +
      "</p>" +
      "<p>" +
      escapeHtml(item.source) +
      "</p>" +
      "<p>" +
      escapeHtml(item.date) +
      "</p>" +
      (item.checkedNote ? "<p>" + escapeHtml(item.checkedNote) + "</p>" : "") +
      "</section>" +
      "<p>Sentiment: " +
      escapeHtml(item.sentiment) +
      "</p>" +
      '<p class="digest">' +
      escapeHtml(item.digest) +
      "</p>" +
      '<p class="meta">Shelf: ' +
      escapeHtml(item.shelf) +
      "</p>" +
      '<p class="fitness' +
      fitnessClass(fit) +
      '">' +
      escapeHtml(fit) +
      "</p>" +
      "<p>" +
      escapeHtml(cashLine(item)) +
      "</p>" +
      (item.sizing ? '<p class="sizing">' + escapeHtml(item.sizing) + "</p>" : "") +
      "</div>";
  }

  function money(n) {
    return "$" + n.toFixed(2);
  }

  function renderCash() {
    setTabs("cash");
    var items = allItems();
    screen.innerHTML =
      '<header class="header"><h1>Cash</h1></header>' +
      '<main class="panel">' +
      '<p class="note">Shelf vs stored sold, minus about 13% fees and shipping. Not a live ticker.</p>' +
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
    itemEl.value = items[0] ? items[0].id : "";
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
        outEl.textContent = "Unknown cash";
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

  function renderBooks() {
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
    var dateBtn = event.target.closest("[data-date]");
    if (dateBtn) {
      renderDateDetail(dateBtn.getAttribute("data-date"));
      return;
    }
    var go = event.target.closest("[data-go]");
    if (go) {
      var dest = go.getAttribute("data-go");
      if (dest === "home") renderHome();
      else if (dest === "dates") renderDates();
      else renderList(lastList);
      return;
    }
    var tab = event.target.closest("[data-tab]");
    if (tab) {
      var name = tab.getAttribute("data-tab");
      if (name === "finds") renderHome();
      if (name === "dates") renderDates();
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
