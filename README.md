# Herbie

Create printable herbarium labels from a spreadsheet, right in your browser.

**Load table → map columns → check labels, edit data and localities → print.**

**Open the tool: https://christiang4.github.io/Herbie/**

![Screenshot](docs/screenshot.png)

## Features

- Reads `.xlsx`, `.xls`, `.ods` and `.csv`
- Detects columns automatically (English, German and Darwin Core names)
- Data editor with table, on/off switch per specimen and interactive map (OpenStreetMap, topographic, satellite): click to set a locality, drag the marker, search places
- Picks up coordinates written in the locality text (e.g. `Marburg, 50.8091, 8.8132`)
- Fetches elevation from a terrain model (Open-Meteo)
- Copies coordinates to all specimens with the same locality
- Label language: English, German, French, Spanish, Italian, Portuguese, Dutch, Swedish, Polish, Czech or Latin (field names, compass letters, elevation unit)
- Four label layouts (Classic, Table, Name first, Minimal), frame styles (or no frame), background colours and paper textures (paper, parchment, linen, leaves, dots, ruled, grid, hatch)
- Customisable labels: header, font, size, date format (incl. Roman month), coordinate format, visible fields
- Layout: A4 or US Letter, labels per page, margins, skip already used labels on a sheet
- Correct name formatting: genus and epithets in italics, authors upright
- Flags overfull labels in red
- Exports the table with the added coordinates as `.xlsx`
- Keeps your session in the browser so you can continue after reloading

## Privacy

Your table is processed locally and never uploaded. External requests are made only for:

| Purpose | Service | When |
|---|---|---|
| Excel library | cdn.sheetjs.com | on page load |
| Map tiles | OpenStreetMap, OpenTopoMap, Esri | when the map is shown |
| Place search | Nominatim (OpenStreetMap) | on click, with your search text |
| Elevation | Open-Meteo | on click, with the specimen's coordinates |

## Usage

1. **Load table**: drop your Excel file onto the page (or download the template, or try the example data)
2. **Columns**: check which column holds which information
3. **Labels**: pick the label language and layout. **View / edit data** (or a click on a label) opens the data editor, where you switch labels on or off, correct entries and set localities on the map. Then click **Print / PDF**

In the print dialog set margins to "None", scale to 100 % and turn off headers and footers.

### Table structure

You need at least a column for the species or the specimen number. All other fields are optional:

`Date`, `Specimen no`, `Scientific name`, `Common name`, `Family`, `Collector`, `Determiner`, `Notes`, `Locality`, `Habitat`, `Latitude`, `Longitude`, `Elevation`

German column names (`Art`, `Fundort`, `Belegsnummer`, ...) and Darwin Core terms are recognised as well.

Coordinates can be decimal (`50.8091`, `50,8091`) or degrees, minutes, seconds (`50°48'32.8" N`).
