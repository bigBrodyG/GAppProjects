// dati per scholtree

// ── utenti ──
Map<String, String> utenti = {
  'sfornari14': 'Scuola2026!',
};

Map<String, Map<String, String>> infoUtenti = {
  'sfornari14': {
    'nome': 'Giordano Fornari',
    'ruolo': 'studente',
    'classe': '4C INF',
  },
};

// ── giorni e ore ──
const List<String> giorni = [
  'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'
];

const List<String> ore = [
  '8:00',
  '9:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
];

// ── orario 4c inf (Valido dal 16/03/2026) ──
const Map<String, List<String>> orario = {
  'lunedì': [
    'INGLESE',
    'TELECOMUNICAZ',
    'INFORMATICA',
    'INFORMATICA',
    'INFORMATICA',
    '',
    '',
  ],
  'martedì': [
    'LETTERE',
    'TELECOMUNICAZ',
    'TELECOMUNICAZ',
    'MATEMATICA',
    'INGLESE',
    '',
    '',
  ],
  'mercoledì': [
    'MATEMATICA',
    'MATEMATICA',
    'LETTERE',
    'LETTERE',
    'INGLESE',
    '',
    '',
  ],
  'giovedì': [
    'INFORMATICA',
    'INFORMATICA',
    'INFORMATICA',
    'T.D.P.',
    'LETTERE',
    'ED. MOTORIA',
    'ED. MOTORIA',
  ],
  'venerdì': [
    'SISTEMI INF',
    'SISTEMI INF',
    'MATEMATICA',
    'T.D.P.',
    'T.D.P.',
    '',
    '',
  ],
  'sabato': [
    'LETTERE',
    'LETTERE',
    'RELIGIONE',
    'SISTEMI INF',
    'SISTEMI INF',
    '',
    '',
  ],
  'domenica': [
    '',
    '',
    '',
    '',
    '',
    '',
    '',
  ],
};
// ── prof della 4c inf (quelli veri) ──
List<Map<String, String>> prof = [
  {
    'nome': 'Alberto Paganuzzi',
    'mat': 'INFORMATICA',
    'mail': 'alberto.paganuzzi@itis.pr.it',
    'username': 'dpaganuz',
    'creazione_account': '2002-02-20',
  },
  {
    'nome': 'Maurizio Mercuri',
    'mat': 'INFORMATICA',
    'mail': 'maurizio.mercuri@itis.pr.it',
    'username': 'dMERCURI',
    'creazione_account': '2015-09-16',
  },
  {
    'nome': 'Ramon Ugolotti',
    'mat': 'SISTEMI INF',
    'mail': 'ramon.ugolotti@itis.pr.it',
    'username': 'dUGOLOTT',
    'creazione_account': '2017-09-11',
  },
  {
    'nome': 'Orienzo Vescovi',
    'mat': 'SISTEMI INF',
    'mail': 'orienzo.vescovi@itis.pr.it',
    'username': 'dvescovi',
    'creazione_account': '2014-12-06',
  },
  {
    'nome': 'Maria Cinzia Di Stefano',
    'mat': 'INGLESE',
    'mail': 'mariacinzia.distefano@itis.pr.it',
    'username': 'dDISTEFA',
    'creazione_account': '2023-09-08',
  },
  {
    'nome': 'Monica Franciosi',
    'mat': 'TELECOMUNICAZ',
    'mail': 'monica.franciosi@itis.pr.it',
    'username': 'dFRANCIO',
    'creazione_account': '2024-09-11',
  },
  {
    'nome': 'Ugo Cesarano',
    'mat': 'TELECOMUNICAZ',
    'mail': 'ugo.cesarano@itis.pr.it',
    'username': 'dCESARAN',
    'creazione_account': '2025-09-08',
  },
  {
    'nome': 'Cristina Prandi',
    'mat': 'MATEMATICA',
    'mail': 'cristina.prandi@itis.pr.it',
    'username': 'dPRANDI',
    'creazione_account': '2016-09-07',
  },
  {
    'nome': 'Rossella Granelli',
    'mat': 'LETTERE',
    'mail': 'rossella.granelli@itis.pr.it',
    'username': 'dGRANELL',
    'creazione_account': '2022-09-12',
  },
  {
    'nome': 'Danilo Folli',
    'mat': 'T.D.P.',
    'mail': 'danilo.folli@itis.pr.it',
    'username': 'dfolli',
    'creazione_account': '2025-11-28',
  },
  {
    'nome': 'Carlo Cafferata',
    'mat': 'T.D.P.',
    'mail': 'carlo.cafferata@itis.pr.it',
    'username': 'dCAFFERA',
    'creazione_account': '2011-09-22',
  },
  {
    'nome': 'Silvana Romano',
    'mat': 'ED. MOTORIA',
    'mail': 'silvana.romano@itis.pr.it',
    'username': 'dROMANO2',
    'creazione_account': '2025-09-05',
  },
  {
    'nome': 'Claudio Evangelista',
    'mat': 'RELIGIONE',
    'mail': 'claudio.evangelista@itis.pr.it',
    'username': 'dEVANGEL',
    'creazione_account': '2012-10-18',
  },
];