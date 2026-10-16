// Server error messages in the UI languages. The client sends its chosen
// language as Accept-Language; English is the fallback (and is used in logs).
const MESSAGES = {
  en: {
    gsRequired: 'EPS/PostScript requires Ghostscript. Install it (https://ghostscript.com) or set its path via the GS_PATH environment variable.',
    gsFailed: 'Ghostscript could not convert the file: {detail}',
    pdfUnreadable: 'Could not read the PDF: {detail}',
    noPages: 'The document has no pages.',
    invalidSvg: 'Not a valid SVG file (no <svg> element found).',
    unsupportedType: 'File type ".{ext}" is not supported. Allowed: {allowed}',
    aiNotPdf: 'AI file without PDF compatibility. Re-save it in Illustrator with "Create PDF Compatible File" enabled.',
    unknownContent: 'Could not detect the file content.',
    tooComplex: 'Graphic too complex for an SVG preview.',
    missingAssets: 'Missing graphic data for: {list}. Re-open the project file or upload the graphic again.',
    invalidBanner: 'Invalid banner data.',
    pageTooLarge: 'The PDF page would exceed 5.08 m (PDF limit). Reduce the output size.',
    gsRequiredPrint: 'CMYK / text outlines require Ghostscript on the server.',
    gsPostFailed: 'Ghostscript post-processing failed: {detail}',
    noFile: 'No file received in field "file".',
    invalidProject: 'Invalid project data.',
    bannerTooLarge: 'Banner data too large.',
    fileTooLarge: 'File too large (max. {mb} MB).',
    internal: 'Internal server error.',
  },
  de: {
    gsRequired: 'EPS/PostScript benötigt Ghostscript. Bitte installieren (https://ghostscript.com) oder den Pfad über die Umgebungsvariable GS_PATH setzen.',
    gsFailed: 'Ghostscript konnte die Datei nicht umwandeln: {detail}',
    pdfUnreadable: 'Das PDF konnte nicht gelesen werden: {detail}',
    noPages: 'Das Dokument enthält keine Seiten.',
    invalidSvg: 'Keine gültige SVG-Datei (kein <svg>-Element gefunden).',
    unsupportedType: 'Dateityp «.{ext}» wird nicht unterstützt. Erlaubt: {allowed}',
    aiNotPdf: 'AI-Datei ohne PDF-Kompatibilität. Bitte in Illustrator mit «PDF-kompatible Datei erstellen» neu speichern.',
    unknownContent: 'Der Dateiinhalt konnte nicht erkannt werden.',
    tooComplex: 'Grafik zu komplex für eine SVG-Vorschau.',
    missingAssets: 'Grafikdaten fehlen für: {list}. Bitte die Projektdatei erneut öffnen oder die Grafik neu hochladen.',
    invalidBanner: 'Ungültige Banner-Daten.',
    pageTooLarge: 'Die PDF-Seite wäre grösser als 5,08 m (PDF-Grenze). Bitte die Ausgabegrösse verkleinern.',
    gsRequiredPrint: 'CMYK und Text in Pfade benötigen Ghostscript auf dem Server.',
    gsPostFailed: 'Ghostscript-Nachbearbeitung fehlgeschlagen: {detail}',
    noFile: 'Keine Datei im Feld «file» erhalten.',
    invalidProject: 'Ungültige Projektdaten.',
    bannerTooLarge: 'Banner-Daten zu gross.',
    fileTooLarge: 'Datei zu gross (max. {mb} MB).',
    internal: 'Interner Serverfehler.',
  },
  fr: {
    gsRequired: 'EPS/PostScript nécessite Ghostscript. Installez-le (https://ghostscript.com) ou indiquez son chemin via la variable d’environnement GS_PATH.',
    gsFailed: 'Ghostscript n’a pas pu convertir le fichier : {detail}',
    pdfUnreadable: 'Impossible de lire le PDF : {detail}',
    noPages: 'Le document ne contient aucune page.',
    invalidSvg: 'Fichier SVG non valide (aucun élément <svg> trouvé).',
    unsupportedType: 'Le type de fichier « .{ext} » n’est pas pris en charge. Autorisés : {allowed}',
    aiNotPdf: 'Fichier AI sans compatibilité PDF. Réenregistrez-le dans Illustrator avec l’option « Créer un fichier compatible PDF ».',
    unknownContent: 'Impossible de reconnaître le contenu du fichier.',
    tooComplex: 'Graphique trop complexe pour un aperçu SVG.',
    missingAssets: 'Données graphiques manquantes pour : {list}. Rouvrez le fichier de projet ou importez à nouveau le graphique.',
    invalidBanner: 'Données de bannière non valides.',
    pageTooLarge: 'La page PDF dépasserait 5,08 m (limite du format PDF). Réduisez la taille de sortie.',
    gsRequiredPrint: 'La conversion CMJN et la vectorisation du texte nécessitent Ghostscript sur le serveur.',
    gsPostFailed: 'Échec du post-traitement Ghostscript : {detail}',
    noFile: 'Aucun fichier reçu dans le champ « file ».',
    invalidProject: 'Données de projet non valides.',
    bannerTooLarge: 'Données de bannière trop volumineuses.',
    fileTooLarge: 'Fichier trop volumineux (max. {mb} Mo).',
    internal: 'Erreur interne du serveur.',
  },
  it: {
    gsRequired: 'EPS/PostScript richiede Ghostscript. Installarlo (https://ghostscript.com) o indicarne il percorso con la variabile d’ambiente GS_PATH.',
    gsFailed: 'Ghostscript non è riuscito a convertire il file: {detail}',
    pdfUnreadable: 'Impossibile leggere il PDF: {detail}',
    noPages: 'Il documento non contiene pagine.',
    invalidSvg: 'File SVG non valido (nessun elemento <svg> trovato).',
    unsupportedType: 'Il tipo di file «.{ext}» non è supportato. Consentiti: {allowed}',
    aiNotPdf: 'File AI senza compatibilità PDF. Salvarlo di nuovo in Illustrator con l’opzione «Crea file compatibile PDF».',
    unknownContent: 'Impossibile riconoscere il contenuto del file.',
    tooComplex: 'Grafica troppo complessa per un’anteprima SVG.',
    missingAssets: 'Dati grafici mancanti per: {list}. Riaprire il file di progetto o caricare di nuovo la grafica.',
    invalidBanner: 'Dati del banner non validi.',
    pageTooLarge: 'La pagina PDF supererebbe 5,08 m (limite del formato PDF). Ridurre le dimensioni di uscita.',
    gsRequiredPrint: 'La conversione in CMYK e la vettorializzazione del testo richiedono Ghostscript sul server.',
    gsPostFailed: 'Post-elaborazione con Ghostscript non riuscita: {detail}',
    noFile: 'Nessun file ricevuto nel campo «file».',
    invalidProject: 'Dati di progetto non validi.',
    bannerTooLarge: 'Dati del banner troppo grandi.',
    fileTooLarge: 'File troppo grande (max. {mb} MB).',
    internal: 'Errore interno del server.',
  },
}

export function pickLang(header) {
  for (const part of String(header || '').split(',')) {
    const code = part.trim().slice(0, 2).toLowerCase()
    if (MESSAGES[code]) return code
  }
  return 'en'
}

export function msg(lang, key, params = {}) {
  const s = MESSAGES[lang]?.[key] ?? MESSAGES.en[key] ?? key
  return s.replace(/\{(\w+)\}/g, (m, p) => (params[p] ?? m))
}
