/**
 * Los países del celular, sin librería: el prefijo sale de esta tabla y el
 * nombre en español, de `Intl.DisplayNames`, que ya trae el navegador.
 *
 * Varios países comparten prefijo (+1, +7, +44…): el primero de cada uno en la
 * tabla es el que se elige al leer un celular guardado.
 */
const DIAL_CODES = `
SV 503|GT 502|HN 504|US 1|CA 1|PR 1|DO 1|JM 1|TT 1|BS 1|BB 1|AG 1|DM 1|GD 1|KN 1|LC 1|VC 1|AI 1|
BM 1|VG 1|VI 1|KY 1|MS 1|TC 1|GU 1|MP 1|AS 1|SX 1|RU 7|KZ 7|EG 20|ZA 27|GR 30|NL 31|BE 32|FR 33|
ES 34|HU 36|IT 39|VA 39|RO 40|CH 41|AT 43|GB 44|GG 44|JE 44|IM 44|DK 45|SE 46|NO 47|SJ 47|PL 48|
DE 49|PE 51|MX 52|CU 53|AR 54|BR 55|CL 56|CO 57|VE 58|MY 60|AU 61|CX 61|CC 61|ID 62|PH 63|NZ 64|
SG 65|TH 66|JP 81|KR 82|VN 84|CN 86|TR 90|IN 91|PK 92|AF 93|LK 94|MM 95|IR 98|SS 211|MA 212|
EH 212|DZ 213|TN 216|LY 218|GM 220|SN 221|MR 222|ML 223|GN 224|CI 225|BF 226|NE 227|TG 228|
BJ 229|MU 230|LR 231|SL 232|GH 233|NG 234|TD 235|CF 236|CM 237|CV 238|ST 239|GQ 240|GA 241|
CG 242|CD 243|AO 244|GW 245|IO 246|SC 248|SD 249|RW 250|ET 251|SO 252|DJ 253|KE 254|TZ 255|
UG 256|BI 257|MZ 258|ZM 260|MG 261|RE 262|YT 262|ZW 263|NA 264|MW 265|LS 266|BW 267|SZ 268|
KM 269|SH 290|ER 291|AW 297|FO 298|GL 299|GI 350|PT 351|LU 352|IE 353|IS 354|AL 355|MT 356|
CY 357|FI 358|AX 358|BG 359|LT 370|LV 371|EE 372|MD 373|AM 374|BY 375|AD 376|MC 377|SM 378|
UA 380|RS 381|ME 382|XK 383|HR 385|SI 386|BA 387|MK 389|CZ 420|SK 421|LI 423|FK 500|BZ 501|
NI 505|CR 506|PA 507|PM 508|HT 509|GP 590|BL 590|MF 590|BO 591|GY 592|EC 593|GF 594|PY 595|
MQ 596|SR 597|UY 598|CW 599|BQ 599|TL 670|NF 672|BN 673|NR 674|PG 675|TO 676|SB 677|VU 678|
FJ 679|PW 680|WF 681|CK 682|NU 683|WS 685|KI 686|NC 687|TV 688|PF 689|TK 690|FM 691|MH 692|
KP 850|HK 852|MO 853|KH 855|LA 856|BD 880|TW 886|MV 960|LB 961|JO 962|SY 963|IQ 964|KW 965|
SA 966|YE 967|OM 968|PS 970|AE 971|IL 972|BH 973|QA 974|BT 975|MN 976|NP 977|TJ 992|TM 993|
AZ 994|GE 995|KG 996|UZ 998`;

/** Los que van arriba de la lista, en este orden; el primero es el de casa. */
const PINNED = ['SV', 'GT', 'HN', 'US'];

const NANP_MASK = '(000) 000-0000';

/** Máscara (`0` = un dígito) de los países que la sabemos. Los demás, solo dígitos. */
const MASKS: Record<string, string> = {
  SV: '0000-0000',
  GT: '0000-0000',
  HN: '0000-0000',
  NI: '0000-0000',
  CR: '0000-0000',
  PA: '0000-0000',
  BZ: '000-0000',
  MX: '00 0000 0000',
  CO: '000 000 0000',
  ES: '000 00 00 00',
};

export interface PhoneCountry {
  /** ISO 3166-1 alfa-2: `'SV'`. */
  iso: string;
  /** `'+503'`. */
  code: string;
  /** En español: `'El Salvador'`. */
  name: string;
  /** Sin máscara, el número va en dígitos y su largo se valida por rango. */
  mask: string | null;
}

function regionNames(): Intl.DisplayNames | null {
  try {
    return new Intl.DisplayNames(['es'], { type: 'region' });
  } catch {
    return null;
  }
}

/** La tabla, en su orden: `[{ iso: 'SV', code: '+503' }, …]`. */
const ENTRIES = DIAL_CODES.replace(/\s+/g, '')
  .split('|')
  .map((entry) => ({ iso: entry.slice(0, 2), code: `+${entry.slice(2)}` }));

function buildCountries(): PhoneCountry[] {
  const names = regionNames();
  const all = ENTRIES.map(({ iso, code }) => ({
    iso,
    code,
    name: names?.of(iso) ?? iso,
    mask: MASKS[iso] ?? (code === '+1' ? NANP_MASK : null),
  }));
  const pinned = PINNED.flatMap((iso) => all.filter((country) => country.iso === iso));
  const rest = all
    .filter((country) => !PINNED.includes(country.iso))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));

  return [...pinned, ...rest];
}

/** Todos, con los de `PINNED` arriba y el resto por nombre. */
export const PHONE_COUNTRIES: readonly PhoneCountry[] = buildCountries();

/** El de casa: El Salvador. */
export const HOME_COUNTRY = PHONE_COUNTRIES[0];

/** El país por su ISO; si no se conoce, el de casa. */
export function phoneCountry(iso: string): PhoneCountry {
  return PHONE_COUNTRIES.find((country) => country.iso === iso) ?? HOME_COUNTRY;
}

/** El país de un prefijo (`'+1'` → Estados Unidos), o `undefined`. Sigue el orden de la tabla. */
export function countryOfCode(code: string): PhoneCountry | undefined {
  const first = ENTRIES.find((entry) => entry.code === code);

  return first === undefined ? undefined : phoneCountry(first.iso);
}

/** La bandera en emoji, de las dos letras del ISO. Donde no hay emoji de banderas se ven las letras. */
export function flagOf(iso: string): string {
  return String.fromCodePoint(
    ...[...iso.toUpperCase()].map((char) => 0x1f1a5 + char.charCodeAt(0)),
  );
}

function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Busca por nombre («salva», sin acentos), sigla («mx») o código («+52», «52»).
 * Con dígitos, primero los que empiezan con ese código. Vacío = todos.
 */
export function searchCountries(query: string): PhoneCountry[] {
  const text = fold(query.trim());
  if (text === '') return PHONE_COUNTRIES.slice();

  const digits = text.replace(/^\+/, '');
  if (/^\d+$/.test(digits)) {
    const byCode = (country: PhoneCountry) => country.code.slice(1).startsWith(digits);
    const exact = PHONE_COUNTRIES.filter((country) => country.code.slice(1) === digits);

    return [...exact, ...PHONE_COUNTRIES.filter((c) => byCode(c) && !exact.includes(c))];
  }

  const words = text.split(/\s+/);
  const named = PHONE_COUNTRIES.filter((country) => {
    const name = fold(country.name);
    return words.every((word) => name.includes(word));
  });
  const startsFirst = [
    ...named.filter((country) => fold(country.name).startsWith(text)),
    ...named.filter((country) => !fold(country.name).startsWith(text)),
  ];
  const iso =
    text.length === 2 ? PHONE_COUNTRIES.find((country) => fold(country.iso) === text) : undefined;

  return iso === undefined ? startsFirst : [iso, ...startsFirst.filter((c) => c !== iso)];
}
