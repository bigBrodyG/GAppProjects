// dati mock per l'app — strutture base

Map<String, String> utenti = {
  'sfornari14': 'studente123',
  'dollari': 'docente123',
};

Map<String, Map<String, String>> infoUtenti = {
  'sfornari14': {'nome': 'Giordano Fornari', 'ruolo': 'studente', 'classe': '4C'},
  'dollari': {'nome': 'Prof. Della Giustina', 'ruolo': 'docente', 'classe': '—'},
};

// orario: giorno -> ora -> materia
Map<String, List<String>> orario4C = {
  'lunedì':    ['matematica', 'inglese', 'informatica', 'storia', 'fisica'],
  'martedì':   ['italiano', 'informatica', 'sistemi', 'mate', 'motoria'],
  'mercoledì': ['inglese', 'telecom', 'telecom', 'storia', 'religione'],
  'giovedì':   ['sistemi', 'informatica', 'italiano', 'mate', 'fisica'],
  'venerdì':   ['informatica', 'informatica', 'inglese', 'mate', 'italiano'],
  'sabato':    ['—', '—', '—', '—', '—'],
};

List<Map<String, String>> rubrica = [
  {'nome': 'Prof. Della Giustina', 'materia': 'Informatica', 'email': 'dellagiustina@itisda.gov.it'},
  {'nome': 'Prof.ssa Rossi',       'materia': 'Matematica',  'email': 'rossi@itisda.gov.it'},
  {'nome': 'Prof. Bianchi',        'materia': 'Sistemi',     'email': 'bianchi@itisda.gov.it'},
  {'nome': 'Prof.ssa Verdi',       'materia': 'Italiano',    'email': 'verdi@itisda.gov.it'},
  {'nome': 'Prof. Neri',           'materia': 'Inglese',     'email': 'neri@itisda.gov.it'},
];

List<String> ore = ['1ª (8:00)', '2ª (9:00)', '3ª (10:00)', '4ª (11:00)', '5ª (12:00)'];
