# Regen · prototype

Smartphone-prototype van een buienapp op basis van fijnmazige weermodellen. Drie bestanden, geen build-stap:

- `index.html` – schermopbouw, tabbar, locatiepaneel
- `app.css` – ontwerp (licht en donker, telefoonkader op desktop)
- `app.js` – datalaag, grafiekmotor, vier tabs, zelftests

## Starten

Open `index.html` via een lokale webserver (bijvoorbeeld `..\buienalarm\serve.ps1 -Root .. -Port 8765` en dan `http://localhost:8765/regenapp/`). Rechtstreeks openen als bestand werkt in Chrome ook, omdat beide API's externe aanroepen toestaan.

Zelftests: `index.html?test=1` toont een paneel met alle zelftests (56 bij versie 14). Donker thema forceren: `?theme=dark`.

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

De 2,5-daagse grafieken delen één horizon-instelling: "nu t/m x uur vooruit". Het begin staat altijd op het huidige uur; zoomen verandert alleen het einde. Instellen kan met twee vingers op een grafiek (knijpen = uitzoomen, uit elkaar = inzoomen) of met ctrl+scroll of trackpad-pinch op desktop. Er zijn geen knoppen meer (sinds versie 18); de kaarttitel ("Komende 24 uur") laat zien hoeveel uur je ziet. Bereik 6 uur tot de modelhorizon. De keuze wordt in `localStorage` bewaard (`regen.horizon`) en is de volgende keer de standaard.

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

## Versie 10: windveld in 3D, scènes in het overzicht, minder tekst

- **Windveld** rekent nu met de volledige windvector. Oost/west is links/rechts; het noord/zuid-deel wordt diepte: wind naar de kijker toe (uit het noorden) komt van boven, beweegt omlaag en wordt groter; wind van de kijker af (uit het zuiden) begint laag, beweegt omhoog en krimpt. Elke streek is langs zijn eigen bewegingsrichting gedraaid en begint een halve reis stroomopwaarts van zijn strooipunt.
- **Overzicht:** onder de wolkjes staan nu dezelfde scènes als op de windpagina (boom + windveld + regen) als geneste SVG's van 40–56 px, op de uren van de wolkjes, zo veel als er met minstens 44 px tussenruimte passen (meestal één per twee wolkjes).
- **Tekst:** alle uitleg onder titels en onder de zoomknoppen is weg, en de legenda van het overzicht ook; de info-pagina legt alles uit. Zoompresets: 12, 24, 48 uur. De tegel van het overzicht gebruikt hetzelfde wolkje als Regen en Bewolking.

## Versie 11: boom van schuin boven

De boom wordt nu van iets boven bekeken: een ronde kruin van zes uitwaaierende takken met blaadjes, een korte stam naar de stamvoet en een schaduw op de grond. Daarmee valt het kompas samen met het scherm: noord is omhoog, oost is rechts (noord-zuid iets verkort, factor 0,6). Wind schuift de kruin van de voet af in de richting waarheen hij waait; de stam volgt de kruin. De streken van het windveld stromen in dezelfde schermrichting zonder diepte-truc; regen is te zien als spattende druppels op de grond. Een kompasje rechtsboven markeert het noorden. Dezelfde scène staat verkleind onder de wolkjes in het overzicht.

## Versie 12: icoontjes

Het tab-icoontje van Overzicht gebruikt onderin hetzelfde wolkje als Bewolking, verkleind, zonder de uitstulping linksonder. De tegel bovenin het overzicht toont het weerbeeld van nu met dezelfde icoontjes als de uurrij (zon of maan, half bewolkt, bewolkt, regen).

## Versie 13: eerlijkere kop, temperatuur uit ICON-D2, verouderde data zichtbaar

Eerste ronde verbeteringen na de audit van 1 november 2026.

- **Eerstvolgende neerslag:** eerst de radar, ook het slot waar je nu in zit ("Nu"). Na het radarvenster telt een modeluur alleen als nat bij minstens 0,2 mm (0,1 mm is spoortjes) én een ensemblekans van minstens 30 %; een uur dat de radar half dekt telt vanaf het einde van de radar. Anders "Droog" t/m 48 uur vooruit, met de hoogste kans in die periode. Voorheen pakte de kop het eerste uur met 0,1 mm, ook binnen het droge radarvenster en ook bij een kans van 0 %.
- **Kansen** staan overal op dezelfde manier: in stappen van 5 % (twintig leden), met "< 5%" en "> 95%" in plaats van 0 % en 100 %.
- **Temperatuur uit ICON-D2** (DWD, via Open-Meteo), op Temperatuur en Overzicht. In de eigen verificatie was HARMONIE +0,3 tot +0,6 °C te warm en significant slechter. De band komt uit het ICON-D2-ensemble en hoort nu bij hetzelfde model als de lijn; valt ICON-D2 weg, dan toont de app HARMONIE zonder band. Neerslag, wind en bewolking blijven HARMONIE.
- **Verouderde data:** de service worker cachet alleen nog de app-schil. Elke databron wordt na een geslaagde aanroep met ophaaltijd in `localStorage` bewaard (`regen.data.*`); zonder verbinding toont de app die kopie met een melding "Geen verbinding. Je ziet de gegevens van …" en in de kop "offline · gegevens van …". Radarslots die voorbij zijn en stationsmetingen van meer dan een uur oud worden weggelaten. Bij terugkeer van de verbinding ververst de app meteen.
- **Middernacht:** raintext-regels krijgen de dag die het dichtst bij het ophaalmoment ligt. Een reeks die om 23:55 begint terwijl het al 00:02 is, belandde eerst een dag later.
- **Wisselen van plaats** tijdens het laden: een trager antwoord van de vorige plaats overschrijft de nieuwe niet meer.
- **Radar in de uurgrafiek:** de uren die de radar dekt halen hun neerslag uit de radar (intensiteit × 5 min over het overlappende deel), het uur waarin de radar stopt vult de rest pro rata aan met het model, en van het lopende uur telt alleen wat nog komt. Dat geldt overal: staven, tabel, tegels 24 u / 48 u, weericoontjes, boompjes en de kop. Voor uren die de radar helemaal dekt staat er geen kans en begint de kanslijn pas na de radar. Zo kan de uurgrafiek nooit regen tonen waar de radar droog is.
- **Wind bij de boom per Beaufort:** vaste tabellen in plaats van lineaire formules. Windveld: 0 Bft geen streken, vanaf 1 Bft 8 vage, trage streken (genoeg om de richting te lezen), vanaf 5 Bft alle 16, en daarna steeds langer, dikker (tot 3) en sneller. Blaadjes hebben een eigen uitslag en tempo, naar de KNMI-omschrijvingen: bijna stil bij 0–1 Bft (±1–2°), ritselen bij 2 Bft (±5°, snel), en daarna steeds wijder en sneller (±20° bij 5 Bft, ±32° bij 7 Bft, ±42° bij 9 Bft). Dezelfde tabellen sturen de kleine scènes in Overzicht.
- **Verouderd-melding:** een bewaarde kopie van minder dan 10 minuten oud telt als actueel, zodat één haperende bron geen alarm geeft. Faalt alles, dan staat er "Geen verbinding"; faalt een deel, dan "Niet alles kon worden bijgewerkt".
- **Dagstrook gelijkgetrokken:** op alle tabbladen staan de dagnamen op dezelfde hoogte (14 px) met direct daaronder één rij: de weericoontjes in Overzicht, de zonnetjes bij op- en ondergang op de andere tabbladen (32 px), en de grafiek begint op 46 px. In Overzicht scheelt dat 20 px lege ruimte; daar is de temperatuurgrafiek bovendien 240 px hoog in plaats van 210, waardoor het plotvlak groeit van 58 naar 108 px.
- Zelftests: 56.

## Versie 14: kop alleen op HARMONIE, geen oude radar meer

- **Eerstvolgende neerslag** beslist alleen nog op HARMONIE: na het radarvenster is het eerste uur met minstens 0,5 mm de eerstvolgende neerslag (gemeten aan de staaf zoals je die in de uurgrafiek ziet). De ensemblekans staat er nog bij, maar beslist niet meer. Voorheen kon een lage ICON-kans een duidelijk nat HARMONIE-uur wegfilteren, waardoor er "Droog" stond boven een grafiek met regen. Onder de drempel staat er "geen regen van betekenis … · hooguit x mm" met het natste uur.
- **Geen oude radar meer:** een bewaarde radarkopie wordt nog maar tot 30 minuten oud gebruikt (was 2 uur). Bij het heropenen van de app op de telefoon faalde soms de eerste aanroep; dan bleef van een oude kopie na het weglaten van wat voorbij was een stompje van een kwartier over, en kwam het uur daarna in de uurgrafiek grotendeels uit HARMONIE terwijl "Komende 2 uur" droog leek.
- **Snel opnieuw proberen:** faalt een bron, dan probeert de app het na 30 seconden opnieuw in plaats van na 5 minuten.
- **Tekst bij een korte radarreeks:** "Droog tot 20:15" in plaats van "Droog in de komende 2 uur" als de radar minder dan ongeveer 2 uur dekt.
- **Lopend uur vóór de radar:** begint de radar precies op het hele uur, dan hield het lopende uur eerst de volle HARMONIE-waarde. Nu telt dat uur als voorbij (0, bron radar).
- **As van de uurgrafiek** heet nu "mm" in plaats van "mm/u": de staven zijn hoeveelheden per uur, de radar toont intensiteit. Een bui van een kwartier van 0,4 mm/u is in de uurgrafiek 0,1 mm.
- **Radarregen nooit weg:** de drempel van 0,05 mm geldt alleen nog voor het modeldeel na de radar; regen die de radar toont blijft in de uurstaaf staan, hoe weinig ook. Elke staaf groter dan 0 is minstens 2 px hoog, en hoeveelheden onder 0,05 mm heten "< 0,1" in plaats van "0,0".
- Zelftests: 56 (twee kop-tests herschreven voor de nieuwe regel).

## Versie 15: weerbeeld overdag uit de zon, gladdere bewolking

- **Weerbeeld overdag uit de zon:** HARMONIE geeft bewolking als momentopname van één vakje van 2 km op het hele uur. Bij losse stapelwolken springt die per uur tussen 0 en 100%, en één wolkje op het hele uur maakte zo een zonnig uur "bewolkt" (2 nov: 100% bewolking om 09:00 terwijl het model zelf volop zon rekende, en de satelliet de hele ochtend 80–95% van een heldere hemel gaf). Nu haalt de app ook `shortwave_radiation` op, een uurgemiddelde, en deelt die door de straling bij een heldere hemel (Haurwitz, gemiddeld over het uur, met de zonsstand uit de app). 0,9 daarvan of meer telt als 0% bedekking, 0,3 of minder als 100% (satelliet haalt bij heldere hemel ≈ 0,9). Dit bepaalt overdag de weericoontjes, de tegel, de zonnetjes en de grijstint van de lucht. Onder ongeveer 6° zonshoogte en 's nachts beslist de bewolking.
- **Bewolking gladgemaakt:** elk uur van totaal, laag, midden en hoog is een gewogen gemiddelde 1-2-1 met het uur ervoor en erna. 0/100/0 wordt zo 50% (half bewolkt) in plaats van een zaagtand. Een verkeerd model (zoals 1 nov, toen HARMONIE de lage bewolking vasthield en ICON-D2 wel klopte) lost dit niet op; daarvoor is verificatie tegen de satelliet nodig.
- **Tegel volgt de metingen:** de tegel zei "Gemeten 15:00 · Schiphol · bewolkt", maar alleen de temperatuur was gemeten; het woord kwam uit HARMONIE, dat het wolkenveld van de avond te vroeg liet komen terwijl Schiphol "vrijwel onbewolkt" meldde. Nu komt het weerbeeld van nu uit de stations: per station `sunpower` (10-minutengemiddelde) gedeeld door de straling bij een heldere hemel in die 10 minuten, met dezelfde schaal als hierboven, gewogen met 1/afstand over de stations binnen 40 km. Dat middelt over de ruimte wat de feed niet over de tijd geeft (er zit geen historie in). Op 2 nov 14:55 lag dat bij heldere stations op 1,0 en bij bewolkte op 0,2–0,4, in lijn met hun omschrijving; om 13:30 meldde Schiphol "zwaar bewolkt" bij 1,2× een heldere hemel (zon tussen stapelwolken), wat de straling terecht zonnig noemt. Regen komt uit de omschrijving of het lopende uur (met radar). Bij lage zon en 's nachts telt de omschrijving van het dichtstbijzijnde station; zonder meting het model.
- Zelftests: 62 (nieuw: gladmaken, zon %, overzicht volgt de zon, stationsbedekking, omschrijving, tegel).

## Versie 16: verouderd-melding noemt de bron

- **Melding zegt wat verouderd is:** bij een haperende bron stond er "Niet alles kon worden bijgewerkt. Een deel van wat je ziet is van 15:11." (2 nov: de verwachtings-API van Open-Meteo gaf `503 The service is overloaded`, de rest was vers). Nu noemt de melding de bron: "De verwachting kon niet worden bijgewerkt en is van 15:11.", bij meer bronnen "De verwachting en de radar konden …", met per bron een tijd als die verschillen. De ondertitel zegt bij één bron "verwachting van 15:11" in plaats van "deels verouderd". Bronnen: verwachting, kans en onzekerheidsband, radar, metingen. Zonder verbinding blijft "Geen verbinding".
- Zelftests: 63.

## Versie 17: ontbrekende waarden breken geen tabel meer

- **Temperatuur-tab:** ICON-D2 levert voor de laatste uren van zijn run geen gevoelstemperatuur. De tabel liep daarop vast (`fmtNum(null)`), waardoor de tabel ontbrak en er een fout in de console kwam. `fmtNum` toont een ontbrekende waarde nu als "–"; dat geldt voor alle tabellen en tooltips.
- Zelftests: 63.

## Versie 18: elke tab past op één iPhone-scherm

- **Geen zoomknoppen meer:** de balk "Vooruit · 48 u · t/m za 17:00" met 12 u · 24 u · 48 u is weg; zoomen gaat met twee vingers op een grafiek. De kaarttitel ("Komende 24 uur") loopt mee tijdens het knijpen.
- **Info-knop in de kop:** "Info en bronnen" stond onderaan elke tab en kostte de ruimte die een tab nodig had. Het is nu een i-icoontje rechts naast de plaatsnaam.
- **Ruimte onder de inhoud** is precies de tabbalk plus 8 px, zodat een tab die past niet meer een stukje scrolt.
- **Wind:** de legenda staat op één regel ("Wind", "Stoten", onzekerheid; de pijlen staan uitgelegd onder Info), de kop noemt geen graden meer (die staan in tabel en tooltip), de boom is 120 px en de grafiek 200 px.
- **Temperatuur en Bewolking** gebruiken de vrijgekomen ruimte: grafiek 260 px.
- **Tab wisselen begint bovenaan.** Het scherm scrolt soepel (`scroll-behavior: smooth`); bij een tabwissel begon die animatie naar boven, waarna het opnieuw opbouwen de halve scrollpositie terugzette. Nu springt het scherm direct naar boven.
- Gemeten op 393 × 852 (iPhone 15/16) met de veilige marges van de iPhone nagebootst: Overzicht, Temperatuur, Wind en Bewolking passen zonder scrollen. Regen scrolt nog, zoals bedoeld.
- Zelftests: 64.

## Versie 19: Overzicht wordt de week, als in Apple Weer; de uurpagina heet Per uur

- **Overzicht toont nu de komende zeven dagen** (eerst als aparte tab Week gebouwd, daarna de plaats van Overzicht gegeven):  per dag een rij als in Apple Weer: dagnaam ("Vandaag", "Vr", …), weericoontje met daaronder een druppel en de kans op een natte dag (vanaf 10%), laagste temperatuur, een balk van laagste naar hoogste temperatuur op de schaal van alle getoonde dagen, en hoogste temperatuur. Op de rij van vandaag staat een stip op de temperatuur van nu (de meting, anders ICON-D2).
- **Uurstrook bovenaan Overzicht**, als in Apple Weer: per uur dagnaam of uur ("Nu", "18", … en om middernacht "Vr"), icoontje (de regels van de uurrij op Per uur: HARMONIE, zon % overdag, maan 's nachts) en temperatuur van ICON-D2, zo lang ICON-D2 reikt en hoogstens 48 uur. "Nu" gebruikt net als de tegel op Per uur de metingen (`nowKind`, stationstemperatuur). Horizontaal te vegen.
- **Per uur:** de vroegere Overzicht-pagina (tegel van nu, temperatuurgrafiek met weericoontjes, neerslag en boompjes) heet nu Per uur en opent met een tik op de hele uurstrook; vegen door de strook telt niet als tik. Bovenaan staat "‹ Overzicht" terug; de tab Overzicht blijft gemarkeerd (`TAB_OF`). Per uur heeft geen eigen tab en wordt niet onthouden: een herstart begint op de laatste echte tab. Een bewaarde tab "week" van tussendoor valt terug op Overzicht.
- **Regenbalk bovenin, Regen zonder tab:** bovenaan de kaart met de uren staat een smalle balk met een druppel, de tekst van de kop van Regen ("Nu regen", "Regen om 18:20", "Regen vanaf vr 14:00" of "Droog"; radar eerst, daarna HARMONIE vanaf 0,5 mm, `nextRain`) en een mini-radar: 24 staafjes van 5 minuten, hoogte met de wortel van de intensiteit zodat motregen zichtbaar blijft naast een bui. De balk schuift niet mee met de uren. Een tik opent Regen met "‹ Overzicht" terug; een tik op de uren eronder blijft Per uur openen. De Regen-tab is uit de tabbalk: vier tabs (Overzicht, Temperatuur, Wind, Bewolking), en de app opent voortaan op Overzicht (een bewaarde tab Regen valt daarop terug).
- **Dagpagina's voor vandaag en morgen:** een tik op de rij van een HARMONIE-dag opent Per uur voor alleen die dag (`renderOverview(c, day)`): de grafiek loopt van nu (vandaag) of middernacht tot de volgende middernacht, zonder zoomen (`noZoom` in `drawChart`), met icoontjes, boompjes, neerslag en tabel voor die uren. Vandaag houdt de tegel van nu; morgen krijgt een dagtegel ("Zaterdag 7 november", min tot max met icoontje, kans op regen overdag). De paginatitel is Vandaag, Morgen of de weekdag; "‹ Overzicht" gaat terug.
- **Dagpagina's voor dag 3 tot 7 (ECMWF), als de pluim:** ook de ECMWF-dagen zijn tikbaar (`renderEnsDay`). Per uur over de 51 leden (`ecmwfHours`): temperatuur als mediaan met een band waarin 90% van de leden valt (5–95%, `ENS_BAND`, de lichte band van de KNMI-pluim), neerslag per uur als middelste lijn met dezelfde 90%-band, zoals de pluim (geen staven en geen kans; de tooltip noemt alleen de band, "0,0 tot 0,4 mm", omdat de mediaan bij buien bijna altijd 0 is; `tipValue` in `drawChart`), het icoontje als mediaan van de icoontjes van de leden, de lucht grijzer met hun mediane bedekking. De boompjes krijgen de wind van de middelste run: per uur het lid waarvan de windsnelheid de mediaan is, zodat snelheid en richting bij elkaar horen. Daarvoor haalt de app nu ook `wind_speed_10m` en `wind_direction_10m` per lid op (de bewaarde kopie groeit van ongeveer 180 naar 260 kB). De kaart zegt "Lijn: de middelste van 51 ECMWF-berekeningen · band: 90% ervan"; de woorden "10–90%" staan nergens meer op deze pagina; de tabel geeft per uur de mm met de band.
- **Icoontje alleen uit de lichte uren, als mediaan:** elk uur waarvan het midden boven de horizon ligt, krijgt zijn icoontje met precies de regels van de uurrij op Per uur (zon % uit de straling van HARMONIE, anders de gladgemaakte bewolking; regen vanaf 0,1 mm). De dag krijgt de mediaan van die uren in de volgorde zonnig < half bewolkt < bewolkt < regen; bij een even aantal het gemiddelde van de twee middelste, halven naar boven. Een dag die van 8 tot 15 uur strak blauw is en in de laatste twee lichte uren dichttrekt, krijgt zo een zon, waar een gemiddelde over de dag half bewolkt zou geven.
- **Bronnen:** icoontje en neerslag uit HARMONIE, laagste en hoogste temperatuur over de hele dag uit ICON-D2 (anders HARMONIE). Vandaag telt vanaf 00:00: de verwachting wordt daarvoor een tweede keer vanaf middernacht ingelezen (`withDays`), omdat Open-Meteo de uren van vandaag die al voorbij zijn ook meestuurt.
- **Alleen hele dagen:** een dag komt uit HARMONIE als HARMONIE elk licht uur dekt en het temperatuurmodel en de neerslag alle uren. ICON-D2 rekent 48 uur vooruit, dus meestal zijn dat vandaag en morgen.
- **Daarna het ECMWF-ensemble, als de KNMI-pluim:** de pluim gebruikt het ECMWF-ensemble (51 leden, runs om 00 en 12 UTC) en toont de mediaan met een 50%- en 90%-band; temperatuur als dagmaxima en -minima. De app haalt hetzelfde ensemble op via Open-Meteo (`ecmwf_ifs025`, 0,25°, temperatuur, neerslag, bewolking en straling per lid, 8 dagen; één extra verzoek). Per lid wordt de dag met precies dezelfde regels bepaald als bij HARMONIE (per licht uur een icoontje uit zon % of de gladgemaakte bewolking en regen, de dag de mediaan; min en max over de dag). Over de 51 leden: icoontje = mediaan van hun dagicoontjes, temperatuur = mediaan van hun dagminima en -maxima, en hun 25 en 75% als vaag deel van de balk (de 50%-band van de pluim). Geen scheidingslijn tussen de modellen.
- **Kans onder het icoontje:** het deel van de leden met minstens 0,5 mm in de lichte uren van die dag (`DAY_RAIN_MM`, `isLightHour`; nachtregen telt niet mee, net als bij het icoontje), net als bij Apple vanaf 10%. Vandaag en morgen uit het ICON-D2-ensemble (20 leden, al opgehaald; de dagkans telt vanaf 00:00), daarna uit ECMWF. Zonder ensemble staat de neerslag van HARMONIE in de lichte uren in mm onder het icoontje.
- Zelftests: 74 (de Week-test controleert ook de uurstrook; nieuw: tikken op de strook opent Per uur en terug, regenbalk met mini-radar opent Regen, dagpagina voor een HARMONIE-dag en voor een ECMWF-dag; de ECMWF-test controleert ook de uurwaarden).

## Versie 20: icoontjes van de verwachting volgen de bewolking, met dunne bewolking

- **Aanleiding:** het weerbeeld per uur kwam overdag alleen uit de zon die doorkomt. Dat werkt voor de waarneming van nu, maar in de verwachting telde zo een vrijwel dichte lucht van dunne, hoge wolken als half bewolkt of zelfs zonnig (5 nov: ECMWF 95% bewolking met 67–77% van de zon van een heldere hemel), terwijl Apple en het KNMI zo'n dag bewolkt noemen.
- **Nieuwe regel (`forecastKind`), voor alle verwachte uren:** vanaf 0,1 mm regen; anders de (gladgemaakte) bewolking van het model: < 30% zonnig, 30–70% half bewolkt. Bij 70% of meer beslist de zon die doorkomt, als deel van een heldere hemel (`sunRatio`, Haurwitz): ≥ 0,85 half bewolkt (losse wolken; HARMONIE zet een vakje van 2 km bij een passerende stapelwolk op 100%), 0,60–0,85 **dunne bewolking**, < 0,60 bewolkt (`THIN_SUN`). Bij lage zon (< ~6°) en 's nachts beslissen de lagen: laag en midden < 30% en hoog ≥ 70% is dunne bewolking, anders bewolkt.
- **Nieuw icoontje dunne bewolking:** de zon (of 's nachts de maan) boven drie dunne strepen; bij zonsopkomst en -ondergang twee strepen over de zon. In de volgorde voor de mediaan: zonnig < half bewolkt < dunne bewolking < bewolkt < regen (`KIND_RANK`).
- **Overal behalve de waarneming:** uurstrook (niet "Nu"), Per uur, de dagpagina's, de dagicoontjes van HARMONIE en van elk ECMWF-lid, en de zonnetjes bij op- en ondergang. De tegel van nu en "Nu" in de strook blijven de zonmeting van de stations volgen. De grijstint van de lucht volgt nu de bewolking van het model, een sluier telt voor de helft (`tintCover`).
- **ECMWF:** haalt nu ook `cloud_cover_low`, `_mid` en `_high` per lid op (de bewaarde kopie groeit naar ongeveer 390 kB).
- **Grenzen 0,60 en 0,85 zijn een eerste schatting** op basis van 2–5 nov. Ze worden de week van 6 nov dagelijks getoetst tegen satellietstraling (Open-Meteo, EUMETSAT) en de uurwaarnemingen van Schiphol (KNMI: bewolking in achtsten, zonneschijnduur, straling); het logboek staat in `verificatie/iconen.md`.
- Zelftests: 75 (nieuw: de regel zelf en het nieuwe icoon; de HARMONIE-uurtest en de mediaantest herschreven voor vijf soorten).

## Versie 21: snelle winst uit de UX-audit (stap 1, "v20" in het stappenplan van de audit)

Uitgevoerd op de branch `ux/v20-snelle-winst`, om eerst lokaal te proberen. De audit (5 november, op v19) noemde deze stap v20; die versie was intussen al de icoontjes, dus dit is cache v21.

- **Contrast (B5):** `--label-3` licht #6e6e73 (5,1:1 op de kaart, was 3,3:1), donker #8e8e94 (5,2:1, was 3,4:1); `--label-2` donker #b0b0b8. De bedieningskleur `--tint` licht #226dc9 (5,1:1 op wit, was 4,4:1); de datakleur `--s1` blijft #2a78d6.
- **Tikdoelen en focus (B5):** locatieknop, info-knop, tabelknop, terugknop, "Gereed" en de segmenten krijgen een onzichtbaar tikvlak van minstens 44 × 44 px (`--hit`), zonder dat de opmaak verschuift. Eén focusring (`--focus-ring`) voor alles wat bedienbaar is, ook het zoekveld.
- **Regenbalk (B3):** droog is één rustige regel die zegt hoe lang ("Droog de komende 2 dagen", "… 2 uur" met alleen radar), zonder lege mini-radar. Komt er regen, dan verandert de balk van vorm: blauwe band, vette tekst en de mini-radar als de radar iets ziet. "De komende …" en niet "tot …": waar radar of model ophoudt te kijken, begint geen regen.
- **Regen-pagina (B7):** de boodschap groot ("Droog" met "de komende 2 dagen" eronder op 20 px), de hint kort ("hooguit 0,2 mm, zo 18:00–19:00"). Is de radar droog, dan toont Komende 2 uur één regel ("Droog volgens de radar · 22:18") in plaats van een leeg assenstelsel, en geen tabelknop; de grafiek komt terug zodra er een staaf te tekenen is.
- **Bewolking:** de hint noemt alleen lagen met wolken ("0% bedekt" in plaats van vier keer 0%).
- **Foutmelding in mensentaal:** zonder gegevens "De verwachting kon niet worden opgehaald. Controleer je verbinding en probeer het opnieuw." met een knop. Ook per kaart geen codes meer ("Radar is nu niet bereikbaar.", "Geen actuele radar."). De technische reden (HTTP 503 …) staat onder Info, in "Wat er niet lukte"; Info is daarvoor ook bereikbaar als er helemaal geen gegevens zijn.
- Zelftests: 77 (nieuw: hoe lang droog, regenbalk en Regen-pagina in droge staat, bewolkingshint, foutmelding en Info).

## Versie 22: het nu bovenaan, de plaats als titel (UX-audit stap 2, "v21" in het stappenplan, richting A)

Op dezelfde branch als versie 21 (`ux/v20-snelle-winst`). Keuzes van Ima: richting A; "bijgewerkt" onder de titel; de plaats als titel alleen op Overzicht; dagrijen van 44 px zodat alles op één scherm past.

- **Kop van Overzicht (B2):** de titel is de plaats ("Amsterdam ›"), en de titel zelf is de locatieknop; de blauwe plaatsknop erboven valt op Overzicht weg. Eronder "Noord-Holland · bijgewerkt 22:30" (of de verouderd-tekst). De andere pagina's houden hun eigen titel met de plaatsknop en de plaats in de regel eronder. Het tabblad van de browser heet op Overzicht "Weer · Amsterdam".
- **Zonregel:** op Overzicht vervangen door vakjes in de uurstrook; de volledige regel met schemer staat alleen nog op Per uur en de dagpagina's, niet meer op Temperatuur, Wind, Bewolking, Regen en Info.
- **Kaart van nu (B1):** temperatuur groot (48 px, licht gewicht), het icoontje en het weerbeeld van nu ernaast, daaronder op één regel "voelt als 3° · vandaag 2° tot 7° · gemeten 22:20" (het station staat in de tooltip en op Temperatuur en Wind). Vandaag is hetzelfde bereik als de rij "Vandaag" in de lijst. De regenregel is de onderste regel van deze kaart en opent Regen, zoals voorheen. Per uur houdt zijn eigen tegel.
- **Uurstrook:** "Nu" vetgedrukt; zon op en zon onder als eigen vakje na het uur waarin ze vallen (tijd, zon op de horizon met pijl, "op"/"onder"), zoals Apple Weer.
- **Eén scherm:** dagrijen 44 px (was 48), 12 px tussen de kaarten op Overzicht (was 14), de kop "Komende dagen" klein en in hoofdletters zoals in Apple Weer. Nagemeten op 393 × 852 met de marges van statusbalk (59 px) en thuisbalk (34 px): Overzicht scrollt niet.
- Zelftests: 78 (nieuw: kop, kaart van nu, zoncellen, zonregel per pagina). `hourStrip` krijgt het tijdstip van nu als parameter, zodat de test met vaste data de zoncellen kan controleren.

## Versie 22, aanvulling: Vandaag als hele dag

- Een tik op "Vandaag" in de weeklijst toont, net als bij Morgen, de hele dag van 00:00 tot 24:00, met de stippellijn op nu. Eerder begon die pagina bij het huidige uur, zodat er 's avonds nog maar een uur of twee overbleef.
- De uren vóór nu komen uit dezelfde HARMONIE- en ICON-D2-run, ingelezen vanaf middernacht (`withDays` bewaart ze als `forecast.past`, `withPast` zet ze voor het model). Het is dus wat het model voor die uren verwachtte, geen meting; de tooltip zegt dat ("verwacht, niet gemeten"). Een voetregel paste niet meer op één scherm. De luchttint gebruikt die uren ook.
- Kaarttitel "Per uur" (was "Rest van vandaag"). Zelftests: 79.

## Versie 22 (op main, parallel aan de branch): terug met een veeg vanaf de linkerrand

- **Terug-stapel (`openPage`, `goBack`, `nav.stack`):** Per uur, Regen, een dag en Info openen bovenop de pagina waar je vandaan kwam. "‹ Overzicht", de veeg en de terugknop van de browser brengen je terug naar die pagina, op de plek waar je was (Info vanaf een dag gaat dus terug naar die dag). Een tab is een beginpunt, zoals in een iPhone-app: de tabbalk begint de stapel opnieuw en op een tab is er geen terug.
- **Browsergeschiedenis:** elke geopende pagina krijgt een eigen geschiedenisregel met haar diepte. Daardoor werken ook de eigen veeg van Safari (als de app in de browser openstaat) en de terugknop van Android; `popstate` haalt alleen weg wat er boven die diepte nog op de stapel ligt, zodat onze terug en die van de browser niet dubbel tellen.
- **Vegen vanaf de linkerrand** (binnen 24 px, `SWIPE_EDGE`): de pagina gaat met je vinger mee, en eronder staat waar je naartoe gaat ("‹ Overzicht"). Voorbij 40% van de breedte of met een snelle veeg ga je terug, anders schuift de pagina terug op zijn plek. Eerst omhoog of omlaag bewegen = scrollen, geen veeg. Een grafiek waar je vinger op begint, scrubt niet mee. Alleen aan als de app op het beginscherm staat (`navigator.standalone`); in Safari doet de browser deze veeg zelf. Uitproberen in een browser kan met `?veeg=1`.
- Cache v22 (v21 is in gebruik op de branch `ux/v20-snelle-winst`).
- Zelftests: 77 (nieuw: openen en terug over twee lagen met de scrollplek en de tabbalk die opnieuw begint; de veeg: alleen vanaf de rand, scrollen is geen veeg, kort en langzaam blijft staan, snel of ver gaat terug).

## Versie 23: terug in de kop, overgangen, pijltjes, trekken om te verversen (UX-audit stap 3, "v22" in het stappenplan)

Op `ux/v20-snelle-winst`, na het mergen van main (de terug-stapel en het terugvegen van main versie 22). Keuzes van Ima: terugknop als in iOS met de grote titel eronder; een pijltje op elke dag met een eigen pagina; na verversen alleen de nieuwe tijd in de kop, geen melding.

- **Terug in de kop (B4):** op Per uur, Regen, een dag en Info staat "‹ Overzicht" (of "‹ Zondag" als je Info vanaf een dag opende) linksboven, op de plek van de plaatsknop, met de grote titel eronder. De losse regel "‹ Overzicht" tussen kop en inhoud is weg; dat scheelt ongeveer 30 px. De knop gebruikt de terug-stapel van main (`goBack`); het label is de pagina eronder, en Overzicht heet "Overzicht", niet de plaatsnaam.
- **Overgangen (B4, B10):** een pagina die opent schuift 36 px van rechts in en vervaagt in 220 ms; terug komt hij van links; een tab vervaagt in 150 ms. Kop en inhoud bewegen samen (Web Animations, geen blijvende stijl). Uit bij reduced motion, en niet na het terugvegen, dat de pagina al met de vinger heeft verplaatst.
- **Wat tikbaar is:** elke dag met een eigen pagina eindigt in een grijs pijltje (een extra kolom van 10 px; de temperatuurbalk wordt iets korter); de uurstrook vervaagt aan de rechterrand in een pijltje.
- **Trekken om te verversen (B10):** bovenaan een pagina omlaag trekken; een pijltje komt mee en slaat om bij 60 px (de helft van de vingerbeweging telt), loslaten ververst en het pijltje draait tot `load()` klaar is. Niet zijwaarts, niet omhoog, niet als de pagina gescrold is, niet tijdens de veeg of het knijpen; een grafiek waar je vinger op begint scrubt niet mee.
- **Eén scherm:** Overzicht, Per uur en Vandaag passen met de iPhone-marges. Regen (134 px) en een ECMWF-dag (34 px, door de omschrijving die over twee regels breekt) passen nog niet; dat was al zo en staat in de audit (B7, D).
- Cache v23. Zelftests: 83 (nieuw: terugknop in de kop met label, pijltjes en strookhint, trekken om te verversen; de bestaande tests zoeken de terugknop nu in de kop).

## Versie 23, aanvulling: geen pijltjes op de dagen, ECMWF-dag zonder uitlegregel

- Op verzoek van Ima: de pijltjes rechts van de dagrijen zijn weer weg (de temperatuurbalk heeft zijn breedte terug). De hint aan de rechterrand van de uurstrook blijft.
- De regel "Lijn: de middelste van 51 ECMWF-berekeningen · band: 90% ervan" boven de grafiek van een ECMWF-dag is weg; de uitleg staat onder Info. Daarmee passen alle dagpagina's op één iPhone-scherm (nagemeten met de marges van statusbalk en thuisbalk, ook als het weerbeeld over twee regels breekt).
- Regen past niet op één scherm zodra er regen in de komende 2 uur is (dan staat de radargrafiek erbij); dat blijft zo, op aanwijzing van Ima.

## Versie 24: ontwerptokens en Info als vragen (UX-audit stap 4, "v23" in het stappenplan)

Op `ux/v20-snelle-winst`. Keuzes van Ima: Info als inklapbare vragen met de bestaande tekst; 12 px tussen alle kaarten; het grote getal van een tegel 28 px vet.

- **Letterschaal (B6, E):** acht maten als tokens, naar de iOS-tekststijlen: `--t-caption` 11, `--t-foot` 13, `--t-sub` 15, `--t-body` 17, `--t-title3` 20, `--t-title1` 28, `--t-large` 34 en `--t-now` 48 (de temperatuur van nu). Weg zijn 14, 12, 11,5, 10,5 en 30: 14 werd 15 (meldingen, tooltip), 12 werd 13 (voetregels, daglabels, tooltipkop, zon op/onder), 11,5 en 10,5 werden 11 (tablabels, grafiekwaarden), 30 werd 28 (het grote getal op Temperatuur, Wind, Bewolking, Regen en de dagpagina's). Alleen het kompas in de boom houdt 7 (SVG-eenheden).
- **Hoekstralen:** `--r-chip` 8 (tooltip, segmenten), `--r-inner` 12 (velden, meldingen, rijen), `--r-card` 18 (kaarten, tegels, het blad), `--r-pill` 999. Datatekens (staven, legenda, de grijper) houden hun 2–3 px; het telefoonraam op desktop houdt 44.
- **Afstanden:** 4-pt-raster `--sp-1` t/m `--sp-6`; `--gap-card` 12 tussen alle kaarten (was 14, op Overzicht al 12); kaarten en tegels hebben 12 px binnenrand (was 14, onder 10 → 8), ook de kaart van nu en de regenregel.
- **Beweging:** `--dur-fast` 150 ms, `--dur-page` 220 ms, `--ease`; het blad, de veeg en trekken-om-te-verversen gebruiken ze, `MOTION` in app.js houdt dezelfde waarden.
- **Info (B8):** veertien korte vragen (`<details>`, dicht bij openen, werkt met toetsenbord en schermlezer zonder script), met de bestaande tekst als antwoord; daaronder een brontabel (wat · bron · hoe vaak nieuw) met de licenties in één regel, de Beaufort-tabel en de privacyzin. Een eventuele foutkaart ("Wat er niet lukte") blijft bovenaan. Info is ongeveer 3250 px korter.
- **Controle:** alle pagina's nagemeten op 393 × 852 met de marges van statusbalk en thuisbalk, voor en na: Overzicht, Per uur, alle zeven dagen, Temperatuur, Wind en Bewolking passen op één scherm; Regen loopt 20 px minder over (114 in plaats van 134, met regen in de komende 2 uur). Alle zichtbare tekst gebruikt een maat uit de schaal.
- Cache v24. Zelftests: 85 (nieuw: Info als vragen met alle tekst, brontabel en Beaufort; tokens voor tablabel, kaartafstand, kaarthoek en het grote getal, en geen lettergrootte buiten de schaal).

## Versie 25: proefversie met lucht, zin, boom en neutrale knoppen (UX-audit stap 5, verkenning)

Op `ux/v20-snelle-winst`. Keuzes van Ima: alle vier de onderdelen; de zin in plaats van de voelt-als-regel; alles achter een schakelaar om te vergelijken; de tabs Vandaag · Week · Regen (C5) nog niet.

- **Schakelaar:** onder Info, bovenaan: "Proefversie: nieuwe weergave", standaard aan, onthouden op de telefoon (`regen.proef`, `setProef`). Uit = precies de weergave van versie 24. De app zet `proef` op `<html>`; alle CSS van de proef hangt daaraan.
- **Lucht achter de kop (C2):** op Overzicht krijgt de bovenkant de tint van de lucht van nu (`skyNow`: de zonshoogte en de bewolking rond je, zoals de grafieken hun achtergrond kleuren), die overloopt in de achtergrond. Bij wisselen tussen licht en donker tekent de app opnieuw, zodat de tint bij het thema past.
- **Het weer in één zin (C1, `weatherLine`):** hooguit twee zinnen: eerst nu ("Bewolkt en droog.", "Bewolkt, vanavond regen.", "Het regent nu."), dan morgen met de hoogste temperatuur en de eerste dag erna met minstens 50% kans of een regenicoon ("Morgen zonnig tot 9°, woensdag kans op regen."), of "daarna droog" als alle latere dagen onder 20% blijven. Momenten in woorden met `whenWords` (vanmiddag, morgenochtend, zaterdagavond, in de nacht naar dinsdag). De zin vervangt de voelt-als-regel; voelt als en min/max staan op Temperatuur en in de rij Vandaag, en waar de temperatuur vandaan komt staat in de tooltip.
- **Boom in de kaart van nu (C3):** rechtsboven een kleine boom met de wind van nu (gemeten, anders het model); tikken opent Wind.
- **Bediening neutraal (B9):** plaatsknop, terugknop, info-knop, de actieve tab, links en de schakelaar in de labelkleur (zwart, in donker wit); blauw alleen nog voor neerslag en data. Het icoon in de tegels blijft blauw (data).
- **Eén scherm:** de zin is een regel langer; Overzicht wint dat in de proef terug met minder ruimte boven de titel en in de kaart van nu. Nagemeten met de iPhone-marges: Overzicht, Per uur, alle dagen, Temperatuur, Wind en Bewolking passen, met de proef aan én uit. Een heel lange zin (drie regels, bijvoorbeeld "Dunne bewolking, in de nacht naar woensdag regen. …") zou Overzicht ongeveer 20 px laten scrollen.
- Cache v25. Zelftests: 88 (nieuw: momenten in woorden, de zin, de schakelaar met zin, boom, lucht en neutrale knoppen aan en uit).

## Versie 26: proefversie definitief, windveld bij het boompje, zekerheid als één taal (UX-audit C4)

Op `ux/v20-snelle-winst`. Keuzes van Ima: de proefversie van versie 25 vast in de app; C4 met overal de band van 10–90%, de naam "8 van de 10 berekeningen", drie woorden per dag (zeker, vrij zeker, onzeker) en in de uurstrook gewoon één getal.

- **Proefversie definitief:** de schakelaar onder Info is weg, en daarmee `state.proef`, `setProef` en `:root.proef`. De lucht, de zin, het boompje en de neutrale knoppen zijn de gewone weergave; `--tint` is nu in de thema's zelf de labelkleur (zwart, in donker wit). De oude voelt-als-regel op Overzicht is weg (die staat op Temperatuur en in de rij Vandaag).
- **Windveld bij het boompje:** het boompje in de kaart van nu staat, net als op Wind, in zijn windveld (`makeWindField`, `setWindField`), binnen een afgerond vak. Op een derde van de maat krijgen de streepjes twee keer zoveel dekking en dikte, anders zie je ze bij weinig wind niet.
- **Eén band (C4):** overal waar ensembleberekeningen het oneens zijn, toont de app waar 8 van de 10 zitten (`ENS_BAND` = 10/90%): de grafieken van 48 uur (ICON-D2-ensemble, zoals al), de ECMWF-dagpagina's (was 5–95%) en het vage deel van de balk in de weeklijst (was 25–75%, dus nu breder). De legenda's heten overal "8 van de 10 berekeningen" (`BAND_NAME`), de tooltips "8 van de 10: 6° tot 9°".
- **Een woord per dag (`certainty`):** in de dagtegel achter de regen: "overdag droog · vrij zeker". Uit de breedte van de band van de hoogste temperatuur: smaller dan 2° zeker, 2 tot 4° vrij zeker, 4° of meer onzeker. ECMWF-dagen uit de dagmaxima van de leden (`mxLo`, `mxHi`); vandaag en morgen uit het ICON-D2-ensemble op het warmste uur van de dag; is dat uur voorbij (vanavond), dan geen woord. De getallen staan met één decimaal in de tooltip. 7 november 23:30: maandag en morgen zeker, dinsdag, donderdag en vrijdag vrij zeker, woensdag onzeker.
- **Info:** de vragen over de band en de zeven dagen zeggen nu "8 van de 10 berekeningen" en leggen het woord uit.
- Alle pagina's nagemeten met de iPhone-marges: alles past behalve Regen met regen in de komende 2 uur (afgesproken).
- Cache v26. Zelftests: 89 (nieuw: band, naam en woord; aangepast: de ECMWF-test op 10/90%, de test van de zin en het boompje zonder schakelaar).

## Versie 27: geen tabbalk meer; alles begint op Overzicht

Op `ux/v20-snelle-winst`. Op verzoek van Ima, in plaats van C5 (Vandaag · Week · Regen):

- **Geen tabbalk:** de balk onderaan is weg. Overzicht is het enige beginpunt; van daaruit open je Per uur (de uurstrook), Regen (de regenregel), een dag (de weeklijst), Wind (het boompje in de kaart van nu) en Info (ⓘ). Elke pagina heeft "‹ Overzicht" (of de pagina eronder) in de kop, en terugvegen werkt zoals op main. De laatst gekozen tab (`regen.tab`) wordt niet meer gebruikt: de app opent altijd op Overzicht.
- **Wind** is een gewone pagina (`SUBPAGES`), te openen via het boompje.
- **Temperatuur en Bewolking zijn weg** (`renderTemp`, `renderCloud`, `cloudHint`). Voelt als en de temperatuur van nu staan in de tegel van Per uur; bewolking zit in de icoontjes en in de grijze tint van de grafieken. In Info heet de vraag over bewolking nu "Hoe telt de app bewolking?", zonder de zin over de grijze lijn.
- **Geen pijltjes meer** bij de regenregel en aan de rand van de uurstrook.
- **Ruimte:** de pagina loopt nu door tot de thuisbalk (16 px plus de veilige marge, was 72 px voor de tabbalk); meldingen staan 24 px boven de thuisbalk. Nagemeten met de iPhone-marges: Overzicht heeft 57 px over, Per uur en de dagen 80 tot 110 px, Wind 104 px; Regen loopt met regen in de komende 2 uur nog 58 px over (was 114).
- Cache v27. Zelftests: 89 (aangepast: geen tabbalk, het boompje opent Wind, geen pijltjes, Wind in plaats van Temperatuur in de kop- en luchttests).

## Versie 28: gestapelde pagina's, zoals in een iPhone-app

Na een vergelijking van twee schermopnames (de app naast Apple Weer): openen was een harde wissel, en bij terugvegen lag er niets onder de pagina (een zwart vlak met een pilletje).

- **Pagina's liggen op elkaar (`snapPage`, `mountSnap`, `slide`):** de pagina die je verlaat blijft staan als een kopie van het scherm (`.screen.snap`, met eigen id's op `-snap`, de scrollplekken erbij, niet aan te raken). `render()` tekent nog steeds in het ene echte scherm. Openen: de nieuwe pagina schuift over de volle breedte van rechts over de vorige, die 30% naar links gaat en tot 60% dimt. Terug met de knop: de kopie van de bovenste pagina schuift naar rechts weg over de echte vorige pagina. 420 ms, `--dur-push` en `--ease-push`. Onder "verminder beweging" niets.
- **Terugvegen:** onder de pagina die je vinger volgt ligt de kopie van de vorige pagina en schuift mee; het pilletje "‹ Overzicht" is weg. Na het loslaten neemt de echte pagina de plaats van de kopie in. De kopie is van het moment van openen: is er intussen ververst, dan zie je dat pas na het loslaten.
- **Geen dubbel terugveeggebaar:** als app op het beginscherm van een iPhone houdt de app geen browsergeschiedenis meer bij (`useHistory`). iOS veegde daar zelf ook terug door de geschiedenis en liet zijn eigen plaatje van de vorige pagina zien, tegelijk met onze veeg. In een browsertab en op Android blijft de geschiedenis, voor de terugknop en de veeg van de browser; begon de veeg van Safari aan de rand, dan schuiven wij niet nog een keer.
- **Verversen dimt de pagina niet meer** (`.loading` had 60% dekking); het pijltje van trekken-om-te-verversen draait en "bijgewerkt" krijgt de nieuwe tijd.
- Cache v28. Zelftests: 89 (aangepast: bij de veeg ligt het Overzicht eronder en blijft er na afloop geen laag over).

## Versie 29: de levende lucht achter Overzicht

Op verzoek van Ima, naar het voorbeeld van Apple Weer: het weer van nu als bewegende achtergrond.

- **Eén canvas onder de pagina's (`#skyfx`, deel 4b in app.js):** de kleur van de lucht uit de zonshoogte (nacht, schemer, gouden uur, dag), grijzer naarmate het bewolkter is en donkerder bij regen en onweer. Daarop: sterren die twinkelen en af en toe een vallende ster (heldere nacht), de zon met gloed, trage stralen en lensvlekken, wolken die met de wind meedrijven (richting en snelheid van nu), regen in drie dieptes die schuin valt met de wind en opspat op de bovenrand van de kaarten, druppels op het glas die blijven hangen en met horten naar beneden lopen, sneeuw die op de kaarten blijft liggen, bliksem met een lichtflits, en mistbanken.
- **Waar het weer vandaan komt (`skyScene`):** bewolking en wind uit de meting (anders HARMONIE), regen uit de radar (anders het lopende uur), sneeuw, onweer en mist uit de omschrijving van het station of de weercode van het model.
- **Overzicht is glas (`.screen.sky`):** geen eigen achtergrond, witte tekst, kaarten die de lucht doorlaten (`backdrop-filter`). In het lichte en het donkere thema hetzelfde: de lucht bepaalt hier de kleuren. De andere pagina's zijn ongewijzigd; bij openen, terug en vegen blijft de lucht onder het Overzicht staan.
- **Zuinig:** de animatie loopt alleen zolang Overzicht in beeld is en de app zichtbaar; hooguit 2 beeldpunten per punt. Onder "verminder beweging" één stilstaand beeld. Bij hetzelfde weer verschuiven alleen de kleuren, zodat er bij verversen niets verspringt.
- **Uitproberen:** `?weer=` met `helder`, `nacht`, `avond`, `schemer`, `halfbewolkt`, `bewolkt`, `regen`, `bui`, `nachtregen`, `sneeuw`, `onweer`, `mist` of `storm` toont dat weer, wat het ook echt doet.
- Niet gemeten: de beeldsnelheid op een iPhone (het glas over een bewegende achtergrond is het zwaarste deel).
- Cache v29. Zelftests: 89 (uitgebreid: het canvas ligt onder de pagina, witte tekst op Overzicht in elk thema, luchtkleuren voor dag, regen en nacht).

## Versie 30: de lucht blijft achter elke pagina

Op verzoek van Ima: de achtergrond verdween zodra je iets opende.

- **Elke pagina is glas:** Regen, Per uur, de dagen, Wind en Info hebben geen eigen achtergrond meer; `render()` geeft het scherm op elke pagina `.sky`. Witte tekst, doorzichtige kaarten (ook `.hero` en `.stat`), het vlak van een grafiek half doorzichtig met eigen dag- en nachttinten. Het lichte thema bestaat daardoor alleen nog voor het locatieblad, de tooltip en de melding.
- **De lucht stapt terug achter een pagina met grafieken (`FX.dim`, `SKY_DIM`):** 40% donkerder (Info 50%), in een kwart seconde, zodat lijnen en cijfers leesbaar blijven; de druppels op het glas blijven ervoor. Regen spat en sneeuw ligt nu op de kaarten van elke pagina.
- **Overgangen:** de lucht blijft staan en alleen de inhoud beweegt. De nieuwe pagina schuift van rechts in, de vorige schuift 30% naar links en vervaagt helemaal (was: dimmen tot 60%); geen schaduwrand meer. Terug en terugvegen omgekeerd.
- `skyPalette` en `cloudGrey` lezen de kleuren nu van het scherm (`tokenStyle`), niet van de pagina als geheel.
- De animatie loopt nu op elke pagina zolang de app zichtbaar is.
- Cache v30. Zelftests: 89 (aangepast: de lucht blijft achter Wind, met witte tekst).

## Branch `ux/blad-van-onder`: een pagina als glazen blad van onder

Proefversie om te vergelijken met versie 30 op main (pagina's die van rechts inschuiven). Op verzoek van Ima, naar Apple Weer.

- **Blad:** elke pagina behalve Overzicht (`.screen.sheetpage`) is een blad van glas met ronde bovenhoeken en een greepje, dat van de onderrand omhoog komt (500 ms). Het blad vervaagt wat erachter ligt; de kaarten erop hebben daarom geen eigen vervaging meer.
- **Overzicht blijft erachter staan (`behindSync`, `.snap.behind`):** de kopie van het Overzicht blijft in beeld zolang er een blad open is, iets kleiner (93%) en gedimd, met de bovenkant zichtbaar boven het blad. Een blad op een blad (Info vanaf een dag) komt er op dezelfde manier overheen.
- **Sluiten:** "‹ Overzicht", of het blad omlaag slepen (vanaf elke plek, zolang het blad bovenaan staat): het volgt de vinger en het Overzicht komt mee naar voren; voorbij 28% van de hoogte of met een snelle veeg sluit het, anders veert het terug. Dit vervangt de veeg vanaf de linkerrand, en op een blad ook trekken-om-te-verversen (dat blijft op Overzicht).
- **Regen spat op de bovenrand van het blad** in plaats van op de kaarten.
- Cache v31 (op de branch `regen-v31-blad`). Zelftests: 89 (de veegtest is nu een test van het omlaag slepen).
- **QA-ronde (na feedback van Ima):**
  - Bij het omlaag slepen waren de sterren scherp door de kaarten van het Overzicht heen te zien, tot het blad beneden was. Oorzaak: het Overzicht werd gedimd met `opacity`, en een pagina die niet volledig dekkend is verliest de vervaging (`backdrop-filter`) van haar kaarten. Nu dimt een eigen laag tussen Overzicht en blad (`#scrim`); een pagina krijgt nooit meer `opacity` of `will-change: opacity`.
  - Het Overzicht verkleinde als kopie vanaf de bovenrand en als echte pagina vanuit het midden: een sprongetje bij het wisselen. Nu overal vanaf de bovenrand; de ronde hoeken van de kopie zijn weg (die verdwenen bij het wisselen ineens).
  - De plaatsnaam van het Overzicht werd door de bovenrand van het blad doormidden gesneden. De kop vervaagt nu bij het openen en komt met de vinger terug bij het slepen.
  - De lucht zelf wordt achter een blad niet meer apart gedimd (dat deed de dimlaag dubbel).
  - Regen blijft op de rand van het blad spatten terwijl het beweegt; Esc sluit een blad.

## Versie 31: het blad van onder is de keuze

Ima heeft de twee varianten naast elkaar gelegd en voor het blad gekozen: `ux/blad-van-onder` staat nu op main. De variant waarin pagina's van rechts inschuiven is bewaard op de branch `ux/van-rechts` (niet uitgerold). Cache v31.

## Versie 32: geen "‹ Overzicht" meer op een blad

Op verzoek van Ima: omlaag vegen is duidelijk genoeg, en de rij van de knop kost ruimte.

- **De rij "‹ Overzicht" is weg** op elk blad; de titel staat nu direct onder het greepje (ruim 30 px gewonnen).
- **De terugknop bestaat nog, als het greepje:** het streepje bovenaan het blad is de knop (`#backBtn`, 96 × 24 px met een raakvlak van 44 px). Een tik erop sluit het blad ook, zodat het met een muis, het toetsenbord en een schermlezer kan ("Terug naar Overzicht" als aria-label); Esc werkt ook. Icoon en woord worden niet getoond.
- Cache v32. Zelftests: 89 (ongewijzigd: de knop zit nog in de kop en zegt waarheen).

## Versie 33: volg mijn locatie, en altijd een plaatsnaam

Op verzoek van Ima: de plaats moest telkens met de hand worden aangepast.

- **Volg mijn locatie (`locate`, `hereStep`, `regen.follow`):** bovenaan het locatieblad. Staat het aan, dan vraagt de app je positie bij het openen en telkens als je naar de app terugkomt (hooguit eens per 2 minuten); een website kan je niet op de achtergrond volgen. Ben je 2 km of meer verplaatst, dan laadt het weer opnieuw; anders gebeurt er niets. Een plaats uit de zoeklijst zet het volgen uit. Achter de plaatsnaam op Overzicht staat dan een pijltje.
- **Coördinaten worden altijd een plaatsnaam (`placeName`):** in Nederland de woonplaats waar je in staat, van PDOK (de Locatieserver van het Kadaster, `type=woonplaats`); daarbuiten de stad of het dorp van BigDataCloud. Beide krijgen de positie afgerond op 3 decimalen (ongeveer 100 m). Lukt het niet, dan "Mijn locatie" en wordt de naam de volgende keer opnieuw gevraagd. Info zegt dit erbij.
- **Oude "Huidige locatie":** een plek die met de oude knop was opgeslagen (met coördinaten als naam) gaat vanaf nu volgen en krijgt een naam.
- De zelftests vragen je locatie niet.
- Cache v33. Zelftests: 90 (nieuw: plaatsnaam uit beide diensten, afronding, wanneer er opnieuw geladen wordt, pijltje en knop).
