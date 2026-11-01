# Regen · prototype

Smartphone-prototype van een buienapp op basis van fijnmazige weermodellen. Drie bestanden, geen build-stap:

- `index.html` – schermopbouw, tabbar, locatiepaneel
- `app.css` – ontwerp (licht en donker, telefoonkader op desktop)
- `app.js` – datalaag, grafiekmotor, vier tabs, zelftests

## Starten

Open `index.html` via een lokale webserver (bijvoorbeeld `..\buienalarm\serve.ps1 -Root .. -Port 8765` en dan `http://localhost:8765/regenapp/`). Rechtstreeks openen als bestand werkt in Chrome ook, omdat beide API's externe aanroepen toestaan.

Zelftests: `index.html?test=1` toont een paneel met 22 tests (parsen, vergelijkingslogica, schaalverdeling, grafiekmotor). Donker thema forceren: `?theme=dark`.

## Databronnen

| Laag | Bron | Resolutie | Horizon |
|---|---|---|---|
| Nowcast neerslag | Buienradar raintext (radar) | 5 min | 2 uur |
| Hoofdmodel | KNMI UWC-West HARMONIE-AROME Cy43, NL-domein | 2 km, per uur | ±58 uur |
| Vergelijking | DWD ICON-D2 | 2,2 km, per uur | ±48 uur |
| Vergelijking | Météo-France AROME France HD | 1,5 km, per uur | ±48 uur |

Modellen komen via Open-Meteo in één aanroep (`models=knmi_harmonie_arome_netherlands,icon_d2,meteofrance_arome_france_hd`). Open-Meteo is gratis voor niet-commercieel gebruik; de data zelf is CC BY 4.0.

## Wetenschappelijke keuzes

- **Neerslag per uur is een som over het voorafgaande uur.** Open-Meteo labelt de waarde op het eind van het uur; de app verschuift de staaf naar het begin, zodat "14:00" betekent 14:00–15:00. De eerste staaf is het lopende uur.
- **Radarwaarden zijn intensiteiten** (mm/u op dat moment). De som over 2 uur is Σ intensiteit / 12.
- **Raintext-formule:** mm/u = 10^((waarde − 109) / 32); 0 betekent droog.
- **Geen kansen.** Alle drie de modellen zijn deterministisch. Een kans vereist een ensemble.
- **Toepasbaarheid per locatie:** een model telt mee als het vanaf nu minstens 12 uur met waarden levert. Buiten zijn domein geeft Open-Meteo `null`.
- **Afwijking tussen modellen (regen-tab):** vergeleken over maximaal 48 uur.
  - *Hoeveelheid:* som verschilt ≥ 1 mm én verhouding ≥ 1,5.
  - *Timing:* ≥ 0,5 mm in een uur waar het andere model in dat uur en beide buururen < 0,1 mm geeft. Een bui die één uur verschoven is, geeft dus geen melding.
- **AROME levert geen totale bewolking.** Die wordt afgeleid uit laag/midden/hoog met random overlap: 1 − (1−L)(1−M)(1−H), en zo gemarkeerd in de legenda.
- **Windrichting** is meteorologisch (waar de wind vandaan komt); de pijlen in de grafiek wijzen waar de wind heen waait. Beaufort volgt uit de uursnelheid in km/u.
- **Tijdzone:** Buienradar levert Nederlandse tijd zonder zone-aanduiding; de browser wordt in Nederlandse tijd verondersteld.

## Ontwerp

Apple-achtige opbouw: grote titel, kaarten, segmented control, onderste tabbar met blur, locatie als bottom sheet. Grafieken volgen vaste regels: één y-as, dunne staven met 2 px tussenruimte en ronde top, legenda zodra er twee reeksen zijn, één direct label op de piek, tekst nooit in de reekskleur. Modelkleuren zijn vast: HARMONIE blauw, ICON-D2 oranje, AROME groen (kleurenblind-veilig gevalideerde set).

## Zon en schemer

De achtergrond van elke grafiek volgt de zonshoogte, lokaal berekend met het NOAA-algoritme (Meeus) voor de gekozen locatie; er is geen extra API nodig. Kleurverloop per zonshoogte: dag boven +8°, gouden uur rond de horizon, dan burgerlijke (tot −6°), nautische (tot −12°) en astronomische schemer (tot −18°), daarna nacht. Zonsopkomst en -ondergang (−0,833°, met refractie) staan als zonnetjes boven de grafiek; de regel onder de titel geeft op, onder en de burgerlijke schemer van vandaag. De tooltip noemt de fase en de zonshoogte.

Controle: de berekende tijden voor Amsterdam, Groningen en Maastricht liggen binnen 3 minuten van de Open-Meteo-waarden voor 31 oktober 2026 (zelftest). De tests bewaken ook dat de burgerlijke schemer in juni langer is dan in oktober (op 52° NB is de schemer het langst rond midzomer en het kortst rond de equinoxen) en dat de daglengte juni > oktober > december is.

## Verificatie (map `verificatie/`)

`fetch.sh` haalt uitgegeven verwachtingen uit het Open-Meteo-archief (HARMONIE NL, ICON-D2, AROME HD) en KNMI-uurwaarnemingen (RH, DR, T, FH) voor negen stations; `index.html` + `verify.js` berekenen de scores in de browser. Opzet: vier seizoensperiodes van 30 dagen (nov 2025, jan, apr, jul 2026) op kortste aanlooptijd, plus de laatste 92 dagen op 0–24 u én 24–48 u vooruit. Scores: MAE/bias per uur en per dagsom, correlatie, trefkans/loos alarm/ETS strikt en met ±1 uur tolerantie, temperatuur- en wind-MAE. Significantie via blok-bootstrap per station-dag (1000 herhalingen, 95%-BI) op het verschil met HARMONIE.

Conclusies (31 oktober 2026):
- **Kortste aanlooptijd is oneerlijk voor HARMONIE-neerslag:** het archief bevat van het uurlijks draaiende HARMONIE vrijwel alleen de eerste uren van elke run, met spin-up-neerslag (verwacht ÷ gemeten 1,2–2,1 in deel A, maar 1,05 op 24–48 u).
- **24–48 u vooruit (de horizon van de app):** HARMONIE heeft de kleinste dagsomfout (6,0 mm tegen 9,0–9,1 mm) en de beste regen-ja/nee-score; het verschil met AROME is significant, met ICON-D2 niet. ICON-D2 verslechtert het snelst met aanlooptijd.
- **Temperatuur:** HARMONIE heeft een warme bias (+0,3 tot +0,6 °C) en een significant grotere fout dan ICON-D2 en AROME bij elke aanlooptijd. Voor de temperatuurtab is ICON-D2 het beste model.
- **Wind:** verschillen klein (0,85–1,0 m/s); ICON-D2 iets te zwak, AROME iets te sterk.
- **Zomerbuien (jul 2026):** alle modellen zwak (ETS ±1 u ≈ 0,15 strikt); ICON-D2 gaf maar 38% van de gemeten hoeveelheid, AROME 127%.

## Zoomen op de tijdschaal

De 2,5-daagse grafieken delen één horizon-instelling: "nu t/m x uur vooruit". Het begin staat altijd op het huidige uur; zoomen verandert alleen het einde. Instellen kan met twee vingers op een grafiek (knijpen = uitzoomen, uit elkaar = inzoomen), met ctrl+scroll of trackpad-pinch op desktop, of met de presets 12 u · 24 u · 48 u · Alles. Bereik 6 uur tot de modelhorizon. De keuze wordt in `localStorage` bewaard (`regen.horizon`) en is de volgende keer de standaard.

## Installeren op je telefoon

De app is statisch: zet de map `regenapp/` op een HTTPS-host (GitHub Pages, Cloudflare Pages, Netlify) en open de link in Safari of Chrome. Kies "Zet op beginscherm". `manifest.json` zorgt voor naam, icoon (`icon.svg`) en schermvullende weergave; `sw.js` cachet de app-schil en het laatste API-antwoord, zodat de app zonder netwerk opent met de laatst opgehaalde data. De service worker registreert alleen op HTTPS. iOS gebruikt geen SVG als beginschermicoon en valt terug op een schermafbeelding; voor een strak icoon op iPhone is een 180×180 PNG als `apple-touch-icon` nodig. Bij een nieuwe versie: verhoog `CACHE` in `sw.js`.

Open-Meteo is gratis voor niet-commercieel gebruik tot 10.000 aanroepen per dag; een paar gebruikers die elke 5 minuten verversen blijven daar ruim onder.

## Zonnetjes met weer

De zonnetjes bij zonsopkomst en -ondergang tonen het HARMONIE-weer van dat moment: bewolking van het dichtstbijzijnde uur en neerslag van het lopende uur. Vier varianten: helder (alleen zon), half bewolkt (30–70% bedekking, kleine wolk), bewolkt (≥ 70%, wolk voor de zon) en regen (≥ 0,1 mm in dat uur, wolk met vallende druppels). De zon komt eenmalig op van achter een horizonlijntje of zakt er deels achter; bij "verminder beweging" staat alles stil. De titel van het glyph (lang indrukken) noemt tijd en weerwoord.

## Ensemble (kans en spreiding)

Sinds versie 4 toont de app geen vergelijking met ICON-D2 en AROME meer. In plaats daarvan komt de onzekerheid uit het ICON-D2-ensemble (DWD, 20 leden, 2,2 km, ±48 uur) via de Open-Meteo ensemble-API:

- **Regen:** een aparte grafiek "Kans op regen" onder de HARMONIE-staven: per uur het aandeel leden met ≥ 0,1 mm in dat uur. De tooltip van de HARMONIE-staaf noemt diezelfde kans; de hero-tegel ook.
- **Temperatuur, wind, bewolking:** een 10–90%-band van de leden achter de HARMONIE-lijn, met de bandbreedte in de tooltip.
- HARMONIE blijft de verwachting; het ensemble zegt alleen hoe zeker die is. Beide bronnen staan in de legenda en voettekst. Zodra er een backend is, kan hier het KNMI HARMONIE-ensemble onder (zelfde interface).

Technisch: `parseEnsemble` leest `precipitation`, `precipitation_member01…` enzovoort, kapt af waar minder dan 5 leden data hebben, en koppelt de neerslag aan het begin van het uur, net als HARMONIE. Bij één model in de aanvraag laat Open-Meteo de modelnaam uit de veldnamen weg; `parseForecast` valt daarop terug.

## Zoom en tijdas

Knijpen tekent de grafieken in place opnieuw (de bezig-aanraking blijft op hetzelfde element via pointer capture), zodat je kunt blijven knijpen; pas bij loslaten wordt het hele scherm ververst en de keuze opgeslagen. De tijdas kiest de labelstap (1, 2, 3, 6 of 12 uur) zo dat labels minstens 44 px uit elkaar staan, met verticale stippellijnen op elk label; middernacht houdt zijn eigen daglijn.

## Versie 5: metingen, kanslijn, nu-label, grijze bewolking

- **Actuele meting in de hero-tegels.** Temperatuur en wind komen van het dichtstbijzijnde KNMI-station met temperatuurmeting, via de Buienradar-feed (`data.buienradar.nl/2.0/feed/json`, 10-minutenwaarden, CORS open). De tegel noemt meettijd, station en afstand, en daarnaast de HARMONIE-waarde van dit uur. Kuststations zonder temperatuur (IJmuiden, Texelhors, Houtribdijk, Wijdenes, Rotterdam Geulhaven) worden overgeslagen. De KNMI EDR-API is niet bruikbaar vanuit de browser (anonieme sleutel geweigerd).
- **Kans op regen** staat nu in dezelfde kaart als de HARMONIE-staven, als lage sub-grafiek (92 px) met dezelfde tijdas en zoom: een vloeiende lijn via monotone kubieke interpolatie (Fritsch–Carlson, geen overshoot), elk uurpunt in het midden van zijn uur.
- **Nu-label.** Onder de gestippelde nu-lijn staat de huidige tijd vet; reguliere tijdlabels binnen 30 px ervan vervallen (op de 2-uurs grafiek ≈ 12 minuten, op 48 uur ≈ 2 uur). Het "nu"-label bovenin is weg.
- **Bewolking in grijs.** De bedekkingslijn kleurt langs zijn lengte van lichtgrijs (0%) naar donkergrijs (100%) (in donker thema omgekeerd), met grijs vlak en grijze ensembleband. Bovendien trekt bewolking in álle grafieken de dagtint 70 % naar grijs, zodat een bewolkte dag grijs is en een heldere dag warm; de nacht blijft onveranderd.

## Versie 7: overzicht, boom, info, scrub, 48 uur

- **Overzicht-tab** (tweede tab): temperatuur per uur als staven, gekleurd van blauw (koud) via amber naar rood (warm), met boven elk uur een weericoontje (zon of maan, half bewolkt, bewolkt, regen) uit dezelfde regels als de zonnetjes; 's nachts een maan. Daaronder een lage neerslaggrafiek met dezelfde tijdas. Icoontjes worden uitgedund als er minder dan 18 px per uur is.
- **Boom op de windpagina**, onder de pijlen: zwaai-amplitude, scheefstand en zwaaiperiode per Beaufort (KNMI-tabel "uitwerking op land"), leunend in de richting waarheen de wind waait; vanaf 5 Bft vliegen bladeren weg. Standaard de gemeten wind van nu; sleep over de grafiek en de boom toont het uur onder je vinger.
- **Info-pagina** als verborgen tab (knop onderaan elke pagina), met alles over werking, bronnen, leesinstructie, de Beaufort-tabel en licenties. Modelnamen zijn uit de gewone schermen verdwenen: daar staat "verwacht", "gemeten", "kans op regen" en "onzekerheid".
- **Schuiven met de vinger**: de stippellijn volgt je vinger, met de tijd eronder; botsende tijdlabels verdwijnen; gekoppelde grafieken in dezelfde kaart bewegen mee; na loslaten springt de lijn na 1,8 s terug naar nu. Oorzaak van de oude bug: de knijp-handler nam elke aanraking in beslag (pointer capture), ook met één vinger; nu pas bij de tweede vinger.
- **Maximaal 48 uur** vooruit; presets 6 / 12 / 24 / 48 u; de tegel "Tot horizon" is weg.

## Versie 8: temperatuurlijn, boompjesrij, nieuwe boom met rook

- **Overzicht:** temperatuur als vloeiende lijn met vlak, gekleurd langs de lijn (blauw → amber → rood). Tussen de temperatuurgrafiek en de neerslag een rij boompjes die de wind van dat uur tonen: één per weericoontje als er minstens 26 px tussen zit, anders één per twee icoontjes.
- **Boommodel** (één SVG-model, groot op de windpagina en klein in de rij): gebogen stam, vijf takken, lancetvormige blaadjes in twee groentinten aan de toppen en halverwege de takken. Stam en takken zwaaien met amplitude en tempo per Beaufort, de boom leunt naar de kant waarheen de wind waait, en vanaf 5 Bft vliegen blaadjes weg.
- **Rook** op de windpagina: een schoorsteentje met pluim die bij windstilte recht omhoog gaat en met meer wind steeds platter wegwaait in de windrichting, naar de KNMI-omschrijving voor 0 en 1 Bft.

## Versie 9: zachtere lijnen, cartoonboom met windveld, boompjes per wolkje

- **Lijnen:** temperatuur, gevoelstemperatuur, wind en windstoten gebruiken nu een Catmull-Rom-spline (spanning 0,5): zachter dan de monotone interpolatie, met een klein beetje overshoot dat als natuurlijke curve leest. De kanslijn houdt de monotone variant, zodat die nooit buiten 0–100% komt.
- **Boom:** bruine stam en takken met donkere rand; blaadjes als druppelvorm met nerf in twee groentinten, aan de toppen en halverwege de takken. Plaatsing en animatie zitten in gescheiden groepen (de CSS-animatie overschreef anders de SVG-transform). Ook bij windstilte een minimale beweging van 0,5°, zodat de boom nooit bevriest. Bij regen in dat uur vallen druppels schuin met de wind mee.
- **Windveld** op de windpagina in plaats van rook: zestien streken die in de windrichting stromen, met snelheid, lengte en dekking die oplopen met Beaufort; wind naar het noorden (van de kijker af) laat ze licht stijgen, naar het zuiden licht dalen.
- **Boompjesrij** in het overzicht: onder elk weericoontje een boompje op dezelfde uren, geschaald naar de ruimte (0,2–0,3), met regen waar het regent.
