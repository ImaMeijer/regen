# Verificatie per aanlooptijd: spin-up (F7) en temperatuur HARMONIE vs ICON-D2

Twee vragen uit de audit van 1 november 2026:
1. **F7, spin-up:** geeft HARMONIE in de eerste uren van een run structureel te veel (of te weinig) neerslag? De verificatie van 31 oktober zag verwacht ÷ gemeten 1,2–2,1 op de kortste aanlooptijd, maar mat niets tussen 1 en 24 uur.
2. **Temperatuur:** is ICON-D2 echt beter dan HARMONIE? De app gebruikt sinds de verificatie van 31 oktober ICON-D2 voor temperatuur (`TEMP_MODEL` in app.js); dit toetst die keuze op meer data, per aanlooptijd, overdag en 's nachts.

De taak `regen-aanlooptijd-check` vult dit bestand: per run een regel onder Logboek en een nieuwe Lopende stand (altijd de laatste sectie).

**Script en ruwe data:** `C:\Users\ImaMeijer\Documents\Brain\Prive\Regenapp\verificatie\aanlooptijd\aanlooptijd.py`, met alle opgehaalde runs en waarnemingen in `data\` ernaast, zodat elke maat later opnieuw te berekenen is.

**Wat het script doet**
- Modelruns uit de single-runs-API van Open-Meteo: HARMONIE (`knmi_harmonie_arome_netherlands`) en ICON-D2 (`icon_d2`), elke run van 00, 03, … 21 UTC, aanlooptijd 1–48 uur, op 9 KNMI-stations (De Kooy, Schiphol, De Bilt, Leeuwarden, Eelde, Twenthe, Vlissingen, Eindhoven, Maastricht). Het archief begint rond 20 april 2026.
- Waarnemingen: KNMI-uurgegevens, neerslag RH (−1 = spoor telt als 0) en temperatuur T. Uur H = periode (H−1, H] UT.
- Alleen paren waarin beide modellen (zelfde run, zelfde aanlooptijd) en de waarneming een waarde hebben. Zo vergelijken de modellen op exact dezelfde momenten.
- Neerslag: verwacht ÷ gemeten per aanlooptijd en de verhouding natte uren (≥ 0,1 mm). **Spin-up-indicator** = ratio op korte aanlooptijd ÷ ratio op 25–48 u (het model ten opzichte van zichzelf een dag later).
- Temperatuur: bias en MAE per aanlooptijd, verschil H − I met 95%-BI.
- Betrouwbaarheidsintervallen: blok-bootstrap per station-dag (1000 keer).

**Wat de app werkelijk toont (bepaalt welke aanlooptijden ertoe doen)**
- Een HARMONIE-run staat volgens de metadata van Open-Meteo pas ~2,6 uur na de starttijd klaar. Het uur "nu" in de app heeft dus al ~3 uur aanlooptijd, en de radar-nowcast dekt de 2 uur daarna. **Voor de app tellen aanlooptijden van ongeveer 3–9 uur**, niet 0–1 uur.
- Temperatuur toont de app tot 48 uur vooruit.

**Beperkingen**
- HARMONIE draait elk uur en de app neemt de nieuwste run, maar het archief bewaart alleen de runs van elke 3 uur. Spin-up hangt van de aanlooptijd af, niet van het startuur, dus de meting is bruikbaar; dat de tussenliggende runs zich hetzelfde gedragen is wel een aanname.
- Puntverificatie op 9 stations tegen een gridcel; neerslag per uur is een lastige maat (één bui kan een maand kleuren). Kijk daarom naar het totaal én per maand.
- De Open-Meteo-limiet (5000 aanroepen per uur, 10.000 per dag; een verzoek met 9 stations telt als 9) begrenst hoe snel de terugblik binnenkomt: ~30 dagen per run.

**Beslisregels**
- **F7 bevestigd** als de spin-up-indicator van HARMONIE op 4–6 u of 7–9 u meer dan 15 % van 1 afwijkt, het 95%-BI 1 uitsluit en het in de meeste maanden dezelfde kant op wijst. Anders: niet bevestigd voor wat de app toont. Aanlooptijd 1–3 u wordt gerapporteerd maar telt voor de app nauwelijks.
- **ICON-D2 blijft het temperatuurmodel** als het verschil in MAE (H − I) op de aanlooptijden 1–48 u significant positief is. Is HARMONIE in een seizoen, deel van de dag of aanlooptijdklasse significant beter, dan staat dat in de conclusie.

---

## Logboek

- **21 november 2026 (opzet):** script geschreven, getest op 16–19 november en terugblik gestart vanaf 22 april. Na 26 dagen stopte die op de uurlimiet van Open-Meteo; de taak werkt de rest af (~30 dagen per run, klaar rond 27 november). Stand hieronder: 30 dagen (eind april, mei, 16–19 november). Voorlopig, want zomer en herfst ontbreken nog.

---

## Lopende stand

_Voorlopig, 30 dagen. Bijgewerkt op 21 november 2026._

- **Spin-up (F7): voorlopig niet bevestigd.** HARMONIE geeft in de eerste 12 uur van de runs van elke 3 uur niet méér regen dan een dag later. De indicator ligt op 0,89–0,94 (BI's rond 0,8–1,05). Alleen 10–12 u wijkt net significant af, en dan naar mínder regen. ICON-D2 gedraagt zich vrijwel hetzelfde. De ratio's per maand springen nog alle kanten op (april: 9 dagen met weinig regen).
- **Waarom dit afwijkt van "1,2–2,1" uit oktober:** die meting kwam uit de runs die elk uur draaien, op aanlooptijd 0–1 uur, in vier andere maanden. Hier zitten alleen de runs van elke 3 uur, vanaf 1 uur. Of het verschil door de runs van elk uur, door het seizoen of door aanlooptijd 0 komt, is nog niet te zeggen.
- **Temperatuur: ICON-D2 is op elke aanlooptijd significant beter.** MAE 0,64–0,95 °C tegen 1,03–1,26 °C voor HARMONIE, overdag en 's nachts. HARMONIE is +0,5 tot +0,65 °C te warm. Ook met die bias eraf blijft HARMONIE duidelijk slechter (RMSE 1,31–1,59 tegen 0,88–1,27). De keuze voor ICON-D2 in de app staat voorlopig.

Periode 2026-04-22 t/m 2026-11-19: 30 dagen, 270 station-dagen, 9 stations. Paren: elk uur dat beide modellen (zelfde run, zelfde aanlooptijd) en de KNMI-waarneming hebben.

### Neerslag per aanlooptijd (verwacht ÷ gemeten; 1,00 = zuiver)

| Aanlooptijd | Paren | Gemeten natte uren | HARMONIE ratio (95%-BI) | ICON-D2 ratio (95%-BI) | HARMONIE natte uren ÷ gemeten | ICON-D2 natte uren ÷ gemeten |
|---|---|---|---|---|---|---|
| 1–3 u | 6399 | 779 | 1,11 (0,97 – 1,26) | 1,05 (0,94 – 1,16) | 1,24 | 1,25 |
| 4–6 u | 6399 | 783 | 1,08 (0,94 – 1,24) | 1,10 (0,96 – 1,25) | 1,27 | 1,25 |
| 7–9 u | 6399 | 792 | 1,08 (0,96 – 1,22) | 1,05 (0,93 – 1,18) | 1,27 | 1,21 |
| 10–12 u | 6399 | 803 | 1,05 (0,93 – 1,20) | 1,02 (0,90 – 1,15) | 1,27 | 1,21 |
| 13–24 u | 25596 | 3237 | 1,11 (1,00 – 1,25) | 0,93 (0,83 – 1,03) | 1,31 | 1,16 |
| 25–48 u | 51192 | 6372 | 1,19 (1,06 – 1,34) | 1,11 (0,98 – 1,28) | 1,34 | 1,28 |

### Spin-up-indicator: ratio op korte aanlooptijd ÷ ratio op 25–48 u

Boven 1: het model geeft vlak na de start relatief meer regen dan een dag later; onder 1: minder. Het BI sluit 1 uit = significant.

| Aanlooptijd | HARMONIE (95%-BI) | ICON-D2 (95%-BI) |
|---|---|---|
| 1–3 u | 0,94 (0,82 – 1,06) | 0,94 (0,83 – 1,06) |
| 4–6 u | 0,91 (0,80 – 1,03) | 0,99 (0,89 – 1,10) |
| 7–9 u | 0,91 (0,80 – 1,02) | 0,94 (0,84 – 1,05) |
| 10–12 u | 0,89 (0,78 – 0,99) | 0,91 (0,80 – 1,03) |
| 13–24 u | 0,94 (0,86 – 1,01) | 0,83 (0,75 – 0,90) |

### HARMONIE-neerslag per uur aanlooptijd (ratio verwacht ÷ gemeten)

| Model | 1 u | 2 u | 3 u | 4 u | 5 u | 6 u | 7 u | 8 u | 9 u | 10 u | 11 u | 12 u |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| HARMONIE | 1,11 | 1,12 | 1,10 | 1,06 | 1,04 | 1,13 | 1,11 | 1,09 | 1,03 | 1,04 | 1,00 | 1,12 |
| ICON-D2 | 1,02 | 1,10 | 1,02 | 1,11 | 1,09 | 1,09 | 1,04 | 1,04 | 1,07 | 0,98 | 1,08 | 0,98 |

Runs zijn er om de 3 uur; aanlooptijd 1, 4, 7 en 10 u is dus steeds het uur na de start van een run om 00, 03, ... UTC +1 u, enzovoort. Per uur is de steekproef een derde van die per klasse.

### Temperatuur per aanlooptijd

| Aanlooptijd | Paren | HARMONIE bias | ICON-D2 bias | HARMONIE MAE | ICON-D2 MAE | Verschil MAE H − I (95%-BI) | Oordeel |
|---|---|---|---|---|---|---|---|
| 1–3 u | 6399 | 0,51 | −0,04 | 1,03 | 0,64 | 0,39 (0,33 – 0,44) | ICON-D2 beter |
| 4–6 u | 6399 | 0,52 | −0,08 | 1,07 | 0,71 | 0,36 (0,30 – 0,42) | ICON-D2 beter |
| 7–9 u | 6399 | 0,55 | −0,11 | 1,10 | 0,74 | 0,36 (0,30 – 0,42) | ICON-D2 beter |
| 10–12 u | 6399 | 0,57 | −0,12 | 1,11 | 0,75 | 0,35 (0,29 – 0,42) | ICON-D2 beter |
| 13–24 u | 25596 | 0,62 | −0,11 | 1,13 | 0,80 | 0,33 (0,27 – 0,40) | ICON-D2 beter |
| 25–48 u | 51192 | 0,65 | −0,00 | 1,26 | 0,95 | 0,31 (0,24 – 0,39) | ICON-D2 beter |

HARMONIE met zijn gemiddelde bias per aanlooptijd eraf (in-sample, dus een bovengrens van wat een vaste correctie oplevert):

1–3 u: RMSE 1,41 → 1,31 (ICON-D2 0,88); 4–6 u: RMSE 1,46 → 1,37 (ICON-D2 0,98); 7–9 u: RMSE 1,49 → 1,38 (ICON-D2 1,00); 10–12 u: RMSE 1,50 → 1,38 (ICON-D2 1,01); 13–24 u: RMSE 1,53 → 1,40 (ICON-D2 1,07); 25–48 u: RMSE 1,71 → 1,59 (ICON-D2 1,27).

### Temperatuur overdag en ’s nachts (aanlooptijd 1–48 u)

| Deel | HARMONIE bias | ICON-D2 bias | HARMONIE MAE | ICON-D2 MAE | Verschil H − I (95%-BI) |
|---|---|---|---|---|---|
| overdag (7–16 UTC) | 0,62 | −0,13 | 1,21 | 0,84 | 0,37 (0,28 – 0,47) |
| nacht | 0,61 | 0,01 | 1,16 | 0,86 | 0,30 (0,24 – 0,36) |

### Per maand

| Maand | Dagen | H-ratio 1–3 u | H-ratio 4–6 u | H-ratio 25–48 u | I-ratio 4–6 u | Temp-MAE H (1–48 u) | Temp-MAE I | Bias H | Bias I |
|---|---|---|---|---|---|---|---|---|---|
| 2026-04 | 9 | 0,64 | 1,18 | 0,41 | 2,82 | 1,23 | 0,82 | 0,89 | −0,27 |
| 2026-05 | 17 | 1,20 | 1,08 | 1,25 | 1,17 | 1,26 | 0,91 | 0,61 | 0,02 |
| 2026-11 | 4 | 1,02 | 1,08 | 1,12 | 1,02 | 0,79 | 0,68 | 0,01 | 0,15 |

