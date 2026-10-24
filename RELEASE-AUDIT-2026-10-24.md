# Arena — verifica prima della Mainnet, 24 ottobre 2026

## Esito

Verificata e corretta la versione **Giulexhubtest / Pi Testnet**. Nessun rilascio Mainnet e nessun pagamento reale sono stati eseguiti. Il controllo riguarda Pi Network, la rete integrata da Arena; non certifica integrazioni Binance/BNB Chain.

**La simulazione Daily non è pronta per l'attivazione di premi in Pi reali.** Il superamento dei test non costituisce approvazione del Pi Core Team né certificazione legale.

## Correzioni incluse

- Eliminati avviso sul disservizio del 20 ottobre, relativo selettore, stile e script.
- Recupero ricevute consentito solo dopo autenticazione Pi e verifica del proprietario. Il callback SDK mette in coda le ricevute durante il login; il server le recupera con il nuovo access token prima di rileggere Premium e crediti.
- Controlli iniziali e finali su identificativo ricevuta, proprietario, rete, direzione, prodotto, memo, importo e txid. Nessuna assegnazione senza completamento e verifica della transazione. Una ricevuta che cambia dati durante il processo viene rifiutata.
- Sessioni Arena invalide o scadute restituiscono 401. Le mosse Daily richiedono giorno, ID del tentativo e versione dello stato; il reset richiede il tentativo attuale prima di spendere un ticket.
- Intestazioni CSP, nosniff, Referrer-Policy e Permissions-Policy per il sito Testnet, compatibili con gli origin Pi previsti.
- Informative Testnet aggiornate per ticket presenza, classifica simulata, conservazione dei dati e assenza di pagamenti premio.

## Prove eseguite

| Ambito | Evidenza | Esito |
|---|---|---|
| Build | Parsing script HTML, API, moduli e configurazione JSON | Superato |
| Daily | Stato sul server, doppio tap concorrente, ID tentativo, ripristino dopo timeout e cambio UTC | Superato |
| Classic | Salvataggi, ripresa carte, passaggi di livello, punteggi settimanali e compatibilità storica | Superato |
| Acquisti | Proprietario, rete, prezzo/prodotto/memo, cambi di ricevuta o transazione, stati non verificati, errori upstream | Superato con API Pi simulate |
| Recupero | Callback SDK prima del token, autenticazione successiva, errore temporaneo e nuovo tentativo, rilettura benefici | Superato in DOM simulato |
| Crediti | Lua su Redis reale, chiamate concorrenti e perdita della risposta senza doppio accredito | Superato |
| Presenza | Sette giorni UTC, concorrenza, reset dopo assenza, conservazione crediti | Superato |
| Daily settimanale | Solo tentativo originale gratuito, esclusione Replay, ordine, limite 3 simulato e chiusura settimana | Superato |
| Classic medaglie | Premio precedente accanto al nome nella nuova Top 10; storico ed ex aequo conservati | Superato |
| PvP | Ricerca/cancellazione, duello già iniziato e isolamento Testnet | Superato |
| Sessioni | Firma manomessa e payload contraffatto rifiutati; scadenza trattata come 401 | Superato |
| Interfaccia | Otto lingue, conferma prima del wallet, prezzi Testnet, zoom e collegamenti assistenza | Superato in DOM simulato |
| Erogazioni | Endpoint A2U risponde 410 e non crea pagamenti | Superato |

I test Redis usano un processo locale Redis 7.2.5, senza dati di produzione. Le prove DOM non sono una prova su telefono/Pi Browser né un trasferimento blockchain.

Comandi riproducibili:

```
npm run check:build
REDIS_TEST_SERVER=/percorso/redis-server npm test
JSDOM_MODULE_PATH=/percorso/jsdom npm run test:ui
```

Il modulo jsdom usato nella verifica è 30.1.3, installato in un ambiente di test separato; non è una nuova dipendenza del sito distribuito.

## Confronto con i requisiti Pi

L'architettura verificata usa SDK Pi, verifica /me sul backend, transazioni solo Pi/Test-Pi, chiavi del server non incluse nel browser e conferma server prima dell'assegnazione del prodotto. Gli acquisti Testnet restano Premium 1 Test-Pi e Replay 0.1 Test-Pi, con ID prodotto e namespace Redis Testnet separati. La Mainnet attuale usa Premium 1 Pi, Replay 0.5 Pi e prodotti Mainnet: non devono essere sovrascritti con la configurazione Testnet.

Fonti ufficiali consultate:

- https://pi-apps.github.io/community-developer-guide/docs/gettingStarted/mainnetListingRequirements/
- https://developers.minepi.com/docs/api-reference/PlatformAPI/
- https://developers.minepi.com/docs/api-reference/SdkReference

Lo stato KYC/listing del Developer Portal, le condizioni specifiche applicabili alla nuova promozione e le credenziali/configurazioni effettive non sono stati certificati da questa verifica. Non sono stati letti o esportati segreti di produzione.

## Punti da chiudere prima di premi reali

1. **Inquadramento legale.** La FAQ 30 del MIMIT, documento gennaio 2023 tuttora reperibile sul sito ministeriale, dichiara non ammissibili premi in criptovaluta nelle manifestazioni a premio perché equiparati al denaro. Va verificato da un professionista se e come questa disciplina si applica all'iniziativa Arena e ai territori coinvolti. Non è corretto dichiarare il progetto conforme solo perché il premio è piccolo o il gioco è gratuito/di abilità.
   Fonte: https://www.mimit.gov.it/images/stories/documenti/FAQ_a_gennaio_2023.pdf
2. **Pi Network.** Verifica delle condizioni del Developer Portal e dell'ammissibilità della promozione. Le sole regole di listing non autorizzano automaticamente premi.
3. **Pagamenti A2U.** Non implementati: servono eventuali regole approvate, registro dei pagamenti idempotente, controllo del budget, verifica del destinatario, gestione errori e prove Testnet end-to-end. Il presente rilascio mantiene le erogazioni disabilitate.
4. **Abusi e vincitori.** La Daily verifica mosse e punteggio sul server, ma questo da solo non impedisce solver automatici, multi-account o collusione. Servono criteri di ammissibilità e controlli prima di assegnare premi reali. Il Classic mantiene punteggi calcolati sul client e riconoscimenti cosmetici, senza premi monetari.
5. **Regolamento e informative Mainnet.** Oggi i testi Mainnet dichiarano assenza di premi in Pi. Prima di un cambiamento effettivo devono descrivere durata, budget, partecipazione, pari merito, esclusioni, consegna e trattamento dei dati realmente approvati.
6. **Prova su dispositivo.** Da eseguire con il proprietario in Pi Browser/Testnet: login nuovo e di ritorno, acquisto annullato, acquisto Premium, acquisto Replay e consumo, chiusura app/rete interrotta dopo il pagamento, riapertura e recupero senza doppio accredito. Nessuna passphrase o chiave privata va condivisa in chat.
7. **Passaggio Mainnet.** Preparare il diff separato mantenendo utenti, dati storici, wallet, importi, prodotti e namespace Mainnet. Backup e percorso di rollback da verificare prima del rilascio. Nessuna promozione automatica è autorizzata da questo report.

## Decisione di rilascio

- Testnet con avviso rimosso e protezioni rafforzate: verificabile e pubblicabile.
- Mainnet con funzionalità di gioco non monetarie: valutabile dopo la prova dispositivo e il controllo del diff di migrazione.
- Mainnet con premi in Pi: **non approvata da questo audit**, in attesa dei punti sopra.
