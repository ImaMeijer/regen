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

## 2026-11-03 (gecheckt op 2026-11-06)

Eerste dag waarvoor de KNMI-uurgegevens compleet waren (4 en 5 november nog leeg). HARMONIE via Open-Meteo (run van kort tevoren), ECMWF-ensemble 50 leden. Lichte uren: 8 t/m 16 u lokaal (zon in het midden van het uur boven de horizon).

| Uur (lokaal) | N | SQ | k_sat | k_knmi | Bewolking HARMONIE (glad) | k_model | Icoon HARMONIE | Icoon ECMWF | Waargenomen | ✓/✗ |
|---|---|---|---|---|---|---|---|---|---|---|
| 8 u | 8 | 0 | 0,55 | 0,52 | 76 (laag 75) | 0,20 | regen (0,1 mm; niet getoetst) | bewolkt | bewolkt | – |
| 9 u | 8 | 0 | 0,40 | 0,42 | 36 | 0,88 | half bewolkt | bewolkt | bewolkt | ✗ |
| 10 u | 8 | 0 | 0,35 | 0,31 | 44 | 0,82 | half bewolkt | bewolkt | bewolkt | ✗ |
| 11 u | 8 | 2 | 0,45 | 0,56 | 60 | 0,29 | half bewolkt | bewolkt | bewolkt | ✗ |
| 12 u | 8 | 1 | 0,38 | 0,45 | 25 | 0,92 | zonnig | bewolkt | bewolkt | ✗ |
| 13 u | 8 | 0 | 0,21 | 0,22 | 1 | 0,71 | zonnig | bewolkt | bewolkt | ✗ |
| 14 u | 8 | 0 | 0,23 | 0,32 | 8 | 0,77 | zonnig | bewolkt | bewolkt | ✗ |
| 15 u | 7 | 0 | 0,23 | 0,25 | 16 | 0,96 | zonnig | half bewolkt | bewolkt | ✗ |
| 16 u | 8 | 2 | 0,70 | 0,53 | 12 | – (zon 4°) | zonnig | half bewolkt | bewolkt | ✗ |

- Direct-fractie satelliet: 0,00–0,05 in elk uur, dus de hele dag geen directe zon. Bewolking ECMWF (gemiddelde van de leden): 90 % tot 13 u, 86 / 75 / 60 / 46 % daarna.
- **Dagicoon:** HARMONIE zonnig · ECMWF bewolkt · waargenomen bewolkt. ECMWF ✓, HARMONIE ✗.
- **Overeenstemming per uur:** HARMONIE 0 van 8 getoetste uren (0 %; het regenuur van 8 u niet geteld) · ECMWF 7 van 9 (78 %; de twee missers zijn de late uren 15 en 16 u, waarin het ensemble al opklaarde).
- **Bewolkingsklasse (30/70) los van de zon:** HARMONIE 8 van 9 uren verkeerd, ECMWF 2 van 9.
- **Gevoeligheid THIN_SUN:** geen enkel HARMONIE-uur met bewolking ≥ 70 % en zon > 6°, dus deze dag zegt niets over de grenzen. Voor ECMWF geeft elk paar uit {0,50…0,70} × {0,80…0,90} dezelfde 7 van 9: de leden met een dichte lucht hadden k 0,19–0,72 met mediaan 0,36–0,47, ruim onder elke ondergrens. Beste paar van de dag: n.v.t. (alle gelijk; huidige 0,60/0,85 scoort hetzelfde).
- **Wat opviel:** een dichte stratusdag (N = 8, k_sat 0,2–0,45, geen directe zon). HARMONIE liet het dek dat het 's nachts nog had vanaf 9 u oplossen en zag een zonnige middag (k_model 0,7–0,96); het ensemble hield de lucht dicht en had gelijk. Zo'n miss zit in de bewolking zelf, niet in de dunne-bewolkingsregel; de app zou de hele middag een zon hebben getoond.

## 2026-11-05 (gecheckt op 2026-11-07)

Laatste dag met complete KNMI-uurgegevens (6 november nog leeg; 4 november is wel compleet en kan bij een volgende check nog mee). HARMONIE via Open-Meteo (run van kort tevoren), ECMWF-ensemble 51 leden (controle + 50). Lichte uren: 8 t/m 16 u lokaal.

| Uur (lokaal) | N | SQ | k_sat | k_knmi | Bewolking HARMONIE (glad) | k_model | Icoon HARMONIE | Icoon ECMWF | Waargenomen | ✓/✗ |
|---|---|---|---|---|---|---|---|---|---|---|
| 8 u | 0 | 7 | 0,93 | 1,14 | 0 | – (zon 5°) | zonnig | zonnig | zonnig | ✓ |
| 9 u | 0 | 10 | 0,90 | 0,98 | 0 | 1,00 | zonnig | zonnig | zonnig | ✓ |
| 10 u | 0 | 10 | 0,99 | 0,94 | 0 | 1,01 | zonnig | zonnig | zonnig | ✓ |
| 11 u | 0 | 10 | 1,01 | 1,02 | 0 | 1,01 | zonnig | zonnig | zonnig | ✓ |
| 12 u | 0 | 10 | 1,00 | 1,02 | 0 | 1,03 | zonnig | zonnig | zonnig | ✓ |
| 13 u | 0 | 10 | 0,98 | 0,96 | 0 | 1,04 | zonnig | zonnig | zonnig | ✓ |
| 14 u | 0 | 10 | 0,91 | 1,00 | 0 | 1,02 | zonnig | zonnig | zonnig | ✓ |
| 15 u | 0 | 10 | 0,80 | 0,99 | 0 | 1,02 | zonnig | zonnig | zonnig | ✓ |
| 16 u | 0 | 5 | 1,01 | 1,26 | 0 | – (zon 4°) | zonnig | zonnig | zonnig | ✓ |

- Direct-fractie satelliet: 0,22–0,71 (midden van de dag ≈ 0,7), geen neerslag. Bewolking ECMWF (gemiddelde van de leden): 1–8 %, geen enkel lid met een dichte lucht.
- **Dagicoon:** HARMONIE zonnig · ECMWF zonnig · waargenomen zonnig. Beide ✓.
- **Overeenstemming per uur:** HARMONIE 9 van 9 (100 %) · ECMWF 9 van 9 (100 %).
- **Bewolkingsklasse (30/70) los van de zon:** HARMONIE 0 van 9 verkeerd, ECMWF 0 van 9.
- **Gevoeligheid THIN_SUN:** geen enkel uur met modelbewolking ≥ 70 %, dus alle paren scoren gelijk (HARMONIE 0/0, ECMWF 9/9). Beste paar van de dag: n.v.t.
- **Wat opviel:** een wolkenloze dag (N = 0 van zonsopkomst tot -ondergang), door beide modellen goed gezien. Bruikbaar als ijkpunt voor de maat zelf: bij een heldere hemel komt HARMONIE op k ≈ 1,00–1,04 van Haurwitz, de satelliet op 0,90–1,01 en Schiphol op 0,94–1,02 (bij zon onder ~6° schiet k_knmi door naar 1,1–1,3). Een heldere lucht zit dus ruim boven de bovengrens 0,85, en die grens ligt in het model op ≈ 83 % van de eigen heldere hemel.

## 2026-11-06 (gecheckt op 2026-11-09)

Laatste dag met complete KNMI-uurgegevens (7 en 8 november nog leeg; 4 november is nog steeds compleet en kan mee zodra er geen nieuwere dag is). HARMONIE via Open-Meteo (run van kort tevoren), ECMWF-ensemble 51 leden. Lichte uren: 8 t/m 16 u lokaal.

| Uur (lokaal) | N | SQ | k_sat | k_knmi | Bewolking HARMONIE (glad) | k_model | Icoon HARMONIE | Icoon ECMWF | Waargenomen | ✓/✗ |
|---|---|---|---|---|---|---|---|---|---|---|
| 8 u | 0 | 7 | 0,93 | 1,12 | 6 | – (zon 5°) | zonnig | zonnig | zonnig | ✓ |
| 9 u | 0 | 10 | 0,85 | 0,95 | 12 (hoog 24) | 0,98 | zonnig | zonnig | zonnig | ✓ |
| 10 u | 0 | 10 | 0,98 | 0,94 | 14 | 1,00 | zonnig | zonnig | zonnig | ✓ |
| 11 u | 0 | 10 | 1,02 | 1,00 | 17 (hoog 33) | 1,01 | zonnig | zonnig | zonnig | ✓ |
| 12 u | 0 | 10 | 1,00 | 1,00 | 24 | 1,03 | zonnig | half bewolkt | zonnig | ✓ (ECMWF ✗) |
| 13 u | 8 | 10 | 0,96 | 0,97 | 48 (hoog 64) | 0,92 | half bewolkt | half bewolkt | dunne bewolking | ✗ |
| 14 u | 3 | 10 | 0,92 | 1,05 | 72 (hoog 62) | 0,92 | half bewolkt | half bewolkt | half bewolkt | ✓ |
| 15 u | 0 | 10 | 0,80 | 0,95 | 77 (hoog 100) | 0,94 | half bewolkt | half bewolkt | zonnig | ✗ |
| 16 u | 0 | 2 | 1,14 | 0,51 | 48 (hoog 45) | – (zon 4°) | half bewolkt | zonnig | zonnig | ✗ (ECMWF ✓) |

- Direct-fractie satelliet: 0,22–0,73 (midden van de dag ≈ 0,7, 15 u 0,24), geen neerslag. Laag en midden in HARMONIE de hele dag 0 %: alles wat het model zag was hoge bewolking. Bewolking ECMWF (gemiddelde van de leden): 11–28 % tot 12 u, dan 51 / 63 / 55 / 36 / 25 %.
- **Dagicoon:** HARMONIE zonnig · ECMWF zonnig · waargenomen zonnig. Beide ✓.
- **Overeenstemming per uur:** HARMONIE 6 van 9 (67 %) · ECMWF 6 van 9 (67 %).
- **Bewolkingsklasse (30/70) los van de zon:** HARMONIE 4 van 9 uren verkeerd (13, 14, 15 en 16 u), ECMWF 3 van 9 (12, 13 en 14 u).
- **Gevoeligheid THIN_SUN:** twee HARMONIE-uren met bewolking ≥ 70 % en zon > 6° (14 en 15 u), allebei met k_model 0,92–0,94, dus boven elke bovengrens uit de reeks: elk paar geeft 1 van 2 (14 u goed, 15 u fout). Voor ECMWF ook alle paren gelijk (6 van 9). Beste paar van de dag: n.v.t. (alle gelijk; huidige 0,60/0,85 scoort hetzelfde).
- **Wat opviel:** een heldere ochtend met 's middags een cirrussluier. Om 13 u gaf de waarnemer N = 8 bij 10 minuten zon per 10 en k_sat 0,96: een sluier waar de zon volledig doorheen kwam, volgens de maat "dunne bewolking", terwijl beide modellen met 48–63 % bewolking op half bewolkt uitkwamen. Om 15 u zag HARMONIE 100 % hoge bewolking en de waarnemer 0 achtsten; de satelliet zat ertussenin (k_sat 0,80, direct 0,24). De regel zelf deed het goed: bij k_model ≥ 0,92 onder een dichte modelhemel is half bewolkt de beste gok, en om 14 u klopte dat ook. Ook deze dag bevestigt het ijkpunt: heldere lucht k_model 0,98–1,03, k_sat 0,85–1,02, k_knmi 0,94–1,00.

## 2026-11-04 (gecheckt op 2026-11-09)

Ingehaalde dag: 7 en 8 november zijn bij het KNMI nog leeg en 6 november stond al in het logboek, dus de oudste complete dag die nog ontbrak. HARMONIE via Open-Meteo (run van kort tevoren). **ECMWF-ensemble niet beschikbaar:** de ensemble-API bewaart het verleden maar tot 5 november (alles vóór die dag komt als leeg terug), dus deze dag alleen HARMONIE. Lichte uren: 8 t/m 16 u lokaal.

| Uur (lokaal) | N | SQ | k_sat | k_knmi | Bewolking HARMONIE (glad) | k_model | Icoon HARMONIE | Icoon ECMWF | Waargenomen | ✓/✗ |
|---|---|---|---|---|---|---|---|---|---|---|
| 8 u | 4 | 7 | 0,92 | 1,10 | 36 (hoog 36) | – (zon 6°) | half bewolkt | – | half bewolkt | ✓ |
| 9 u | 8 | 10 | 0,84 | 0,98 | 48 (hoog 46) | 0,77 | half bewolkt | – | dunne bewolking | ✗ |
| 10 u | 8 | 8 | 0,98 | 0,79 | 63 (hoog 62) | 0,91 | half bewolkt | – | dunne bewolking | ✗ |
| 11 u | 8 | 8 | 0,94 | 0,84 | 76 (hoog 75) | 0,80 | dunne bewolking | – | dunne bewolking | ✓ |
| 12 u | 8 | 3 | 0,73 | 0,59 | 78 (hoog 78) | 0,85 | half bewolkt | – | dunne bewolking | ✗ |
| 13 u | 8 | 10 | 0,94 | 0,89 | 70 (hoog 70) | 0,64 | dunne bewolking | – | dunne bewolking | ✓ |
| 14 u | 8 | 5 | 0,65 | 0,78 | 60 (laag 24, hoog 35) | 0,85 | half bewolkt | – | dunne bewolking | ✗ |
| 15 u | 3 | 7 | 0,60 | 0,66 | 54 (laag 49) | 0,48 | half bewolkt | – | half bewolkt | ✓ |
| 16 u | 0 | 3 | 1,01 | 0,86 | 24 (laag 24) | – (zon 4°) | zonnig | – | zonnig | ✓ |

- Direct-fractie satelliet: 0,56–0,62 in de uren 10–13 u (bijna zoveel als bij een heldere hemel), 0,20–0,31 in de randuren, 0,05 om 15 u. Geen neerslag, ook niet in het model. Midden in HARMONIE de hele dag 0 %; laag pas vanaf 14 u.
- **Dagicoon:** HARMONIE half bewolkt · ECMWF – · waargenomen dunne bewolking. HARMONIE ✗.
- **Overeenstemming per uur:** HARMONIE 5 van 9 (56 %) · ECMWF n.v.t.
- **Bewolkingsklasse (30/70) los van de zon:** HARMONIE 3 van 9 uren verkeerd (9, 10 en 14 u: 48–63 % waar de waarnemer 8 achtsten zag).
- **Gevoeligheid THIN_SUN:** drie HARMONIE-uren met bewolking ≥ 70 % en zon > 6° (11, 12 en 13 u), alle drie waargenomen als dunne bewolking, met k_model 0,80, 0,85 en 0,64. Huidige 0,60/0,85: 2 van 3 (12 u valt met precies 0,85 op half bewolkt). Bovengrens 0,80: 1 van 3; bovengrens 0,90: 3 van 3 bij ondergrens ≤ 0,60, 2 van 3 bij 0,65–0,70 (13 u met 0,64 valt dan op bewolkt). **Beste paar van de dag: 0,50–0,60 / 0,90 (3 van 3).** Voor het eerst een dag waarop de grenzen zelf meedoen.
- **Wat opviel:** een echte sluierdag. Van 9 tot 14 u gaf de waarnemer 8 achtsten bij 3–10 minuten zon per 10 en k_sat 0,65–0,98; de satelliet zag midden op de dag bijna evenveel directe zon als bij een heldere hemel. HARMONIE zag de sluier als alleen hoge bewolking (laag en midden 0 %), oplopend van 36 naar 78 % en weer terug, met k_model 0,64–0,91. Waar het model op ≥ 70 % zat, gaf de regel twee keer terecht dunne bewolking; om 12 u lag k_model met 0,85 precies op de bovengrens en werd het half bewolkt. De drie andere missers (9, 10 en 14 u) zitten in de bewolking zelf: een sluier van 48–63 % heet in de app half bewolkt, terwijl het voor de waarnemer een gesloten dunne lucht was. Dat is hetzelfde aandachtspunt als op 6 november, nu met drie uren meer.

## 2026-11-07 (gecheckt op 2026-11-10)

Laatste dag met complete KNMI-uurgegevens (8 en 9 november nog leeg). HARMONIE via Open-Meteo (run van kort tevoren), ECMWF-ensemble 51 leden. Lichte uren: 8 t/m 16 u lokaal.

| Uur (lokaal) | N | SQ | k_sat | k_knmi | Bewolking HARMONIE (glad) | k_model | Icoon HARMONIE | Icoon ECMWF | Waargenomen | ✓/✗ |
|---|---|---|---|---|---|---|---|---|---|---|
| 8 u | 8 | 0 | 1,07 | 0,65 | 88 (laag 53, hoog 67) | – (zon 5°) | bewolkt | bewolkt | bewolkt | ✓ |
| 9 u | 8 | 2 | 0,66 | 0,60 | 99 (laag 31, hoog 88) | 0,64 | dunne bewolking | dunne bewolking | bewolkt | ✗ |
| 10 u | 8 | 7 | 0,82 | 0,92 | 80 (hoog 80) | 0,66 | dunne bewolking | dunne bewolking | dunne bewolking | ✓ |
| 11 u | 8 | 8 | 0,93 | 0,78 | 56 (hoog 56) | 0,88 | half bewolkt | dunne bewolking | dunne bewolking | ✗ (ECMWF ✓) |
| 12 u | 8 | 2 | 0,64 | 0,47 | 54 (hoog 54) | 0,80 | half bewolkt | dunne bewolking | bewolkt | ✗ |
| 13 u | 8 | 5 | 0,60 | 0,70 | 50 (hoog 50) | 0,92 | half bewolkt | dunne bewolking | dunne bewolking | ✗ (ECMWF ✓) |
| 14 u | 8 | 5 | 0,51 | 0,65 | 53 (midden 6, hoog 50) | 0,87 | half bewolkt | dunne bewolking | bewolkt | ✗ |
| 15 u | 8 | 0 | 0,31 | 0,41 | 75 (midden 17, hoog 71) | 0,57 | bewolkt | dunne bewolking | bewolkt | ✓ (ECMWF ✗) |
| 16 u | 8 | 0 | 0,64 | 0,34 | 94 (midden 32, hoog 92) | – (zon 4°) | bewolkt | bewolkt | bewolkt | ✓ |

- Direct-fractie satelliet: 0,38–0,58 om 10 en 11 u, daarna 0,00–0,09 (8 u 0,44 bij een zon van 5°). Geen neerslag, ook niet in de modellen (geen enkel ensemblelid met ≥ 0,1 mm). Laag in HARMONIE alleen in de vroege ochtend (53 en 31 %), midden pas vanaf 14 u; van 10 tot 13 u zag het model alleen hoge bewolking. Bewolking ECMWF (gemiddelde van de leden): 85–91 % de hele dag, met k_model (mediaan van de leden) 0,65–0,78.
- **Dagicoon:** HARMONIE dunne bewolking · ECMWF dunne bewolking · waargenomen bewolkt. Beide ✗.
- **Overeenstemming per uur:** HARMONIE 4 van 9 (44 %) · ECMWF 5 van 9 (56 %).
- **Bewolkingsklasse (30/70) los van de zon:** HARMONIE 4 van 9 uren verkeerd (11, 12, 13 en 14 u: 50–56 % waar de waarnemer 8 achtsten zag), ECMWF 0 van 9.
- **Gevoeligheid THIN_SUN:** drie HARMONIE-uren met bewolking ≥ 70 % en zon > 6° (9, 10 en 15 u) met k_model 0,64, 0,66 en 0,57, waargenomen als bewolkt, dunne bewolking en bewolkt. Huidige 0,60/0,85: 2 van 3 (9 u valt met 0,64 op dunne bewolking, terwijl de waarnemer bij 2 minuten zon per 10 en k_sat 0,66 net geen dunne bewolking haalde). Ondergrens 0,65: 3 van 3; 0,70: 2 van 3 (10 u met 0,66 valt dan op bewolkt); 0,50–0,55: 1 van 3. De bovengrens doet deze dag niet mee (geen k_model boven 0,80 onder een dichte modelhemel). **Beste paar van de dag: 0,65 / 0,80–0,90 (3 van 3).** Voor ECMWF: ondergrens ≤ 0,65 geeft 5 van 9, ondergrens 0,70 geeft 7 van 9 (14 en 15 u, k_model 0,69 en 0,65, worden dan terecht bewolkt).
- **Wat opviel:** een dag met de hele dag 8 achtsten, maar een lucht die 's ochtends dun genoeg was voor 7–8 minuten zon per 10 (k_sat 0,82–0,93, direct-fractie tot 0,58) en 's middags dichter werd (SQ 2–5, k_sat 0,5–0,65, geen directe zon). Op de grens tussen dunne bewolking en bewolkt hingen vier uren (9, 12, 13 en 14 u; 13 u haalde met k_sat 0,603 nét dunne bewolking). HARMONIE zag van 11 tot 14 u een sluier van 50–56 % met k_model 0,80–0,92, dus half bewolkt, terwijl de waarnemer een gesloten lucht had: weer vier uren voor het aandachtspunt van 4 en 6 november, nu met een sluier die het model ook nog te dun inschatte (k_model 0,80–0,87 tegen k_sat 0,51–0,64 om 12 en 14 u). Het ensemble hield de lucht wel dicht (85–91 %), maar zat met k_model 0,65–0,78 steeds net boven 0,60 en gaf de hele dag dunne bewolking, ook in de drie middaguren die in werkelijkheid bewolkt waren.

## 2026-11-08 (gecheckt op 2026-11-11)

Laatste dag met complete KNMI-uurgegevens (9 en 10 november nog leeg). HARMONIE via Open-Meteo (run van kort tevoren), ECMWF-ensemble 51 leden. Lichte uren: 8 t/m 16 u lokaal. Extra opgehaald: neerslag Schiphol (RH): alleen sporen (< 0,05 mm) om 8 en 9 u, verder droog.

| Uur (lokaal) | N | SQ | k_sat | k_knmi | Bewolking HARMONIE (glad) | k_model | Icoon HARMONIE | Icoon ECMWF | Waargenomen | ✓/✗ |
|---|---|---|---|---|---|---|---|---|---|---|
| 8 u | 8 | 0 | 0,75 | 0,29 | 71 (laag 68) | – (zon 5°) | bewolkt | regen (40 van 51 leden) | bewolkt | ✓ (ECMWF –) |
| 9 u | 8 | 0 | 0,44 | 0,18 | 48 (laag 48) | 0,94 | half bewolkt | regen (40) | bewolkt | ✗ (ECMWF –) |
| 10 u | 8 | 2 | 0,25 | 0,43 | 75 (laag 72, midden 50) | 0,33 | bewolkt | regen (26) | bewolkt | ✓ (ECMWF –) |
| 11 u | 8 | 7 | 0,40 | 0,72 | 100 (laag 94) | 0,46 | bewolkt | regen (26) | bewolkt | ✓ (ECMWF –) |
| 12 u | 8 | 2 | 0,35 | 0,44 | 89 (laag 72) | 0,62 | dunne bewolking | regen (26) | bewolkt | ✗ (ECMWF –) |
| 13 u | 8 | 5 | 0,30 | 0,57 | 54 (laag 25, midden 28) | 0,84 | half bewolkt | bewolkt | bewolkt | ✗ (ECMWF ✓) |
| 14 u | 8 | 0 | 0,26 | 0,22 | 18 | 0,96 | zonnig | bewolkt | bewolkt | ✗ (ECMWF ✓) |
| 15 u | 8 | 0 | 0,23 | 0,25 | 29 (laag 28) | 0,77 | zonnig | bewolkt | bewolkt | ✗ (ECMWF ✓) |
| 16 u | 8 | 0 | 0,53 | 0,19 | 48 (laag 48) | – (zon 3°) | half bewolkt | bewolkt | bewolkt | ✗ (ECMWF ✓) |

- Direct-fractie satelliet: 0,00–0,13 de hele dag (15 u 0,27 bij een zon van 10°), dus vrijwel geen directe zon. Hoog in HARMONIE vrijwel 0 % (alleen 10 en 11 u 26–50 %): wat het model zag was lage bewolking. Bewolking ECMWF (gemiddelde van de leden): 58–68 % tot 11 u, daarna 80–91 %, met k_model (mediaan van de leden) 0,72–0,74 in de ochtend en 0,51–0,66 's middags. 24–40 van de 51 leden gaven tot 12 u ≥ 0,1 mm, terwijl Schiphol alleen sporen had.
- **Dagicoon:** HARMONIE half bewolkt · ECMWF regen · waargenomen bewolkt. Beide ✗ (ECMWF door de neerslag, die hier niet getoetst wordt maar in werkelijkheid niet viel).
- **Overeenstemming per uur:** HARMONIE 3 van 9 (33 %) · ECMWF 4 van 4 getoetste uren (100 %; de vijf regenuren 8–12 u niet geteld, zoals bij HARMONIE op 3 nov; telt men ze als fout, dan 4 van 9).
- **Bewolkingsklasse (30/70) los van de zon:** HARMONIE 5 van 9 uren verkeerd (9, 13, 14, 15 en 16 u: 18–54 % waar de waarnemer 8 achtsten zag), ECMWF 4 van 9 (8–11 u: 58–68 %).
- **Gevoeligheid THIN_SUN:** drie HARMONIE-uren met bewolking ≥ 70 % en zon > 6° (10, 11 en 12 u) met k_model 0,33, 0,46 en 0,62, alle drie waargenomen als bewolkt. Huidige 0,60/0,85: 2 van 3 (12 u valt met 0,62 op dunne bewolking onder een stratocumulusdek met k_sat 0,35). Ondergrens 0,65 of 0,70: 3 van 3; ≤ 0,60: 2 van 3. De bovengrens doet niet mee. **Beste paar van de dag: 0,65–0,70 / 0,80–0,90 (3 van 3).** Voor ECMWF scoren alle paren gelijk (4 van 4 getoetst).
- **Wat opviel:** een grauwe dag met de hele dag 8 achtsten lage bewolking (k_sat 0,23–0,44, geen directe zon); alleen om 11 u kwam er op Schiphol wat zon door (SQ 7, k_knmi 0,72), wat de satelliet (0,40) niet zag. HARMONIE liet het dek 's middags breken en gaf van 13 tot 16 u half bewolkt en zonnig met k_model 0,77–0,96: dezelfde fout als op 3 november, en weer niet in de dunne-bewolkingsregel maar in de bewolking zelf. Het ensemble hield de middag terecht dicht, maar zag de ochtend als regen. De dunne-bewolkingsregel ging één keer mis op een laag wolkendek (12 u, k_model 0,62): een sluier is dat niet, en de lagen (laag 72 %, hoog 0 %) hadden het verschil kunnen maken.

## 2026-11-09 (gecheckt op 2026-11-12)

Laatste dag met complete KNMI-uurgegevens (10 en 11 november nog leeg). HARMONIE via Open-Meteo (run van kort tevoren), ECMWF-ensemble 51 leden. Lichte uren: 8 t/m 16 u lokaal.

| Uur (lokaal) | N | SQ | k_sat | k_knmi | Bewolking HARMONIE (glad) | k_model | Icoon HARMONIE | Icoon ECMWF | Waargenomen | ✓/✗ |
|---|---|---|---|---|---|---|---|---|---|---|
| 8 u | 8 | 0 | 1,02 | 0,69 | 76 (laag 76) | – (zon 5°) | bewolkt | half bewolkt | bewolkt | ✓ (ECMWF ✗) |
| 9 u | 0 | 8 | 0,79 | 0,91 | 75 (laag 75) | 0,46 | bewolkt | half bewolkt | zonnig | ✗ |
| 10 u | 2 | 10 | 0,94 | 0,93 | 25 | 0,98 | zonnig | zonnig | zonnig | ✓ |
| 11 u | 0 | 10 | 0,98 | 0,89 | 21 | 0,99 | zonnig | zonnig | zonnig | ✓ |
| 12 u | 0 | 10 | 0,99 | 0,99 | 42 (laag 42) | 0,94 | half bewolkt | zonnig | zonnig | ✗ (ECMWF ✓) |
| 13 u | 0 | 10 | 0,98 | 0,93 | 21 | 0,99 | zonnig | zonnig | zonnig | ✓ |
| 14 u | 0 | 10 | 0,89 | 0,89 | 0 | 0,99 | zonnig | zonnig | zonnig | ✓ |
| 15 u | 0 | 10 | 0,74 | 0,85 | 0 | 0,98 | zonnig | zonnig | zonnig | ✓ |
| 16 u | 0 | 3 | 0,90 | 1,01 | 0 | – (zon 3°) | zonnig | zonnig | zonnig | ✓ |

- Direct-fractie satelliet: 0,25–0,34 in de randuren, 0,55–0,71 van 10 tot 13 u, 0,18 om 15 u. Geen neerslag, ook niet in de modellen (hooguit één lid met ≥ 0,1 mm). Midden en hoog in HARMONIE de hele dag 0 %: alles wat het model zag was lage bewolking. Bewolking ECMWF (gemiddelde van de leden): 49 % om 8 u, 36 % om 9 u, daarna 26 % aflopend naar 5 %.
- **Dagicoon:** HARMONIE zonnig · ECMWF zonnig · waargenomen zonnig. Beide ✓.
- **Overeenstemming per uur:** HARMONIE 7 van 9 (78 %) · ECMWF 7 van 9 (78 %).
- **Bewolkingsklasse (30/70) los van de zon:** HARMONIE 2 van 9 uren verkeerd (9 en 12 u), ECMWF 2 van 9 (8 en 9 u).
- **Gevoeligheid THIN_SUN:** één HARMONIE-uur met bewolking ≥ 70 % en zon > 6° (9 u, k_model 0,46, waargenomen zonnig): elk paar geeft 0 van 1, want de fout zit in de bewolking. Voor ECMWF scoren alle paren gelijk (7 van 9). Beste paar van de dag: n.v.t. (alle gelijk; huidige 0,60/0,85 scoort hetzelfde).
- **Wat opviel:** een nacht en vroege ochtend met een laag wolkendek (N = 8 tot 8 u UT), dat tussen 8 en 9 u lokaal openbrak, waarna het tot zonsondergang wolkenloos bleef. HARMONIE hield het lage dek een uur te lang vast (75 % laag om 9 u, k_model 0,46, terwijl de waarnemer 0 achtsten en 8 minuten zon per 10 had) en zag om 12 u nog 42 % lage bewolking die er niet was. Het ensemble had het opbreken iets eerder en gaf 8 en 9 u half bewolkt, de ene keer te licht en de andere te donker. Voor de dunne-bewolkingsregel zegt deze dag niets; het ijkpunt heldere hemel klopt weer (k_model 0,94–0,99, k_sat 0,89–0,99, k_knmi 0,89–0,99 rond het middaguur).

## 2026-11-10 (gecheckt op 2026-11-13)

Laatste dag met complete KNMI-uurgegevens (11 en 12 november nog leeg). HARMONIE via Open-Meteo (run van kort tevoren), ECMWF-ensemble 51 leden. Lichte uren: 8 t/m 16 u lokaal. Alle vier de bronnen kwamen in één keer binnen.

| Uur (lokaal) | N | SQ | k_sat | k_knmi | Bewolking HARMONIE (glad) | k_model | Icoon HARMONIE | Icoon ECMWF | Waargenomen | ✓/✗ |
|---|---|---|---|---|---|---|---|---|---|---|
| 8 u | 0 | 5 | 1,08 | 1,48 | 0 | – (zon 4°) | zonnig | bewolkt | zonnig | ✓ (ECMWF ✗) |
| 9 u | 1 | 10 | 0,88 | 1,02 | 14 (hoog 14) | 1,02 | zonnig | bewolkt | zonnig | ✓ (ECMWF ✗) |
| 10 u | 7 | 9 | 0,95 | 0,83 | 51 (hoog 51) | 0,95 | half bewolkt | bewolkt | dunne bewolking | ✗ |
| 11 u | 8 | 10 | 0,96 | 0,87 | 84 (hoog 84) | 1,00 | half bewolkt | bewolkt | dunne bewolking | ✗ |
| 12 u | 8 | 10 | 1,00 | 0,90 | 75 (hoog 75) | 0,97 | half bewolkt | dunne bewolking | dunne bewolking | ✗ (ECMWF ✓) |
| 13 u | 1 | 10 | 1,01 | 0,91 | 35 (hoog 35) | 1,00 | half bewolkt | dunne bewolking | zonnig | ✗ |
| 14 u | 5 | 10 | 0,95 | 0,84 | 11 (hoog 11) | 1,01 | zonnig | dunne bewolking | half bewolkt | ✗ |
| 15 u | 1 | 10 | 0,86 | 0,78 | 28 (hoog 28) | 1,03 | zonnig | half bewolkt | zonnig | ✓ (ECMWF ✗) |
| 16 u | 8 | 3 | 1,23 | 0,75 | 72 (hoog 72) | – (zon 3°) | dunne bewolking (lagenregel) | half bewolkt | dunne bewolking | ✓ (ECMWF ✗) |

- Direct-fractie satelliet: 0,34–0,41 in de randuren, 0,54–0,72 van 10 tot 14 u (zoals bij een heldere hemel). Geen neerslag, ook niet in de modellen (geen enkel lid met ≥ 0,1 mm). Laag en midden in HARMONIE de hele dag 0 %: alles wat het model zag was hoge bewolking. Bewolking ECMWF (gemiddelde van de leden): 94–98 % tot 11 u, daarna 87 / 79 / 68 / 58 / 56 %, met k_model (mediaan van de leden) 0,57–0,60 tot 11 u, oplopend naar 0,84 om 15 u.
- **Dagicoon:** HARMONIE half bewolkt · ECMWF dunne bewolking · waargenomen half bewolkt (vier uren zonnig, één half bewolkt, vier dunne bewolking). HARMONIE ✓, ECMWF ✗.
- **Overeenstemming per uur:** HARMONIE 4 van 9 (44 %) · ECMWF 1 van 9 (11 %).
- **Bewolkingsklasse (30/70) los van de zon:** HARMONIE 3 van 9 uren verkeerd (10 u: 51 % bij 7 achtsten; 13 u: 35 % bij 1 achtste; 14 u: 11 % bij 5 achtsten), ECMWF 5 van 9 (8, 9 en 13 u dicht bij 0–1 achtsten; 14 en 15 u).
- **Gevoeligheid THIN_SUN:** twee HARMONIE-uren met bewolking ≥ 70 % en zon > 6° (11 en 12 u), allebei waargenomen als dunne bewolking, met k_model 1,00 en 0,97: boven elke bovengrens uit de reeks, dus elk paar geeft 0 van 2 (half bewolkt). Beste paar van de dag voor HARMONIE: n.v.t. (alle gelijk; huidige 0,60/0,85 scoort hetzelfde). Voor ECMWF verschillen de paren deze dag wel: ondergrens 0,50–0,55 geeft 3 van 9 (4 van 9 met bovengrens 0,80), ondergrens 0,60–0,65 geeft 1 van 9 (2 van 9 met bovengrens 0,80), ondergrens 0,70 geeft 0 van 9 (1 van 9 met bovengrens 0,80). Dat past bij 10 en 11 u, waar de mediaan van de leden op k 0,58–0,60 zat onder een sluier die in werkelijkheid dun was.
- **Wat opviel:** een zonnige dag met een cirrussluier: de satelliet en Schiphol maten de hele dag vrijwel de volle zon (k_sat 0,86–1,01, SQ 9–10), terwijl de waarnemer van 10 tot 12 u en om 16 u 7–8 achtsten gaf. HARMONIE zag die sluier ook als alleen hoge bewolking (tot 84 %), maar zo dun dat de straling niet zakte (k_model 0,95–1,03, gelijk aan een heldere hemel). Daardoor valt de dunne-bewolkingsregel hier buiten beeld: onder een dichte modelhemel met k ≥ 0,85 kiest de app half bewolkt, en geen enkele bovengrens uit de reeks had dat veranderd. Alleen om 16 u, toen de zon te laag stond, gaf de lagenregel (laag en midden < 30, hoog ≥ 70) terecht dunne bewolking. Het ensemble zag de sluier veel te dik (94–98 % met k 0,57–0,60 in de ochtend) en gaf bewolkt op uren met 0–1 achtsten en volle zon. Opmerkelijk naast de vaste test in app.js ("di 10 nov 13 u": bewolking 95, zon 0,77 → dunne bewolking): de verwachting van vooraf zag om 13 u een dichte dunne lucht, de run van kort tevoren 35 % en de waarnemer 1 achtste.

## 2026-11-11 (gecheckt op 2026-11-14)

Laatste dag met complete KNMI-uurgegevens (12 en 13 november nog leeg). HARMONIE via Open-Meteo (run van kort tevoren), ECMWF-ensemble 51 leden. Lichte uren: 8 t/m 16 u lokaal. Alle vier de bronnen kwamen in één keer binnen. Het script is eerst op 10 november nagelopen en gaf daar dezelfde tabel en tallies als in het logboek.

| Uur (lokaal) | N | SQ | k_sat | k_knmi | Bewolking HARMONIE (glad) | k_model | Icoon HARMONIE | Icoon ECMWF | Waargenomen | ✓/✗ |
|---|---|---|---|---|---|---|---|---|---|---|
| 8 u | 8 | 0 | 0,73 | 0,40 | 100 (laag 27, midden 100, hoog 100) | – (zon < 6°) | bewolkt | bewolkt | bewolkt | ✓ |
| 9 u | 8 | 0 | 0,39 | 0,26 | 100 (laag 49, midden 75, hoog 100) | 0,22 | bewolkt | bewolkt | bewolkt | ✓ |
| 10 u | 8 | 0 | 0,43 | 0,30 | 100 (laag 48, midden 51, hoog 100) | 0,89 | half bewolkt | bewolkt | bewolkt | ✗ (ECMWF ✓) |
| 11 u | 8 | 0 | 0,51 | 0,28 | 100 (laag 49, midden 75, hoog 100) | 0,36 | bewolkt | bewolkt | bewolkt | ✓ |
| 12 u | 8 | 0 | 0,53 | 0,29 | 100 (laag 27, midden 75, hoog 100) | 0,43 | bewolkt | bewolkt | bewolkt | ✓ |
| 13 u | 8 | 0 | 0,44 | 0,33 | 100 (laag 2, midden 38, hoog 100) | 0,63 | dunne bewolking | bewolkt | bewolkt | ✗ (ECMWF ✓) |
| 14 u | 8 | 0 | 0,22 | 0,35 | 99 (midden 27, hoog 99) | 0,55 | bewolkt | bewolkt | bewolkt | ✓ |
| 15 u | 8 | 0 | 0,34 | 0,35 | 98 (midden 20, hoog 98) | 0,87 | half bewolkt | bewolkt | bewolkt | ✗ (ECMWF ✓) |
| 16 u | 8 | 0 | 1,04 | 0,27 | 99 (midden 30, hoog 99) | – (zon < 6°) | bewolkt | bewolkt | bewolkt | ✓ |

- Direct-fractie satelliet: 0,00–0,05 de hele dag (16 u 0,21 bij een lage zon), dus geen directe zon; Schiphol mat geen minuut zonneschijn en k_knmi 0,26–0,40. Geen neerslag op Schiphol en niet in HARMONIE; in het ensemble twee leden met ≥ 0,1 mm tot 12 u. Bewolking ECMWF (gemiddelde van de leden): 97–100 % de hele dag, met k_model (mediaan van de leden) 0,47–0,51 tot 12 u en 0,55–0,59 van 13 tot 15 u.
- **Dagicoon:** HARMONIE bewolkt · ECMWF bewolkt · waargenomen bewolkt. Beide ✓.
- **Overeenstemming per uur:** HARMONIE 6 van 9 (67 %) · ECMWF 9 van 9 (100 %).
- **Bewolkingsklasse (30/70) los van de zon:** HARMONIE 0 van 9 uren verkeerd, ECMWF 0 van 9.
- **Gevoeligheid THIN_SUN:** zeven HARMONIE-uren met bewolking ≥ 70 % en zon > 6° (9 t/m 15 u), alle zeven waargenomen als bewolkt, met k_model 0,22, 0,89, 0,36, 0,43, 0,63, 0,55 en 0,87. Huidige 0,60/0,85: 4 van 7 (13 u valt met 0,63 op dunne bewolking; 10 en 15 u met 0,89 en 0,87 op half bewolkt). Ondergrens 0,65 of 0,70: 5 van 7 (13 u wordt terecht bewolkt); 0,55: 4 van 7; 0,50: 3 van 7 (14 u met 0,55 wordt dan dunne bewolking). De bovengrens verandert de score niet: 10 en 15 u zijn bij 0,80 en 0,85 half bewolkt en bij 0,90 dunne bewolking, beide fout, al zit 0,90 er één klasse dichterbij. **Beste paar van de dag: 0,65–0,70 / 0,80–0,90 (5 van 7).** Voor ECMWF: ondergrens ≥ 0,60 geeft 9 van 9, 0,55 geeft 6 van 9 en 0,50 geeft 5 van 9 (de middaguren met mediaan 0,51–0,59 worden dan dunne bewolking); de bovengrens doet niet mee.
- **Wat opviel:** een dichte, donkere dag: 8 achtsten van zonsopkomst tot -ondergang, nul zonneschijn, k_sat 0,22–0,53. Beide modellen hadden de lucht dicht (97–100 %), dus voor het eerst een dag waarop alleen de zonregel het verschil maakte, en met zeven uren de helft zoveel THIN_SUN-uren als alle eerdere dagen samen. HARMONIE zag een dik pakket hoge en middelbare bewolking, maar de straling in het model sprong per uur (k_model 0,22 → 0,89 → 0,36 in drie opeenvolgende uren, en 0,55 → 0,87 om 14 en 15 u), terwijl de satelliet en Schiphol de hele dag vlak en laag bleven. Die twee pieken gaven half bewolkt op een dag zonder zon; geen grens uit de reeks vangt dat, het zit in de straling van het model zelf. Het ensemble, met de mediaan over 51 leden, bleef rustig op 0,47–0,59 en had alle negen uren goed, maar zit 's middags wel dicht onder de ondergrens: bij 0,55 was de middag dunne bewolking geworden.

## 2026-11-12 (gecheckt op 2026-11-15)

Laatste dag met complete KNMI-uurgegevens (13 en 14 november nog leeg). HARMONIE via Open-Meteo (run van kort tevoren), ECMWF-ensemble 51 leden. Lichte uren: 8 t/m 16 u lokaal. Alle vier de bronnen kwamen in één keer binnen; hetzelfde script als op 14 november. Extra opgehaald: neerslag Schiphol (RH): 0,3 mm om 9 u en 0,2 mm om 10 u, sporen (< 0,05 mm) om 8, 11, 15 en 16 u.

| Uur (lokaal) | N | SQ | k_sat | k_knmi | Bewolking HARMONIE (glad) | k_model | Icoon HARMONIE | Icoon ECMWF | Waargenomen | ✓/✗ |
|---|---|---|---|---|---|---|---|---|---|---|
| 8 u | 7 | 3 | 1,08 | 0,97 | 31 (laag 31) | – (zon < 6°) | half bewolkt | regen (50 van 51 leden) | dunne bewolking | ✗ (ECMWF –) |
| 9 u | 8 | 7 | 0,46 | 0,72 | 13 (laag 13) | 0,85 | zonnig | regen (50) | bewolkt | ✗ (ECMWF –) |
| 10 u | 7 | 1 | 0,47 | 0,37 | 7 (laag 7) | 0,82 | zonnig | regen (43) | bewolkt | ✗ (ECMWF –) |
| 11 u | 8 | 3 | 0,45 | 0,55 | 4 | 0,69 | zonnig | regen (43) | bewolkt | ✗ (ECMWF –) |
| 12 u | 3 | 7 | 0,86 | 0,71 | 4 | 1,01 | zonnig | regen (43) | half bewolkt | ✗ (ECMWF –) |
| 13 u | 0 | 10 | 1,01 | 1,00 | 2 | 1,02 | zonnig | zonnig | zonnig | ✓ |
| 14 u | 5 | 10 | 0,88 | 0,98 | 0 | 1,02 | zonnig | zonnig | half bewolkt | ✗ |
| 15 u | 4 | 8 | 0,37 | 0,86 | 0 | 1,06 | zonnig | zonnig | half bewolkt | ✗ |
| 16 u | 8 | 2 | 1,16 | 1,21 | 0 | – (zon < 6°) | zonnig | half bewolkt | bewolkt | ✗ |

- Direct-fractie satelliet: 0,01–0,34 tot 11 u, 0,51–0,72 van 12 tot 14 u, 0,24 om 15 u. HARMONIE had geen neerslag en alleen wat lage bewolking in de vroege ochtend (31 → 4 %), midden en hoog 0 %. Bewolking ECMWF (gemiddelde van de leden): 91 / 81 / 69 / 56 / 43 % van 8 tot 12 u, daarna 33 / 27 / 25 / 25 %, met k_model (mediaan van de leden) 0,48–0,63 tot 11 u, oplopend naar 0,95 om 15 u. 43–50 van de 51 leden gaven tot 12 u ≥ 0,1 mm.
- **Dagicoon:** HARMONIE zonnig · ECMWF regen · waargenomen dunne bewolking (één uur zonnig, drie half bewolkt, één dunne bewolking, vier bewolkt; de mediaan valt op de rang ertussen). Beide ✗.
- **Overeenstemming per uur:** HARMONIE 1 van 9 (11 %) · ECMWF 1 van 4 getoetste uren (25 %; de vijf regenuren 8–12 u niet geteld; als fout geteld 1 van 9).
- **Bewolkingsklasse (30/70) los van de zon:** HARMONIE 8 van 9 uren verkeerd (alles behalve 13 u: 0–31 % waar de waarnemer 3–8 achtsten zag), ECMWF 6 van 9 (10 en 11 u: 56–69 % bij 7–8 achtsten; 13 u: 33 % bij 0 achtsten; 14, 15 en 16 u: 25–27 % bij 4–8 achtsten).
- **Gevoeligheid THIN_SUN:** geen enkel HARMONIE-uur met bewolking ≥ 70 %, dus deze dag zegt niets over de grenzen. Voor ECMWF scoren alle paren gelijk (1 van 4 getoetst). Beste paar van de dag: n.v.t. (alle gelijk; huidige 0,60/0,85 scoort hetzelfde).
- **Wat opviel:** een natte, grijze ochtend (7–8 achtsten, k_sat 0,45–0,47, 0,5 mm regen tussen 9 en 11 u) die rond het middaguur openbrak, met 's middags 3–5 achtsten en om 16 u weer 8. HARMONIE miste de ochtend volledig: 4–13 % bewolking, geen neerslag en k_model 0,69–0,85 op uren dat het regende. Dat is de slechtste HARMONIE-dag van de reeks (1 van 9), en net als op 3 en 8 november zit de fout in de bewolking zelf; de app had de hele dag een zon getoond. Het ensemble had de ochtend wel dicht en nat (43–50 leden met regen, terecht om 9 en 10 u, te lang doorgetrokken tot 12 u) en zag 's middags te weinig bewolking. Om 15 u lopen satelliet (k_sat 0,37) en Schiphol (k_knmi 0,86, 8 minuten zon per 10) ver uiteen: losse wolken boven het station. Het ijkpunt klopt weer om 13 u (k_model 1,02, k_sat 1,01, k_knmi 1,00).

## 2026-11-13 (gecheckt op 2026-11-16)

Laatste dag met complete KNMI-uurgegevens (14 en 15 november nog leeg). HARMONIE via Open-Meteo (run van kort tevoren), ECMWF-ensemble 51 leden. Lichte uren: 8 t/m 16 u lokaal. Alle vier de bronnen kwamen in één keer binnen; hetzelfde script als op 14 en 15 november. Extra opgehaald: neerslag Schiphol (RH): overdag alleen sporen (< 0,05 mm) van 9 tot 15 u, geen meetbare neerslag.

| Uur (lokaal) | N | SQ | k_sat | k_knmi | Bewolking HARMONIE (glad) | k_model | Icoon HARMONIE | Icoon ECMWF | Waargenomen | ✓/✗ |
|---|---|---|---|---|---|---|---|---|---|---|
| 8 u | 2 | 5 | 1,21 | 1,35 | 75 (laag 75) | – (zon < 6°) | bewolkt | bewolkt (25 van 51 leden regen) | zonnig | ✗ |
| 9 u | 8 | 8 | 0,69 | 1,03 | 78 (laag 77) | 0,33 | bewolkt | bewolkt (25 regen) | dunne bewolking | ✗ |
| 10 u | 7 | 7 | 0,88 | 0,83 | 31 (laag 30) | 0,46 | half bewolkt | regen (42) | dunne bewolking | ✗ (ECMWF –) |
| 11 u | 7 | 10 | 0,75 | 0,85 | 18 (laag 14) | 1,02 | zonnig | regen (42) | dunne bewolking | ✗ (ECMWF –) |
| 12 u | 0 | 10 | 0,94 | 0,91 | 32 (laag 24, midden 14) | 0,92 | half bewolkt | regen (42) | zonnig | ✗ (ECMWF –) |
| 13 u | 3 | 8 | 0,95 | 0,85 | 20 (laag 14) | 0,76 | zonnig | regen (50) | half bewolkt | ✗ (ECMWF –) |
| 14 u | 6 | 5 | 0,65 | 0,80 | 28 (laag 27) | 0,93 | zonnig | regen (50) | dunne bewolking | ✗ (ECMWF –) |
| 15 u | 4 | 3 | 0,32 | 0,54 | 56 (laag 55) | 0,34 | half bewolkt | regen (50) | half bewolkt | ✓ (ECMWF –) |
| 16 u | 2 | 2 | 1,27 | 1,18 | 44 (laag 42) | – (zon < 6°) | half bewolkt | regen (49) | zonnig | ✗ (ECMWF –) |

- Direct-fractie satelliet: 0,33–0,62 de hele dag (hoogst om 12 en 13 u), alleen om 14 u 0,16. HARMONIE had geen neerslag en alleen lage bewolking (hoog de hele dag 0 %, midden hooguit 14 %). Bewolking ECMWF (gemiddelde van de leden): 50 / 56 / 60 / 61 / 60 / 61 / 66 / 73 / 77 % van 8 tot 16 u, met k_model (mediaan van de leden) 0,64–0,69 de hele dag. 25 leden gaven om 8 en 9 u ≥ 0,1 mm, 42–50 leden van 10 tot 16 u.
- **Dagicoon:** HARMONIE half bewolkt · ECMWF regen · waargenomen half bewolkt (drie uren zonnig, twee half bewolkt, vier dunne bewolking). HARMONIE ✓, ECMWF ✗.
- **Overeenstemming per uur:** HARMONIE 1 van 9 (11 %) · ECMWF 0 van 2 getoetste uren (de zeven regenuren 10–16 u niet geteld; als fout geteld 0 van 9).
- **Bewolkingsklasse (30/70) los van de zon:** HARMONIE 7 van 9 uren verkeerd (8 u: 75 % bij 2 achtsten; 10, 11 en 14 u: 18–31 % bij 6–7 achtsten; 12 u: 32 % bij 0 achtsten; 13 u: 20 % bij 3 achtsten; 16 u: 44 % bij 2 achtsten), ECMWF 8 van 9 (alles behalve 13 u: de hele dag 50–77 %, dus half bewolkt of net dicht, terwijl de waarnemer heen en weer ging tussen 0 en 8 achtsten).
- **Gevoeligheid THIN_SUN:** één HARMONIE-uur met bewolking ≥ 70 % en zon > 6° (9 u, k_model 0,33, waargenomen dunne bewolking): elk paar geeft 0 van 1 (bewolkt), want het model had een dik laag dek waar de zon in werkelijkheid 8 minuten per 10 scheen. Voor ECMWF: ondergrens 0,50 geeft 1 van 2 (9 u wordt dunne bewolking), alle andere paren 0 van 2. Beste paar van de dag voor HARMONIE: n.v.t. (alle gelijk; huidige 0,60/0,85 scoort hetzelfde).
- **Wat opviel:** een wisselvallige dag met veel zon tussen wolkenvelden door: de waarnemer sprong per uur tussen 0 en 8 achtsten (2, 8, 7, 7, 0, 3, 6, 4, 2), terwijl de zon bijna steeds scheen (SQ 5–10 tot 14 u, k_sat 0,65–0,95). Vier uren kwamen daardoor op dunne bewolking uit, al was het eerder gebroken bewolking dan een sluier (het model zag geen hoge bewolking). HARMONIE liep uit de pas: 's ochtends een laag dek van 75–78 % met k_model 0,33 terwijl de zon scheen, daarna 18–32 % op uren met 6–7 achtsten; alleen 15 u klopte (56 % en k_model 0,34 tegen k_sat 0,32). Op zo'n dag is een uur-op-uur-vergelijking streng: het dagicoon (half bewolkt) was wel goed. Het ensemble zag de hele dag buien (42–50 leden met ≥ 0,1 mm) waar Schiphol alleen sporen mat: de derde dag (na 8 en 12 november) waarop de regenkans van het ensemble de droge werkelijkheid overstemt, terwijl HARMONIE droog bleef.

## 2026-11-14 (gecheckt op 2026-11-17)

Laatste dag met complete KNMI-uurgegevens (15 en 16 november nog leeg). HARMONIE via Open-Meteo (run van kort tevoren), ECMWF-ensemble 51 leden. Lichte uren: 8 t/m 16 u lokaal. Alle vier de bronnen kwamen in één keer binnen; hetzelfde script als op 14, 15 en 16 november. Extra opgehaald: neerslag Schiphol (RH): de hele dag droog.

| Uur (lokaal) | N | SQ | k_sat | k_knmi | Bewolking HARMONIE (glad) | k_model | Icoon HARMONIE | Icoon ECMWF | Waargenomen | ✓/✗ |
|---|---|---|---|---|---|---|---|---|---|---|
| 8 u | 8 | 7 | 1,07 | 1,71 | 96 (hoog 96) | – (zon < 6°) | dunne bewolking (lagenregel) | half bewolkt | dunne bewolking | ✓ (ECMWF ✗) |
| 9 u | 2 | 10 | 0,90 | 1,06 | 73 (hoog 73) | 0,96 | half bewolkt | zonnig | zonnig | ✗ (ECMWF ✓) |
| 10 u | 8 | 10 | 0,95 | 1,06 | 26 (hoog 26) | 1,00 | zonnig | zonnig | dunne bewolking | ✗ |
| 11 u | 8 | 10 | 1,01 | 1,06 | 11 (hoog 11) | 1,04 | zonnig | zonnig | dunne bewolking | ✗ |
| 12 u | 8 | 10 | 0,99 | 1,04 | 45 (hoog 45) | 1,02 | half bewolkt | zonnig | dunne bewolking | ✗ |
| 13 u | 6 | 10 | 1,01 | 0,94 | 83 (hoog 83) | 1,00 | half bewolkt | zonnig | dunne bewolking | ✗ |
| 14 u | 8 | 10 | 0,89 | 1,07 | 94 (hoog 94) | 0,94 | half bewolkt | half bewolkt | dunne bewolking | ✗ |
| 15 u | 8 | 10 | 0,81 | 0,99 | 89 (hoog 89) | 1,02 | half bewolkt | zonnig | dunne bewolking | ✗ |
| 16 u | 8 | 2 | 1,03 | 1,87 | 89 (hoog 89) | – (zon < 6°) | dunne bewolking (lagenregel) | zonnig | bewolkt | ✗ |

- Direct-fractie satelliet: 0,16–0,36 in de randuren, 0,46–0,72 van 10 tot 14 u (zoals bij een heldere hemel), 0,22 om 15 u. Geen neerslag, ook niet in de modellen (geen enkel lid met ≥ 0,1 mm). Laag en midden in HARMONIE de hele dag 0 %: alles wat het model zag was hoge bewolking. Bewolking ECMWF (gemiddelde van de leden): 44 % om 8 u, 32 % om 9 u, daarna 23–30 %, met k_model (mediaan van de leden) 0,98–1,00 de hele dag.
- **Dagicoon:** HARMONIE half bewolkt · ECMWF zonnig · waargenomen dunne bewolking (één uur zonnig, zeven dunne bewolking, één bewolkt). Beide ✗.
- **Overeenstemming per uur:** HARMONIE 1 van 9 (11 %) · ECMWF 1 van 9 (11 %).
- **Bewolkingsklasse (30/70) los van de zon:** HARMONIE 4 van 9 uren verkeerd (9 u: 73 % bij 2 achtsten; 10, 11 en 12 u: 11–45 % bij 8 achtsten), ECMWF 9 van 9 (23–44 % waar de waarnemer 6–8 achtsten zag, en 32 % om 9 u bij 2 achtsten).
- **Gevoeligheid THIN_SUN:** vier HARMONIE-uren met bewolking ≥ 70 % en zon > 6° (9, 13, 14 en 15 u) met k_model 0,96, 1,00, 0,94 en 1,02, waargenomen als zonnig en drie keer dunne bewolking: boven elke bovengrens uit de reeks, dus elk paar geeft 0 van 4 (half bewolkt). Voor ECMWF scoren alle paren gelijk (1 van 9). Beste paar van de dag: n.v.t. (alle gelijk; huidige 0,60/0,85 scoort hetzelfde).
- **Wat opviel:** de zuiverste sluierdag van de reeks, en een herhaling van 10 november. De waarnemer gaf vrijwel de hele dag 8 achtsten, terwijl de zon ongehinderd scheen: SQ 10 van 9 tot 15 u, k_sat 0,81–1,01, k_knmi 0,94–1,07. HARMONIE zag de sluier ook als alleen hoge bewolking, maar wisselend (11–45 % van 10 tot 12 u, 83–94 % daarna) en zonder enig effect op de straling (k_model 0,94–1,04, gelijk aan een heldere hemel). De app gaf daardoor zonnig of half bewolkt en nergens dunne bewolking, behalve via de lagenregel in de twee uren met een lage zon (8 u terecht; 16 u net niet, omdat SQ 2 onder de 3 bleef). Het ensemble zag de sluier nauwelijks (23–30 %) en gaf zonnig. Geen THIN_SUN-paar had hier iets veranderd; de lagenregel uit de conclusie (laag en midden < 30 %, hoog ≥ 30 %, k_model ≥ 0,65 → dunne bewolking, ook boven de bovengrens) had 12, 13, 14 en 15 u goed gemaakt en er geen bedorven (9 u, hoog 73 % bij 2 achtsten, was al fout en blijft fout): 5 van 9 in plaats van 1 van 9.

## 2026-11-15 (gecheckt op 2026-11-18)

Laatste dag met complete KNMI-uurgegevens (16 en 17 november nog leeg). HARMONIE via Open-Meteo (run van kort tevoren), ECMWF-ensemble 51 leden. Lichte uren: 8 t/m 16 u lokaal. Alle vier de bronnen kwamen in één keer binnen; hetzelfde script als op 14 t/m 17 november. Extra opgehaald: neerslag Schiphol (RH): overdag droog, alleen een spoor (< 0,05 mm) om 16 u.

| Uur (lokaal) | N | SQ | k_sat | k_knmi | Bewolking HARMONIE (glad) | k_model | Icoon HARMONIE | Icoon ECMWF | Waargenomen | ✓/✗ |
|---|---|---|---|---|---|---|---|---|---|---|
| 8 u | 8 | 0 | 0,68 | 0,94 | 97 (midden 41, hoog 97) | – (zon < 6°) | bewolkt | bewolkt | bewolkt | ✓ |
| 9 u | 8 | 0 | 0,19 | 0,32 | 100 (midden 51, hoog 100) | 0,50 | bewolkt | dunne bewolking | bewolkt | ✓ (ECMWF ✗) |
| 10 u | 8 | 0 | 0,28 | 0,50 | 100 (midden 50, hoog 100) | 0,62 | dunne bewolking | dunne bewolking | bewolkt | ✗ |
| 11 u | 8 | 2 | 0,33 | 0,44 | 94 (midden 33, hoog 94) | 0,79 | dunne bewolking | dunne bewolking | bewolkt | ✗ |
| 12 u | 8 | 0 | 0,31 | 0,36 | 89 (laag 25, midden 8, hoog 65) | 0,82 | dunne bewolking | dunne bewolking | bewolkt | ✗ |
| 13 u | 8 | 0 | 0,49 | 0,39 | 94 (laag 75, hoog 34) | 0,44 | bewolkt | bewolkt | bewolkt | ✓ |
| 14 u | 8 | 0 | 0,40 | 0,29 | 100 (laag 100, hoog 51) | 0,11 | bewolkt | bewolkt | bewolkt | ✓ |
| 15 u | 8 | 0 | 0,29 | 0,15 | 100 (laag 100, hoog 87) | 0,10 | bewolkt | bewolkt | bewolkt | ✓ |
| 16 u | 8 | 0 | 0,47 | 0,42 | 99 (laag 85, hoog 98) | – (zon < 6°) | bewolkt | regen (47 van 51 leden) | bewolkt | ✓ (ECMWF –) |

- Direct-fractie satelliet: 0,00–0,16 de hele dag, dus geen directe zon; Schiphol mat alleen om 11 u twee minuten zon per 10. HARMONIE had geen neerslag; in het ensemble 2–15 leden met ≥ 0,1 mm tot 15 u en 47 leden om 16 u. Bewolking ECMWF (gemiddelde van de leden): 88 / 79 / 73 / 74 / 80 % van 8 tot 12 u, daarna 86–99 %, met k_model (mediaan van de leden) 0,68–0,76 van 9 tot 12 u en 0,39–0,54 van 13 tot 15 u.
- **Dagicoon:** HARMONIE bewolkt · ECMWF bewolkt · waargenomen bewolkt. Beide ✓.
- **Overeenstemming per uur:** HARMONIE 6 van 9 (67 %) · ECMWF 4 van 8 getoetste uren (50 %; het regenuur van 16 u niet geteld; als fout geteld 4 van 9).
- **Bewolkingsklasse (30/70) los van de zon:** HARMONIE 0 van 9 uren verkeerd, ECMWF 0 van 9.
- **Gevoeligheid THIN_SUN:** zeven HARMONIE-uren met bewolking ≥ 70 % en zon > 6° (9 t/m 15 u), alle zeven waargenomen als bewolkt, met k_model 0,50, 0,62, 0,79, 0,82, 0,44, 0,11 en 0,10. Huidige 0,60/0,85: 4 van 7 (10, 11 en 12 u vallen op dunne bewolking). Ondergrens 0,65 of 0,70: 5 van 7 (10 u met 0,62 wordt terecht bewolkt); 0,55: 4 van 7; 0,50: 3 van 7 (9 u met precies 0,50 wordt dan dunne bewolking). De bovengrens doet niet mee (geen k_model boven 0,82). **Beste paar van de dag: 0,65–0,70 / 0,80–0,90 (5 van 7).** Voor ECMWF scoren alle paren gelijk (4 van 8).
- **Wat opviel:** weer een dichte, donkere dag zoals 11 november: 8 achtsten van zonsopkomst tot -ondergang, vrijwel geen zonneschijn, k_sat 0,19–0,49. Beide modellen hadden de lucht dicht, dus alleen de zonregel maakte het verschil. HARMONIE zag 's ochtends een dek van hoge en middelbare bewolking dat in het model veel te veel licht doorliet (k_model 0,62–0,82 van 10 tot 12 u tegen k_sat 0,28–0,33 en k_knmi 0,36–0,50) en pas vanaf 13 u, toen er in het model lage bewolking onder schoof, donker genoeg werd (0,44 → 0,10). Het ensemble deed hetzelfde (mediaan 0,68–0,76 in de ochtend), dus vier uren dunne bewolking op een grijze ochtend. Ondergrens 0,65 redt daarvan alleen 10 u; 11 en 12 u (0,79 en 0,82) liggen midden in de band en zijn met geen enkel paar uit de reeks goed te krijgen. Het gladmaken van k_model (idee van 11 november) helpt hier niet, want de straling sprong niet maar lag drie uren achtereen te hoog; de lagen wel een beetje: 9 t/m 11 u hadden 33–51 % middelbare bewolking, wat bij een echte sluier (4, 10 en 14 november: midden 0 %) niet voorkwam.

## 2026-11-16 (gecheckt op 2026-11-19)

Laatste dag met complete KNMI-uurgegevens (17 en 18 november nog leeg). HARMONIE via Open-Meteo (run van kort tevoren), ECMWF-ensemble 51 leden. Lichte uren: 8 t/m 16 u lokaal. Alle vier de bronnen kwamen in één keer binnen; hetzelfde script als op 14 t/m 18 november, met neerslag Schiphol (RH) erbij.

| Uur (lokaal) | N | SQ | RH (mm) | k_sat | k_knmi | Bewolking HARMONIE (glad) | k_model | Icoon HARMONIE | Icoon ECMWF | Waargenomen | ✓/✗ |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 8 u | 8 | 0 | 0,2 | 0,93 | 0,52 | 54 (midden 50) | – (zon < 6°) | half bewolkt | regen (51) | bewolkt | ✗ (ECMWF –) |
| 9 u | 8 | 0 | 0,1 | 0,44 | 0,36 | 52 (midden 50) | 0,43 | half bewolkt | regen (51) | bewolkt | ✗ (ECMWF –) |
| 10 u | 5 | 2 | 0,2 | 0,58 | 0,51 | 26 | 0,57 | regen (1,6 mm) | regen (51) | half bewolkt | – / – |
| 11 u | 6 | 7 | 0 | 0,75 | 0,77 | 1 | 0,79 | zonnig | regen (51) | dunne bewolking | ✗ (ECMWF –) |
| 12 u | 8 | 5 | 0,5 | 0,46 | 0,61 | 25 | 0,80 | zonnig | regen (51) | bewolkt | ✗ (ECMWF –) |
| 13 u | 8 | 7 | 0,1 | 0,68 | 0,93 | 51 (laag 51) | 0,22 | regen (0,1 mm) | regen (47) | dunne bewolking | – / – |
| 14 u | 6 | 2 | spoor | 0,44 | 0,58 | 28 | 0,98 | zonnig | regen (47) | bewolkt | ✗ (ECMWF –) |
| 15 u | 8 | 7 | spoor | 0,33 | 0,59 | 12 | 1,06 | zonnig | regen (47) | bewolkt | ✗ (ECMWF –) |
| 16 u | 2 | 2 | 0 | 1,25 | 1,16 | 46 (laag 44) | – (zon < 6°) | half bewolkt | bewolkt (25 leden regen) | zonnig | ✗ / ✗ |

- Direct-fractie satelliet 0,01–0,41: buien met korte opklaringen. Schiphol mat 1,1 mm verdeeld over 8, 9, 10, 12 en 13 u. Bewolking ECMWF (gemiddelde van de leden): 90 / 82 / 74 / 68 / 64 / 64 / 69 / 76 / 81 %, k_model (mediaan) 0,55–0,64.
- **Dagicoon:** HARMONIE half bewolkt · ECMWF regen · waargenomen bewolkt. Beide ✗ (al is regen voor een dag met vijf natte uren te verdedigen; de maat toetst neerslag niet).
- **Overeenstemming per uur:** HARMONIE 0 van 7 getoetste uren (de regenuren 10 en 13 u niet geteld; Schiphol mat daar wel 0,2 en 0,1 mm) · ECMWF 0 van 1 (acht regenuren niet geteld; vijf daarvan waren op Schiphol nat).
- **Bewolkingsklasse (30/70) los van de zon:** HARMONIE 9 van 9 uren verkeerd, ECMWF 6 van 9.
- **Gevoeligheid THIN_SUN:** geen enkel HARMONIE-uur met bewolking ≥ 70 %, dus de zonregel deed niet mee; alle paren gelijk (0 van 0). Voor ECMWF ook alle paren gelijk (0 van 1). **Geen beste paar van de dag.**
- **Wat opviel:** een buiige dag met 6–8 achtsten en vijf natte uren, waar HARMONIE na 10 u 1–28 % bewolking en volle zon gaf (k_model 0,79–1,06) bij een waargenomen k_sat van 0,33–0,75: de vierde dag (na 3, 8 en 12 november) waarop het model een dicht dek mist, en de dag met de slechtste score tot nu toe. Het ensemble had de lucht vaker dicht (64–90 %) en de regen goed, maar daardoor bleef er niets over om de bewolkingsiconen te toetsen. Voor de THIN_SUN-keuze voegt deze dag niets toe.

## 2026-11-17 (gecheckt op 2026-11-20)

Laatste dag met complete KNMI-uurgegevens (18 en 19 november nog leeg). HARMONIE via Open-Meteo (run van kort tevoren), ECMWF-ensemble 51 leden. Lichte uren: 8 t/m 16 u lokaal. Alle vier de bronnen kwamen in één keer binnen; hetzelfde script als op 14 t/m 19 november.

| Uur (lokaal) | N | SQ | RH (mm) | k_sat | k_knmi | Bewolking HARMONIE (glad) | k_model | Icoon HARMONIE | Icoon ECMWF | Waargenomen | ✓/✗ |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 8 u | 8 | 0 | 1,5 | 0,25 | 0,29 | 100 | – (zon < 6°) | regen (1,9 mm) | regen (51) | bewolkt | – / – |
| 9 u | 8 | 0 | 1,8 | 0,09 | 0,14 | 100 | 0,01 | regen (3,1 mm) | regen (51) | bewolkt | – / – |
| 10 u | 8 | 0 | 4,2 | 0,13 | 0,08 | 100 | 0,00 | regen (8,3 mm) | regen (51) | bewolkt | – / – |
| 11 u | 8 | 0 | 2,7 | 0,20 | 0,08 | 100 | 0,01 | regen (4,8 mm) | regen (51) | bewolkt | – / – |
| 12 u | 8 | 0 | 0,9 | 0,20 | 0,14 | 100 | 0,05 | regen (4,1 mm) | regen (51) | bewolkt | – / – |
| 13 u | 8 | 0 | 0,1 | 0,26 | 0,24 | 100 (laag 67, midden 54, hoog 75) | 0,12 | bewolkt | regen (46) | bewolkt | ✓ / – |
| 14 u | 7 | 3 | 0,7 | 0,18 | 0,42 | 97 (laag 70) | 0,23 | regen (0,1 mm) | regen (46) | bewolkt | – / – |
| 15 u | 6 | 8 | spoor | 0,62 | 0,80 | 88 (laag 74, hoog 0) | 0,72 | dunne bewolking | regen (46) | dunne bewolking | ✓ / – |
| 16 u | 8 | 0 | spoor | 1,04 | 0,77 | 63 (laag 62) | – (zon < 6°) | half bewolkt | regen (48) | bewolkt | ✗ / – |

- Direct-fractie satelliet 0,00 tot 13 u, daarna 0,25–0,30. Schiphol mat 11,9 mm, vrijwel alles van 8 tot 12 u; HARMONIE gaf voor die uren 22 mm, op het juiste moment. Bewolking ECMWF (gemiddelde van de leden): 100 / 100 / 100 / 100 / 100 / 95 / 79 / 58 / 49 %. k_sat en k_knmi om 16 u (1,04 en 0,77) zijn bij een zon onder de 6° niet betrouwbaar.
- **Dagicoon:** HARMONIE regen · ECMWF regen · waargenomen bewolkt. Beide ✗ volgens de maat, maar voor een dag met 11,9 mm en zeven natte uren is regen het juiste icoon (de maat toetst neerslag niet).
- **Overeenstemming per uur:** HARMONIE 2 van 3 getoetste uren (de zes regenuren niet geteld; op Schiphol waren ze alle zes nat) · ECMWF 0 van 0 (alle negen uren regen; zeven daarvan waren nat, 15 en 16 u alleen sporen).
- **Bewolkingsklasse (30/70) los van de zon:** HARMONIE 1 van 9 uren verkeerd (16 u), ECMWF 2 van 9 (15 en 16 u).
- **Gevoeligheid THIN_SUN:** twee HARMONIE-uren met bewolking ≥ 70 % en zon > 6°: 13 u (k_model 0,12, bewolkt) en 15 u (k_model 0,72, dunne bewolking). Beide goed bij elk paar uit de reeks (2 van 2); voor ECMWF geen getoetste uren. **Geen beste paar van de dag** (alle paren gelijk).
- **Wat opviel:** een regendag die HARMONIE goed had: dicht en nat tot 12 u, droog om 13 u, en om 15 u een opklaring onder een laag dek (6 achtsten, 48 minuten zon) die het model netjes als dunne bewolking gaf met k_model 0,72 tussen k_sat 0,62 en k_knmi 0,80. Het ensemble hield tot het eind 46–48 leden met regen, terwijl het om 15 en 16 u al droog was.

## 2026-11-18 (gecheckt op 2026-11-21)

Laatste dag met complete KNMI-uurgegevens (19 en 20 november nog leeg). HARMONIE via Open-Meteo (run van kort tevoren), ECMWF-ensemble 51 leden. Lichte uren: 8 t/m 16 u lokaal. Alle vier de bronnen kwamen in één keer binnen; hetzelfde script als op 14 t/m 20 november.

| Uur (lokaal) | N | SQ | RH (mm) | k_sat | k_knmi | Bewolking HARMONIE (glad) | k_model | Icoon HARMONIE | Icoon ECMWF | Waargenomen | ✓/✗ |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 8 u | 8 | 0 | 0 | 0,94 | 0,49 | 91 | – (zon < 6°) | regen (0,1 mm) | regen (51) | bewolkt | – / – |
| 9 u | 8 | 0 | 0,2 | 0,43 | 0,24 | 100 (laag 100) | 0,09 | regen (0,3 mm) | regen (51) | bewolkt | – / – |
| 10 u | 8 | 0 | 0,6 | 0,21 | 0,36 | 100 (laag 100) | 0,24 | bewolkt | regen (45) | bewolkt | ✓ / – |
| 11 u | 8 | 1 | 0,1 | 0,52 | 0,38 | 89 (laag 75, midden 24, hoog 15) | 0,67 | dunne bewolking | regen (45) | bewolkt | ✗ / – |
| 12 u | 8 | 2 | spoor | 0,42 | 0,44 | 74 (laag 26, midden 19, hoog 41) | 0,60 (net onder) | bewolkt | regen (45) | bewolkt | ✓ / – |
| 13 u | 8 | 0 | 0,1 | 0,40 | 0,40 | 82 (laag 28, midden 34, hoog 42) | 0,75 | dunne bewolking | regen (36) | bewolkt | ✗ / – |
| 14 u | 8 | 0 | spoor | 0,43 | 0,29 | 94 (laag 55) | 0,19 | bewolkt | regen (36) | bewolkt | ✓ / – |
| 15 u | 8 | 0 | spoor | 0,22 | 0,33 | 96 (laag 57) | 0,51 | bewolkt | regen (36) | bewolkt | ✓ / – |
| 16 u | 8 | 2 | spoor | 1,32 | 0,86 | 74 (laag 54) | – (zon < 6°) | bewolkt | regen (36) | bewolkt | ✓ / – |

- Direct-fractie satelliet 0,00–0,09 de hele dag (16 u 0,31 bij een zon onder de 6°). Schiphol mat 1,0 mm, verspreid over 9 t/m 13 u, verder sporen. Bewolking ECMWF (gemiddelde van de leden): 99 / 99 / 98 / 97 / 97 / 96 / 97 / 97 / 97 %; mediaan k van de leden 0,24–0,28. k_sat en k_knmi om 8 en 16 u (0,94 / 1,32) zijn bij een zon onder de 6° niet betrouwbaar.
- **Dagicoon:** HARMONIE bewolkt ✓ · ECMWF regen ✗ · waargenomen bewolkt. Met 1,0 mm in vier natte uren (telkens 0,1–0,6 mm) is regen hier verdedigbaar, maar zwakker dan op 17 november; hij blijft als fout geteld.
- **Overeenstemming per uur:** HARMONIE 5 van 7 getoetste uren (8 en 9 u regen niet geteld; 9 u was nat, 8 u droog) · ECMWF 0 van 0 (alle negen uren regen bij 36–51 leden; vier daarvan waren nat).
- **Bewolkingsklasse (30/70) los van de zon:** HARMONIE 0 van 9 uren verkeerd, ECMWF 0 van 9.
- **Gevoeligheid THIN_SUN:** zes HARMONIE-uren met bewolking ≥ 70 % en zon > 6°, alle zes werkelijk bewolkt, met k_model 0,24, 0,67, 0,60, 0,75, 0,19 en 0,51. Ondergrens 0,50 2/6, 0,55 3/6, 0,60 en 0,65 4/6, 0,70 5/6; de bovengrens maakt niets uit. **Beste paar van de dag: ondergrens 0,70 (met elke bovengrens), 5/6; het huidige paar 4/6**, het voorstel 0,65/0,90 ook 4/6. Voor ECMWF geen getoetste uren.
- **Wat opviel:** een grijze dag (8 achtsten, vrijwel geen zon, k_sat 0,21–0,52) waarop HARMONIE de bewolking goed had maar de straling onder het dek twee keer te hoog: 11 u (0,67, met 75 % lage bewolking) en 13 u (0,75, onder een mengsel van laag, midden en hoog). Het eerste uur is het tweede bewolkte uur in de band 0,65–0,70 waar alleen 0,70 helpt; het tweede redt geen grens. Het ensemble gaf weer de hele dag regen, ook op de vijf droge uren.

## Lopende stand

- Gecheckte dagen: 16 (3 t/m 18 nov) · lichte uren: 144 · uren waarin de THIN_SUN-regel bij HARMONIE meedeed (bewolking ≥ 70 %, zon > 6°): 41.
- Overeenstemming per uur tot nu toe: HARMONIE 60/133 (45 %; de regenuren van 3, 16, 17 en 18 nov niet geteld) · ECMWF 54/91 (59 %; 4 nov niet beschikbaar, de 44 regenuren van 8, 12, 13, 15, 16, 17 en 18 nov niet geteld; als fout geteld 54/135, 40 %). Dagicoon met de regel van versie 34 (bewolkingsscore, zie hieronder): HARMONIE 10/16, ECMWF ongeveer 6/15. Met de oude mediaan: HARMONIE 8/16, ECMWF 6/15 (17 nov beide regen tegen waargenomen bewolkt, bij 11,9 mm; 18 nov ECMWF regen bij 1,0 mm; met 17 nov als goed geteld 9/16 en 7/15).
- Bewolkingsklasse (30/70) verkeerd: HARMONIE 58/144 uren, ECMWF 47/135.
- Overeenstemming per THIN_SUN-paar (HARMONIE, opgeteld over de 41 THIN_SUN-uren; 18 nov voegde zes uren toe, alle zes bewolkt, met k_model 0,24, 0,67, 0,60 (net onder), 0,75, 0,19 en 0,51; 17 nov voegde twee uren toe die voor elk paar goed zijn (k_model 0,12 bewolkt en 0,72 dunne bewolking); 16 nov voegde er geen toe; 15 nov voegde zeven uren toe, alle zeven bewolkt, met k_model 0,50, 0,62, 0,79, 0,82, 0,44, 0,11 en 0,10; 14 nov voegde vier uren toe die voor elk paar fout zijn (k_model 0,94–1,02 onder een sluier, één keer bij 2 achtsten); 12 nov voegde er geen toe, 13 nov één uur dat voor elk paar fout is (k_model 0,33 onder een laag dek waar de zon doorheen scheen): 6 nov twee uren met k_model 0,92–0,94 die voor elk paar 1/2 tellen; 4 nov k_model 0,80, 0,85 en 0,64, alle drie dunne bewolking; 7 nov k_model 0,64 bewolkt, 0,66 dunne bewolking en 0,57 bewolkt; 8 nov k_model 0,33, 0,46 en 0,62, alle drie bewolkt; 9 nov k_model 0,46 onder een dek dat al was opgebroken, voor elk paar fout; 10 nov k_model 1,00 en 0,97 onder een sluier, voor elk paar fout; 11 nov k_model 0,22, 0,89, 0,36, 0,43, 0,63, 0,55 en 0,87, alle zeven bewolkt):

  | Ondergrens \ bovengrens | 0,80 | 0,85 | 0,90 |
  |---|---|---|---|
  | 0,50 | 15/41 | 16/41 | 17/41 |
  | 0,55 | 18/41 | 19/41 | 20/41 |
  | 0,60 (huidig) | 20/41 | **21/41 (huidig)** | 22/41 |
  | 0,65 | 23/41 | 24/41 | **25/41** |
  | 0,70 | 23/41 | 24/41 | **25/41** |

  ECMWF (mediaan van de leden, getoetste lichte uren van 3 en 5 t/m 18 nov; de bovengrens maakte alleen op 10 nov verschil; 15 nov telde voor elk paar 4 van 8, 16 nov 0 van 1, 17 en 18 nov 0 van 0): met bovengrens 0,85 of 0,90 ondergrens 0,50 53/91, 0,55 53/91, 0,60–0,65 54/91, 0,70 55/91; met bovengrens 0,80 één uur meer bij ondergrens ≥ 0,55 (54, 54, 55 en 56 van 91). De verschillen zijn 1–3 uren; 7 en 11 nov wijzen naar een ondergrens van minstens 0,60, 10 en 13 nov naar een lagere.
- IJkpunt heldere hemel (5, 6, 9, 10 en 12 nov): k_model ≈ 0,94–1,03, k_sat ≈ 0,85–1,0, k_knmi ≈ 0,9–1,0 rond het middaguur.

### Dagicoon opnieuw berekend met de regel van versie 34 (21 november 2026)

Sinds versie 34 (16 november) maakt de app het dagicoontje niet meer met de mediaan van de lichte uren, maar met een bewolkingsscore (`dayKindOf`, zie README "Versie 34"). De uuricoontjes zijn niet veranderd, dus alles hierboven over uren en THIN_SUN blijft gelden. Alleen de dagicoontjes zijn opnieuw berekend, uit de uuricoontjes in de tabellen. De waargenomen dagklasse gaat nu ook met `dayKindOf` over de waargenomen uurklassen, zodat model en waarneming dezelfde maat krijgen.

| Dag | Waargenomen (oud → v34) | HARMONIE (oud → v34) | v34 ✓/✗ | ECMWF v34 (benadering) |
|---|---|---|---|---|
| 3 nov | bewolkt | zonnig → half bewolkt | ✗ | bewolkt ✓ |
| 4 nov | dunne bewolking → half bewolkt | half bewolkt | ✓ (was ✗) | – |
| 5 nov | zonnig | zonnig | ✓ | zonnig ✓ |
| 6 nov | zonnig | zonnig | ✓ | zonnig ✓ |
| 7 nov | bewolkt | dunne bewolking → bewolkt | ✓ (was ✗) | dunne bewolking ✗ |
| 8 nov | bewolkt | half bewolkt | ✗ | regen ✗ |
| 9 nov | zonnig | zonnig | ✓ | zonnig ✓ |
| 10 nov | half bewolkt | half bewolkt | ✓ | bewolkt ✗ |
| 11 nov | bewolkt | bewolkt | ✓ | bewolkt ✓ |
| 12 nov | dunne bewolking → bewolkt | zonnig | ✗ | regen ✗ |
| 13 nov | half bewolkt | half bewolkt | ✓ | regen ✗ |
| 14 nov | dunne bewolking | half bewolkt | ✗ | zonnig ✗ |
| 15 nov | bewolkt | bewolkt | ✓ | bewolkt ✓ |
| 16 nov | bewolkt | half bewolkt | ✗ | regen ✗ |
| 17 nov | bewolkt | regen | ✗ (regen verdedigbaar bij 11,9 mm) | regen ✗ |
| 18 nov | bewolkt | bewolkt | ✓ | regen ✗ |

- **HARMONIE: 10 van 16 dagen goed met de nieuwe regel, tegen 8 van 16 met de mediaan** (11 van 16 als 17 nov goed telt). Beide winsten (4 en 7 nov) komen doordat de nieuwe regel geen dunne bewolking meer verzint als gemiddelde van zon en bewolkt. 3 nov blijft fout maar komt een klasse dichterbij (half bewolkt in plaats van zonnig).
- **ECMWF: 6 van 15, gelijk aan de oude score.** Dit is een benadering: de app rekent per lid een dagicoon en neemt daarvan het middelste (`middleKind`), terwijl hier alleen de mediaan per uur uit het logboek beschikbaar was. De vijf fouten met regen (8, 12, 13, 16 en 18 nov) blijven. Daar ligt het aan de neerslag, niet aan de dagregel.
- **Let op bij sluierdagen:** op 4 nov waren 6 van de 9 uren dunne bewolking en de andere 3 zonnig of half bewolkt. Dat geeft een score van 61 %, onder de 65 % voor bewolkt, dus wordt de dag half bewolkt en geen dunne bewolking. Hier zitten model en waarneming allebei op half bewolkt, dus de dag telt als goed. Toch toont de app op zo'n dag een half bewolkt icoon onder een gesloten sluier. Dunne bewolking als dagicoon vraagt nu een score van minstens 65 % én meer dunne uren dan bewolkte en regenuren samen.
- De taak `regen-iconen-check` rekent vanaf 22 november het dagicoon met deze regel (per ECMWF-lid, daarna het middelste lid).

### Sluierdagen: lagenregel en dagregel doorgerekend op alle 16 dagen (21 november 2026)

Vraag van Ima: het dagicoontje van versie 34 werkt goed, behalve op sluierdagen. Doorgerekend met de HARMONIE-uren van 2 t/m 19 november (Open-Meteo, opnieuw opgehaald) en de formules uit app.js zelf (zonshoogte, heldere hemel, gladmaken, `forecastKind`, `dayKindOf`). Die herberekening geeft op alle 144 uren hetzelfde uuricoon als de tabellen hierboven (60/133 uren goed).

**Maat voor de dag.** Wat de dag was: de waargenomen uurklassen met de dagregel van versie 34 plus "dunne bewolking in minstens de helft van de lichte uren → dunne bewolking". Dat maakt 4 en 14 november dunne bewolking, de andere dagen blijven zoals in de tabel van versie 34. Tegen die maat heeft de app nu 9 van 16 dagen goed (4 en 14 november fout).

**De combinatie die het best uitkomt**

- Per uur, lagenregel: laag < 30 % en midden < 30 % en hoog ≥ 40 % → dunne bewolking, als de zon van het model minstens 0,60 van een heldere hemel is (of de zon te laag staat om dat te zeggen).
- Per uur, de rest: `THIN_SUN = [0.70, 0.90]`.
- Per dag: dunne bewolking in minstens de helft van de lichte uren → dunne bewolking; een uur dunne bewolking telt in de score als 50 % (was 75 %); een bewolkte dag wordt alleen dunne bewolking bij minstens twee keer zoveel dunne als bewolkte en regenuren (was: meer).

| | Uren goed (van 133) | Dagen goed (van 16) | Sluierdagen 4, 6, 7, 10, 14 nov |
|---|---|---|---|
| App nu | 60 | 9 | ✗ ✓ ✓ ✓ ✗ |
| Alleen THIN_SUN 0,65/0,90 | 63 | 9 | ✗ ✓ ✓ ✓ ✗ |
| Combinatie | 77 | 11 | ✓ ✓ ✓ ✓ ✓ |

- **De lagenregel verandert op de elf andere dagen geen enkel uur** (ook niet met hoog ≥ 30 %): uren met alleen hoge bewolking kwamen in deze periode alleen op de sluierdagen voor. De winst per uur zit op 4 nov (5 → 8), 7 nov (4 → 7), 10 nov (4 → 7) en 14 nov (1 → 5).
- **De ondergrens 0,70 past bij de lagenregel.** De twee sluieruren tussen 0,60 en 0,70 (4 nov 13 u en 7 nov 10 u) hebben alleen hoge bewolking en vallen dus onder de lagenregel; de vijf bewolkte uren in die band hebben lage of middelbare bewolking. Dat is het idee "de ondergrens hangt af van de lagen" uit de aanvulling van 21 november.
- **Elk onderdeel is voor één dag nodig:** zonder de regel van de helft gaan 4 en 14 nov fout, zonder de 50 % 6 nov, zonder "twee keer zoveel" 7 nov, met ondergrens 0,65 in plaats van 0,70 ook 7 nov.
- **De marges zijn smal.** De grens voor hoge bewolking werkt van 36 tot 46 % (daaronder gaat 10 nov fout, daarboven 4 nov). De zon-eis van 0,60 werkt alleen tussen 0,594 en 0,637: bij 0,55 gaat 7 nov fout (15 u, 0,594), bij 0,65 4 nov (13 u, 0,637). De winst per uur is wel stevig: elke variant met de lagenregel komt op 66–77 uren, tegen 60 nu.
- **De dagen die fout blijven** zijn 3, 8, 12 en 16 nov (HARMONIE miste een dicht dek) en 17 nov (regen tegen waargenomen bewolkt, bij 11,9 mm).

**Correctie op de THIN_SUN-tabel in de lopende stand.** De taak rekent k_model met een eigen benadering van de zonshoogte; met de formule van de app wijkt die soms een paar honderdsten af. Het belangrijkste verschil: 7 nov 9 u is 0,660, niet 0,64. Met de zon zoals de app die rekent is de tabel over dezelfde 41 uren: huidig 0,60/0,85 21/41 (gelijk), 0,65/0,90 24/41 (in de tabel 25) en 0,70/0,90 25/41. De ondergrens 0,70 is dus één uur beter dan 0,65, niet gelijk.

**Ingebouwd als versie 37 (21 november 2026)**, zie README "Versie 37". De taak `regen-iconen-check` rekent vanaf 22 november met de formules van de app, legt de nieuwe regels naast de oude van versie 36 en houdt een aparte stand bij voor de dagen vanaf 19 november, waar de regels niet op zijn afgesteld.

- **ECMWF kon niet worden nagerekend:** de ensemble-API bewaart maar een paar dagen (op 21 november alleen nog 18 november). In de verwachting van 21 november veranderen drie van de acht dagicoontjes: 22 en 25 november van half bewolkt naar dunne bewolking, 27 november van dunne bewolking naar bewolkt.
- De dagklassen in de tabel "Dagicoon opnieuw berekend met de regel van versie 34" hierboven blijven met de dagregel van versie 37 dezelfde, behalve 4 november: die is nu dunne bewolking.

Script: `backtest.py` (alleen in de sessie, niet in de repo).

### Conclusie na 7 dagen (12 november 2026)

**Voorstel: `THIN_SUN = [0.65, 0.90]`** (nu `[0.60, 0.85]`). De 30/70-grenzen laten staan.

- **Bovengrens 0,85 → 0,90.** Wint één uur (4 nov 12 u: k_model precies 0,85 onder een echte sluier, nu half bewolkt) en verliest er geen. Het ijkpunt steunt dat: een heldere hemel geeft in HARMONIE k ≈ 0,94–1,03, dus 0,90 houdt ruim afstand van echt zonnige uren, en de enige uren boven 0,90 onder een dichte modelhemel (6 nov 14 en 15 u, 0,92–0,94) blijven half bewolkt.
- **Ondergrens 0,60 → 0,65.** Wint twee uren (7 nov 9 u met 0,64 en 8 nov 12 u met 0,62, allebei werkelijk bewolkt) en verliest er één (4 nov 13 u, 0,64 onder een sluier). 0,70 is slechter voor HARMONIE (verliest 7 nov 10 u, 0,66, terecht dunne bewolking), al wint ECMWF er twee uren mee (40/49 tegen 38/49). Tussen 0,62 en 0,66 lopen sluier en dicht dek door elkaar; 0,65 is het beste compromis.
- **Samen:** 9/12 tegen 7/12 voor het huidige paar bij HARMONIE, en voor ECMWF gelijk (38/49). Een kleine steekproef (12 uren, waarvan maar 4 waarin de paren verschillen), maar de richting is in elke dag waarop de grenzen meededen dezelfde of neutraal; geen enkele dag scoorde het huidige paar beter.
- **30/70 niet verschuiven.** Van de 26 HARMONIE-uren met de verkeerde bewolkingsklasse zijn er 15 een laag wolkendek dat het model te vroeg (3 en 8 nov) of te laat (9 nov) liet breken, met modelbewolking ver van de grens (0–60 % bij 8 achtsten, of 75 % bij 0 achtsten); daar helpt geen grens tegen. De andere 11 vallen op 4, 6 en 7 nov, vooral hoge sluiers van 48–63 % die de waarnemer als gesloten dunne lucht zag (8 uren). De grens 70 omlaag halen zou die naar de zonregel sturen, maar ook gewone stapelwolken van 50–70 % raken; gerichter is de lagenregel die bij 8 nov al is genoemd: **laag en midden < 30 % en hoog ≥ 30 % en k_model ≥ 0,65 → dunne bewolking** (had 6 van die 8 uren goed gehad, en raakt de lage dekken niet). Dat is een voorstel om apart te proberen, geen onderdeel van de THIN_SUN-wijziging.
- **Gebruik de lagen ook onder de dichte hemel** (optioneel, later): de twee bewolkte uren met k_model 0,62–0,64 hadden lage bewolking (31 en 72 %), het sluieruur van 4 nov 13 u alleen hoge. Wie de ondergrens alleen voor lage bewolking wil verhogen, kan dat later met meer dagen toetsen.

De checkperiode (6 t/m 12 november) is hiermee klaar; de taak `regen-iconen-check` kan uit.

### Aanvulling na 8 dagen (13 november 2026)

De taak liep op 13 november nog een keer en voegde 10 november toe. **Het voorstel blijft `THIN_SUN = [0.65, 0.90]`**, de 30/70-grenzen blijven staan.

- **De tallies verschuiven niet.** 10 november gaf twee THIN_SUN-uren (k_model 1,00 en 0,97 onder een sluier) die voor elk paar fout zijn. Het voorstel staat nu op 9/14 tegen 7/14 voor het huidige paar; het verschil blijft twee uren, uit dezelfde vier uren van 4, 7 en 8 november.
- **Een derde sluierdag bevestigt het aandachtspunt, en laat zien waar THIN_SUN niet bij kan.** Op 4, 6, 7 en nu 10 november zag HARMONIE een cirrussluier als alleen hoge bewolking met (bijna) de volle zon. Bij 48–63 % heet dat half bewolkt (30/70), en bij ≥ 70 % met k_model ≥ 0,90 ook (bovengrens). Geen grens in de reeks vangt dat: de straling van een heel dunne sluier is in het model niet van een heldere hemel te onderscheiden. Alleen de lagen doen dat. De lagenregel uit de conclusie hierboven (laag en midden < 30 %, hoog ≥ 30 %, k_model ≥ 0,65 → dunne bewolking), ook toegepast boven de bovengrens, had op 10 november drie uren goed gemaakt (10, 11 en 12 u) en er geen bedorven (13 u, hoog 35 % bij 1 achtste, was al fout en blijft fout). Daar staat 6 november 15 u tegenover (hoog 100 %, k_model 0,94, waarnemer 0 achtsten: fout in beide varianten). Dat blijft een apart voorstel om te proberen.
- **ECMWF geeft geen reden om van 0,65 af te wijken.** Op 7 november won ondergrens 0,70 twee uren, op 10 november verloor hij er één en won 0,50–0,55 er twee. Opgeteld 39/58 voor 0,60–0,65, 40/58 voor 0,70 en 41/58 voor 0,50–0,55: binnen de ruis. Op 10 november zat de fout van het ensemble in de bewolking zelf (94–98 % bij 0–1 achtsten en volle zon).

De checkperiode is klaar; de taak `regen-iconen-check` kan uit. Er komen bij het KNMI nog wel dagen bij (11 en 12 november), maar voor de THIN_SUN-keuze voegen die naar verwachting weinig toe.

### Aanvulling na 9 dagen (14 november 2026)

De taak liep op 14 november nog een keer en voegde 11 november toe, een dichte dag met zeven THIN_SUN-uren. **Het voorstel blijft `THIN_SUN = [0.65, 0.90]`**, de 30/70-grenzen blijven staan.

- **De ondergrens 0,65 krijgt er een uur steun bij.** 11 nov 13 u (k_model 0,63, werkelijk bewolkt) is het derde bewolkte uur tussen 0,62 en 0,64, tegen één sluieruur (4 nov 13 u, 0,64). Het voorstel staat nu op 14/21 tegen 11/21 voor het huidige paar: drie uren verschil in plaats van twee. 0,70 scoort op deze dag gelijk aan 0,65 en blijft opgeteld één uur achter (13/21).
- **De bovengrens blijft een kwestie van één uur (4 nov 12 u).** Op 11 november lagen twee uren met k_model 0,87 en 0,89 onder een lucht die in werkelijkheid dicht en donker was; met 0,90 worden die dunne bewolking in plaats van half bewolkt, nog steeds fout maar een klasse dichterbij. Geen reden om van 0,90 af te wijken.
- **Nieuw aandachtspunt: de straling van HARMONIE springt onder een dik dek.** k_model ging op 11 november in opeenvolgende uren van 0,22 naar 0,89 en terug naar 0,36 bij 100 % bewolking, terwijl de waarnemingen vlak bleven (k_sat 0,39–0,51). Dat geeft een los zonnig uur in een grijze dag. Een grens lost dat niet op; k_model net als de bewolking 1-2-1 gladmaken zou het wel dempen (0,22 / 0,89 / 0,36 wordt ongeveer 0,59 voor het middelste uur, dus bewolkt). Dat is één dag, dus een idee om apart te proberen, geen onderdeel van het voorstel. De lagenregel uit de conclusie had deze uren niet geholpen (10 u had lage en middelbare bewolking; 15 u zou dunne bewolking zijn geworden, ook fout).
- **ECMWF steunt een ondergrens van minstens 0,60.** Met 0,50–0,55 was de middag van 11 november dunne bewolking geworden (3–4 uren fout); opgeteld staat 0,60–0,65 nu op 48/67, 0,70 op 49/67 en 0,50–0,55 op 46–47/67.

De checkperiode is klaar; de taak `regen-iconen-check` kan uit. Bij het KNMI ontbreken 12 en 13 november nog; zolang de taak aan staat, voegt hij die toe.

### Aanvulling na 10 dagen (15 november 2026)

De taak liep op 15 november nog een keer en voegde 12 november toe. **Het voorstel blijft `THIN_SUN = [0.65, 0.90]`** (14/21 tegen 11/21 voor het huidige paar), de 30/70-grenzen blijven staan.

- **Geen nieuwe THIN_SUN-uren.** HARMONIE had op 12 november de hele dag 0–31 % bewolking, dus de zonregel deed niet mee en de tabel hierboven is ongewijzigd. Ook voor ECMWF scoren alle paren deze dag gelijk.
- **Een derde dag waarop HARMONIE een dicht dek mist.** Na 3 en 8 november (stratus die het model liet oplossen) nu een natte ochtend met 7–8 achtsten en 0,5 mm regen waar het model 4–13 % bewolking en geen neerslag had: 1 van 9 uren goed. Dat zijn nu 21 van de 37 HARMONIE-uren met de verkeerde bewolkingsklasse; geen grens helpt daartegen. De overeenstemming per uur zakt daardoor naar 45/89 (51 %), tegen 49/71 (69 %) voor het ensemble, dat deze drie dagen de lucht wel dicht had.
- **Neerslag wordt hier niet getoetst, maar viel deze dag wel op:** het ensemble gaf 8–12 u regen (43–50 leden) en Schiphol mat om 9 en 10 u 0,3 en 0,2 mm; op 8 november gaf het ensemble ook regen terwijl er alleen sporen vielen. HARMONIE had beide dagen droog.

De checkperiode is klaar; de taak `regen-iconen-check` kan uit. Bij het KNMI ontbreken 13 en 14 november nog; zolang de taak aan staat, voegt hij die toe.

### Aanvulling na 11 dagen (16 november 2026)

De taak liep op 16 november nog een keer en voegde 13 november toe. **Het voorstel blijft `THIN_SUN = [0.65, 0.90]`** (14/22 tegen 11/22 voor het huidige paar), de 30/70-grenzen blijven staan.

- **Eén nieuw THIN_SUN-uur, voor elk paar fout.** 13 nov 9 u: HARMONIE had 78 % lage bewolking met k_model 0,33, terwijl de zon 8 minuten per 10 scheen (k_sat 0,69). Dat is een fout in de bewolking en de straling van het model, niet in de grenzen; het verschil tussen voorstel en huidig paar blijft drie uren.
- **Een dag met gebroken bewolking laat de grenzen van de maat zien.** De waarnemer sprong per uur tussen 0 en 8 achtsten bij vrijwel doorlopende zon. HARMONIE had 1 van 9 uren goed maar het dagicoon (half bewolkt) klopte. De overeenstemming per uur zakt daarmee naar 46/98 (47 %); voor het dagicoon staat HARMONIE op 6/11.
- **Het ensemble gaf voor de derde keer regen op een droge dag.** 42–50 van de 51 leden hadden van 10 tot 16 u ≥ 0,1 mm, Schiphol mat alleen sporen (ook 8 en 12 november, al viel er op 12 november wel 0,5 mm). Neerslag wordt hier niet getoetst, maar het is het vermelden waard naast de THIN_SUN-keuze.

De checkperiode is klaar; de taak `regen-iconen-check` kan uit. Bij het KNMI ontbreken 14 en 15 november nog; zolang de taak aan staat, voegt hij die toe.

### Aanvulling na 12 dagen (17 november 2026)

De taak liep op 17 november nog een keer en voegde 14 november toe. **Het voorstel blijft `THIN_SUN = [0.65, 0.90]`** (14/26 tegen 11/26 voor het huidige paar), de 30/70-grenzen blijven staan.

- **Vier nieuwe THIN_SUN-uren, voor elk paar fout.** 14 nov 9, 13, 14 en 15 u: HARMONIE had 73–94 % hoge bewolking met k_model 0,94–1,02, dus half bewolkt bij elke bovengrens; in werkelijkheid één uur zonnig en drie uren dunne bewolking. Het verschil tussen voorstel en huidig paar blijft drie uren.
- **De lagenregel wordt het belangrijkste vervolg.** Na 4, 6, 7 en 10 november is dit de vijfde sluierdag, en de tweede (met 10 november) waarop de sluier in het model de straling helemaal niet dempt. THIN_SUN kan daar niet bij; de lagenregel (laag en midden < 30 %, hoog ≥ 30 %, k_model ≥ 0,65 → dunne bewolking, ook boven de bovengrens) had op 14 november vier uren goed gemaakt en geen bedorven, op 10 november drie. Samen met de 6 van 8 uren op 4, 6 en 7 november is dat meer winst dan de THIN_SUN-wijziging zelf (drie uren). Nog steeds een apart voorstel om te proberen, met als bekend tegenvoorbeeld de uren waarop het model hoge bewolking ziet die er niet is (6 nov 15 u, 14 nov 9 u; nu al fout als half bewolkt).
- **Het ensemble miste de sluier vrijwel helemaal** (23–30 % bewolking, zonnig): 1 van 9, en 9 van 9 uren in de verkeerde bewolkingsklasse. De overeenstemming per uur staat nu op 47/107 (44 %) voor HARMONIE en 50/82 (61 %) voor het ensemble.

De checkperiode is klaar; de taak `regen-iconen-check` kan uit. Bij het KNMI ontbreken 15 en 16 november nog; zolang de taak aan staat, voegt hij die toe.

### Aanvulling na 13 dagen (18 november 2026)

De taak liep op 18 november nog een keer en voegde 15 november toe, een dichte dag met zeven THIN_SUN-uren. **Het voorstel blijft `THIN_SUN = [0.65, 0.90]`** (19/33 tegen 15/33 voor het huidige paar), de 30/70-grenzen blijven staan.

- **De ondergrens 0,65 krijgt er weer een uur steun bij.** 15 nov 10 u (k_model 0,62, werkelijk bewolkt) is het vierde bewolkte uur tussen 0,62 en 0,64, tegen één sluieruur (4 nov 13 u, 0,64). Het verschil tussen voorstel en huidig paar is nu vier uren in plaats van drie. 0,70 scoort deze dag gelijk aan 0,65 en blijft opgeteld één uur achter (18/33).
- **Een ondergrens lager dan 0,60 valt af.** 15 nov 9 u lag met k_model 0,50 precies op de laagste grens uit de reeks onder een donkere lucht (k_sat 0,19); 0,50 staat nu zes uren achter op het voorstel.
- **Twee uren die geen grens redt.** 15 nov 11 en 12 u hadden k_model 0,79 en 0,82 onder een dek dat in werkelijkheid maar een derde van de zon doorliet. Net als op 11 november (0,87 en 0,89) overschat HARMONIE de straling onder een dik dek van hoge en middelbare bewolking; nu niet als een sprong van één uur maar drie uren achtereen, dus gladmaken van k_model helpt hier niet. Wat de uren wel onderscheidt van een sluier is de middelbare bewolking (33–51 % om 9 t/m 11 u; bij de sluierdagen 0 %). Een eis "midden < 30 %" voor dunne bewolking onder een dichte hemel had 15 nov 11 u goed gemaakt (12 u niet: midden 8 %), en past bij de lagenregel uit de conclusie. Eén dag, dus een idee om met de lagenregel samen te proberen, geen onderdeel van het voorstel.
- **Het ensemble zat er op dezelfde manier naast** (mediaan k 0,68–0,76 in de ochtend, vier uren dunne bewolking) en gaf om 16 u regen (47 leden) bij alleen een spoor op Schiphol. Opgeteld blijven de ECMWF-paren binnen drie uren van elkaar.

De checkperiode is klaar; de taak `regen-iconen-check` kan uit. Bij het KNMI ontbreken 16 en 17 november nog; zolang de taak aan staat, voegt hij die toe.

### Aanvulling na 14 dagen (19 november 2026)

De taak liep op 19 november nog een keer en voegde 16 november toe. **Het voorstel blijft `THIN_SUN = [0.65, 0.90]`** (19/33 tegen 15/33 voor het huidige paar), de 30/70-grenzen blijven staan.

- **Geen nieuwe THIN_SUN-uren.** HARMONIE had op deze buiige dag nergens ≥ 70 % bewolking, dus de tabel hierboven is ongewijzigd; ook voor ECMWF scoren alle paren gelijk.
- **De grootste zwakte blijft de bewolking van HARMONIE zelf, niet de zonregel.** Voor de vierde keer (na 3, 8 en 12 november) miste het model een dicht dek: 9 van 9 uren in de verkeerde bewolkingsklasse, 0 van 7 uren goed. Daarmee komt 57 van de 126 lichte uren op een verkeerde bewolkingsklasse, tegen een winst van vier uren door de THIN_SUN-wijziging. Geen grens helpt daartegen.

De checkperiode is klaar; de taak `regen-iconen-check` kan uit. Bij het KNMI ontbreken 17 en 18 november nog; zolang de taak aan staat, voegt hij die toe.

### Aanvulling na 15 dagen (20 november 2026)

De taak liep op 20 november nog een keer en voegde 17 november toe, een regendag. **Het voorstel blijft `THIN_SUN = [0.65, 0.90]`** (21/35 tegen 17/35 voor het huidige paar), de 30/70-grenzen blijven staan.

- **Twee nieuwe THIN_SUN-uren, voor elk paar goed.** 13 u (k_model 0,12, bewolkt) en 15 u (k_model 0,72 bij een opklaring onder een laag dek, werkelijk dunne bewolking). Ze tellen voor alle paren mee, dus het verschil tussen voorstel en huidig paar blijft vier uren. Het uur van 15 u is een nuttig ijkpunt: de enige keer tot nu toe dat HARMONIE onder een laag dek de doorkomende zon goed raakte (k_sat 0,62, k_knmi 0,80), en 0,72 valt bij elk paar in de band van dunne bewolking.
- **HARMONIE zat deze dag goed** (bewolking 1 van 9 uren verkeerd, regen op het juiste moment); de maat telt de zes regenuren niet, waardoor er maar 3 getoetste uren overblijven. Het ensemble gaf ook om 15 en 16 u nog regen (46–48 leden) terwijl het al droog was: de vierde dag met regen in het ensemble op droge uren (na 8, 12 en 13 november).

De checkperiode is klaar; de taak `regen-iconen-check` kan uit. Bij het KNMI ontbreken 18 en 19 november nog; zolang de taak aan staat, voegt hij die toe.

### Aanvulling na 16 dagen (21 november 2026)

De taak liep op 21 november nog een keer en voegde 18 november toe, een grijze dag met zes THIN_SUN-uren. **Het voorstel blijft `THIN_SUN = [0.65, 0.90]`** (25/41 tegen 21/41 voor het huidige paar), de 30/70-grenzen blijven staan.

- **Ondergrens 0,70 haalt 0,65 in.** 18 nov 11 u (k_model 0,67 onder 75 % lage bewolking, werkelijk bewolkt) is het eerste uur in de band 0,65–0,70 dat voor 0,70 pleit; 7 nov 10 u (0,66, terecht dunne bewolking) pleit voor 0,65. Opgeteld staan 0,65/0,90 en 0,70/0,90 nu gelijk op 25/41, en bij ECMWF wint 0,70 één uur (55/91 tegen 54/91). Dat is één uur tegen één uur: geen reden om het voorstel te wijzigen, wel om 0,70 als gelijkwaardig alternatief te noemen.
- **Het idee uit de conclusie krijgt steun: de ondergrens hangt af van de lagen.** De bewolkte uren in de band 0,60–0,70 hadden lage bewolking waar het is nagekeken (7 nov 9 u 31 %, 8 nov 12 u 72 %, nu 18 nov 11 u 75 %; 11 nov 13 u en 15 nov 10 u niet uitgesplitst), de dunne-bewolkingsuren in die band alleen hoge (4 nov 13 u) of een opklaring (7 nov 10 u). Een ondergrens van 0,70 bij veel lage bewolking en 0,65 daarbuiten had allebei goed gehad. Nog steeds een idee om apart te proberen.
- **HARMONIE had de bewolking deze dag goed (0 van 9 uren verkeerd)**; de twee fouten zitten in de straling onder het dek (13 u: k_model 0,75 bij k_sat 0,40, net als 15 nov 11 en 12 u). Het ensemble gaf voor de vijfde dag regen op droge uren.

De checkperiode is klaar; de taak `regen-iconen-check` kan uit. Bij het KNMI ontbreken 19 en 20 november nog; zolang de taak aan staat, voegt hij die toe.
