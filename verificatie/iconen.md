# Verificatie weericoontjes (dunne bewolking)

Dagelijkse check van de icoonregel `forecastKind` (app.js, versie 20) tegen waarnemingen, 6 t/m 12 november 2026.
De taak `regen-iconen-check` vult dit bestand; per dag één sectie, onderaan een lopende stand.

**Wat er getoetst wordt**
- De grenzen `THIN_SUN` (nu 0,60 en 0,85): bij een (bijna) dichte lucht (modelbewolking ≥ 70%) het deel van de zon van een heldere hemel dat doorkomt. ≥ 0,85 half bewolkt, 0,60–0,85 dunne bewolking, < 0,60 bewolkt.
- De grenzen voor de bewolking zelf (30% en 70%).
- Of het icoon van een uur en van een dag (mediaan van de lichte uren) klopt met wat er werkelijk was.

**Waarnemingen**
- KNMI-uurgegevens Schiphol (station 240): N bewolking in achtsten (9 = hemel onzichtbaar), SQ zonneschijnduur in 0,1 uur, Q globale straling in J/cm² per uur. Komen met een paar dagen vertraging.
- Satellietstraling (Open-Meteo, EUMETSAT): globaal en direct, per uur, voor Schiphol.

**Waargenomen klasse per uur (afgesproken maat)**
- N ≤ 2: zonnig · N 3–5: half bewolkt
- N ≥ 6 en zon ≥ 0,60 van een heldere hemel (satelliet) en SQ ≥ 3: dunne bewolking
- N ≥ 6 anders: bewolkt
- Neerslag wordt hier niet getoetst.

---
