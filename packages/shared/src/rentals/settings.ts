import { z } from 'zod';

import { moneySchema } from '../schemas';
import { storedFileUrl } from './files';

/**
 * spec 095 — Ajustes de la rentadora: los datos de la empresa y del contrato.
 *
 * Es **una sola fila** (`key = 'default'`, RN-8). `GET /rental-settings` la
 * crea con {@link RENTAL_SETTINGS_DEFAULTS} si todavía no existe, así que la
 * primera vez se ven los valores del prototipo y no un formulario vacío.
 */

/** Lugares de entrega y devolución que ofrece el formulario de renta (096). */
export const PICKUP_LOCATIONS = [
  'Oficina',
  'Aeropuerto',
  'Domicilio del cliente',
  'Hotel',
] as const;

/** Tope de cláusulas y accesorios: una lista editable, no un documento entero. */
export const RENTAL_SETTINGS_MAX_CLAUSES = 60;
export const RENTAL_SETTINGS_MAX_ACCESSORIES = 100;

const text = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, { message: `Escribí ${label}.` })
    .max(max, { message: `No puede pasar de ${max} caracteres.` });

/** Texto opcional: vacío viaja como `null`. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { message: `No puede pasar de ${max} caracteres.` })
    .nullable()
    .transform((value) => (value === null || value === '' ? null : value));

const wholeNumber = (min: number, max: number) =>
  z.coerce
    .number({ message: 'Escribí un número.' })
    .int({ message: 'Tiene que ser un número entero.' })
    .min(min, { message: `No puede ser menor que ${min}.` })
    .max(max, { message: `No puede pasar de ${max}.` });

/**
 * Un porcentaje de 0 a 100 con hasta dos decimales, normalizado a cadena:
 * `13` → `"13.00"`. Viaja como cadena, igual que el dinero.
 */
export const percentSchema = z
  .union([z.string().trim(), z.number()])
  .transform((value) => (typeof value === 'number' ? value.toFixed(2) : value))
  .refine((value) => /^\d{1,3}(\.\d{1,2})?$/.test(value), {
    message: 'Escribí un porcentaje válido, con hasta dos decimales.',
  })
  .transform((value) => {
    const [whole = '0', fraction = ''] = value.split('.');
    return `${Number(whole)}.${fraction.padEnd(2, '0')}`;
  })
  .refine((value) => Number(value) <= 100, { message: 'El porcentaje no puede pasar de 100.' });

/** `PUT /rental-settings`: la fila entera, siempre (RN-8). */
export const rentalSettingsSchema = z.object({
  companyName: text('el nombre de la empresa', 120),
  taxId: optionalText(30),
  nrc: optionalText(30),
  address: optionalText(300),
  phones: optionalText(120),
  email: optionalText(120),
  lessorName: text('el nombre del arrendante', 120),
  city: text('la ciudad', 80),
  contractStartNumber: wholeNumber(1, 9_999_999),
  vatRate: percentSchema,
  defaultCdwPerDay: moneySchema.nullable(),
  defaultDeductible: moneySchema.nullable(),
  bufferHours: wholeNumber(0, 72),
  graceHours: wholeNumber(0, 24),
  minDriverAge: wholeNumber(16, 99),
  kmAlert: wholeNumber(0, 100_000),
  daysAlert: wholeNumber(0, 365),
  interestRate: percentSchema.nullable(),
  lateInterestRate: percentSchema.nullable(),
  contractIntro: text('la introducción del contrato', 4000),
  clauses: z
    .array(text('la cláusula', 6000))
    .min(1, { message: 'El contrato necesita al menos una cláusula.' })
    .max(RENTAL_SETTINGS_MAX_CLAUSES, {
      message: `No más de ${RENTAL_SETTINGS_MAX_CLAUSES} cláusulas.`,
    }),
  accessories: z.array(text('el accesorio', 80)).max(RENTAL_SETTINGS_MAX_ACCESSORIES, {
    message: `No más de ${RENTAL_SETTINGS_MAX_ACCESSORIES} accesorios.`,
  }),
  logoFileId: z.uuid({ message: 'Ese logo no es válido.' }).nullable(),
});
export type RentalSettingsInput = z.infer<typeof rentalSettingsSchema>;

/** Lo que devuelve `GET` y `PUT /rental-settings`. Decimales como cadena. */
export interface RentalSettings extends RentalSettingsInput {
  /** `storedFileUrl(logoFileId)`, relativa al API, o `null` sin logo. */
  logoUrl: string | null;
  updatedAt: string;
}

/** El logo de unos ajustes, como ruta relativa al API. */
export function rentalLogoUrl(logoFileId: string | null): string | null {
  return logoFileId === null ? null : storedFileUrl(logoFileId);
}

/**
 * Los valores con que nace la fila de ajustes. Copiados **textualmente** de
 * `CFG_DEF` del prototipo (intro, las 17 cláusulas y los 28 accesorios).
 * `{ARRENDANTE}` en la intro lo reemplaza la impresión (097).
 */
export const RENTAL_SETTINGS_DEFAULTS: RentalSettingsInput = {
  companyName: "RIVERA'S RENT A CARS",
  taxId: '0614-070624-103-3',
  nrc: null,
  address: 'Calle el Algodón y 75 Av. Norte, Col. Miralvalle, #2, San Salvador, San Salvador.',
  phones: '7742-1900 y 6013-9922',
  email: 'riverasimportcars@gmail.com',
  lessorName: 'JOSUE ALEXANDER RIVERA',
  city: 'San Salvador',
  contractStartNumber: 733,
  vatRate: '0.00',
  defaultCdwPerDay: null,
  defaultDeductible: null,
  bufferHours: 1,
  graceHours: 1,
  minDriverAge: 21,
  kmAlert: 500,
  daysAlert: 7,
  interestRate: null,
  lateInterestRate: null,
  contractIntro:
    'Celebran el presente contrato de arrendamiento, el concesionario {ARRENDANTE} en esta plaza como arrendador y para los efectos del presente contrato se denomina el "ARRENDANTE", y por la otra como arrendatario la persona cuyo nombre aparece en el anverso, quien en lo sucesivo se denomina "EL ARRENDATARIO".',
  clauses: [
    'El ARRENDANTE da al ARRENDATARIO y éste recibe en arrendamiento de conformidad y a su entera satisfacción el vehículo automotor identificado en este contrato, en adelante llamado "el vehículo", en buen estado mecánico, carrocería y pintura, con el equipo y accesorios que se detallan.',
    'El vehículo será destinado exclusivamente para el transporte de personas y deberá ser manejado únicamente por el ARRENDATARIO, quien no lo subarrendará ni permitirá el manejo por terceras personas, a menos que se trate de un conductor adicional registrado y autorizado en el anverso de este contrato, ni dispondrá en forma alguna del vehículo sin el consentimiento previo y por escrito del ARRENDANTE. EL ARRENDATARIO usará y conducirá diligentemente el vehículo arrendado procurando abstenerse de cualquier acto que pueda derivar en daño o pérdida del mismo.',
    'La duración del presente contrato es por el plazo especificado en el anverso de este documento, el cual es obligatorio para el ARRENDATARIO. El ARRENDANTE se reserva el derecho de dar por terminado el contrato y de recoger el vehículo dado en arrendamiento en cualquier momento y lugar en que se encuentre cuando a su discreción se le esté causando daño al mismo, a terceros o se esté infringiendo cualquier ordenamiento legal, para lo que EL ARRENDATARIO, por este medio, concede la correspondiente autorización. Para los efectos legales de este contrato el ARRENDATARIO manifiesta que se constituye en DEPOSITARIO del vehículo arrendado y se obliga en la misma forma en que están obligados los depositarios judiciales, asumiendo desde el momento de la firma las responsabilidades en que incurren dichos depositarios. Al finalizar el plazo estipulado, el ARRENDATARIO devolverá el vehículo en las mismas condiciones en que lo ha recibido, en el domicilio del ARRENDANTE o en cualquiera de sus oficinas sucursales, con al menos igual cantidad de combustible a la que tenía cuando le fue entregado, o cancelará en efectivo el equivalente a dicha cantidad. En caso de que no se devuelva el vehículo dentro del término de 8 horas después de vencido el plazo del arrendamiento, se considerará al ARRENDATARIO depositario infiel, pudiendo ejercitarse la correspondiente acción penal.',
    'En caso de que se ocasionaren daños al vehículo y habiendo el ARRENDATARIO expresado su conformidad por la suma adicional de la cobertura que se estipula en el anverso de este documento, el ARRENDATARIO no será responsable por estos, teniendo que cancelar únicamente el deducible que se ha fijado en el anverso. Sin embargo, el ARRENDATARIO será total y exclusivamente responsable por dichos daños, y se compromete al pago de los mismos, si usa el vehículo contraviniendo cualquier disposición legal o las estipulaciones del presente contrato; igualmente será responsable por los daños que cause a terceros en sus personas, bienes o posesiones y por cualquier tipo de responsabilidad que se origine por los actos que cause, quedando liberado el ARRENDANTE de esa responsabilidad.',
    'EL ARRENDATARIO pagará al ARRENDANTE al contado y en el domicilio de este la renta que corresponde según las tarifas establecidas en este contrato, más cualesquiera cargos adicionales tales como coberturas, gasolina, impuestos, daños o pérdidas no cubiertas, servicios de grúa o tiempo de reparación. Asimismo, la renta seguirá vigente en el caso que el ARRENDATARIO solicite por escrito una extensión de la fecha de devolución del vehículo y hasta que el ARRENDANTE reciba a su entera satisfacción el vehículo dado en arrendamiento. La autorización de prórroga de la fecha de devolución del vehículo debe ser hecha por escrito. EL ARRENDATARIO pagará al ARRENDANTE el importe total de la renta a la terminación del contrato.',
    'Tanto el ARRENDATARIO como el "conductor adicional" autorizado por el ARRENDANTE se comprometen a no usar o conducir el vehículo: a) en uso distinto al estipulado, ni como transporte comercial de pasajeros, remolque u otro tipo de servicio público; b) para transportar carga o bultos por encima del vehículo; c) en deportes automovilísticos o cualquier otro deporte; d) en labores peligrosas o ilícitas; e) por vías no autorizadas para el tránsito público o no aptas para transitar con el vehículo arrendado; f) en playas, ríos, arroyos o cualquier masa de agua; g) bajo los efectos del alcohol; h) bajo la influencia de drogas, enervantes, estupefacientes, sicotrópicos o cualquier sustancia que afecte la habilidad para conducir; i) sin licencia expedida por autoridad competente; j) en actividades políticas, manifestaciones, caravanas, marchas, desfiles, durante fiestas patronales, alzamientos, huelgas, paros, contrabando, guerras, actividades de guerrilla y similares, transporte de armas, explosivos, municiones, drogas y en general ejercer cualquier actividad ilícita o peligrosa; k) en violación de los reglamentos de tránsito respectivos, disposiciones municipales o de cualquier ordenamiento legal vigente; l) fuera del territorio nacional sin previa autorización por escrito del ARRENDANTE. En los casos contemplados anteriormente no habrá lugar a ninguna de las coberturas contratadas; tampoco habrá seguros en los daños que se ocasionen con motivo o consecuencia directa o indirecta de guerras, revoluciones, asonadas, motines, disturbios laborales, desórdenes públicos o cualquier otro hecho u ocurrencia similar, incluyendo actos de la naturaleza como terremotos, inundaciones y erupciones volcánicas. EL ARRENDATARIO se obliga a cumplir estrictamente con lo estipulado en este contrato. Cualquier violación al mismo, y específicamente a lo estipulado en las cláusulas 2, 3 y 4, implicará hacer efectivo el título de crédito firmado por el ARRENDATARIO, con independencia de las responsabilidades que se generen por los delitos que pudiesen resultar por la indebida disposición del vehículo, sin perjuicio de la rescisión del contrato y de las responsabilidades civiles, indemnizaciones y pago de daños y perjuicios que se originen por los mismos, inclusive los honorarios de abogados y costas judiciales.',
    'Ambas partes convienen que el ARRENDANTE podrá ejercitar indistintamente cualquier acción en contra del ARRENDATARIO o del "conductor adicional" autorizado por este para conducir el vehículo y que cause cualquier daño, ya sea al mismo vehículo, a bienes o a terceras personas, sin tener que actuar primero contra el ARRENDATARIO, pudiendo inclusive iniciar acciones simultáneas contra ambos, renunciando este a los beneficios de orden y excusión.',
    'Serán por cuenta del ARRENDATARIO: a) los daños causados al vehículo mientras esté en su poder físico o jurídico; b) los daños causados a personas que viajen en el vehículo o a terceros; c) las sanciones por violaciones que cometa a los reglamentos de tránsito; d) la renta estipulada hasta el recibo del vehículo a satisfacción del ARRENDANTE.',
    'Si ocurriese un accidente y el ARRENDATARIO hubiese adquirido la cobertura por accidente, este deberá presentar el respectivo parte policial para validar y hacer efectiva dicha cobertura; de lo contrario, el ARRENDATARIO será responsable por todos los daños que se ocasionaren. EL ARRENDATARIO y/o el tercero autorizado, en su caso, se comprometen a colaborar con el ARRENDANTE en cualquier investigación relacionada con el vehículo por causas tales como vandalismo, robo, daño o accidente.',
    'Las siguientes condiciones son indispensables para que pueda validarse la cobertura contratada: a) informar inmediatamente a las autoridades competentes; b) informar inmediatamente al ARRENDANTE; c) presentar el respectivo parte policial, además de la documentación que el ARRENDANTE requiera, a más tardar 48 horas después de ocurrido el accidente. En dicho parte deberá constar la presencia inmediata de las autoridades correspondientes en el lugar del accidente. EL ARRENDATARIO asume cualquier responsabilidad que no sea cubierta por la(s) cobertura(s) en virtud de que esta no tenga aplicabilidad por causa imputable al mismo. En ningún caso el ARRENDANTE o el asegurador reconocerán colisiones o accidentes contra objetos fijos, salvo que estos se hayan originado como resultado de otro accidente de tránsito y exista el correspondiente parte policial. Asimismo, el ARRENDATARIO será responsable por toda multa por infracciones a las leyes de tránsito impuesta durante el término de este contrato.',
    'Si el ARRENDANTE no es resarcido de todo perjuicio causado por el ARRENDATARIO, el primero tendrá derecho a ejercer en contra del segundo las acciones civiles y penales a que hubiere lugar.',
    'Si por haber usado el vehículo arrendado en contravención de cualquier disposición de este contrato, o cuando se haya declinado la cobertura antes referida, sobreviniere un accidente, o si por cualquier otra causa imputable al ARRENDATARIO el vehículo es detenido o dañado, el ARRENDATARIO pagará al ARRENDANTE el importe de las reparaciones del vehículo, así como el importe del alquiler por día por el tiempo que duren dichas reparaciones o los trámites legales para la liberación del mismo, así como todos los gastos que origine la reparación del vehículo dado en arrendamiento.',
    'EL ARRENDATARIO depositará como anticipo en garantía al ARRENDANTE la suma indicada en el contrato para el cumplimiento de las obligaciones que contrae en el mismo. EL ARRENDATARIO faculta al ARRENDANTE a disponer total o parcialmente del depósito, como lo estime conveniente, a fin de cubrir cualquiera de las prestaciones estipuladas, sin necesidad de previo requerimiento.',
    'En caso de que el vehículo sufra alguna descompostura, el ARRENDATARIO deberá reportarla inmediatamente al ARRENDANTE para que sea reparado o para que se le proporcione otro vehículo. En caso de no hacerlo así, o de comprobarse que el odómetro ha sido desconectado o que el sello correspondiente ha sido violado, se cargará a la cuenta del ARRENDATARIO el importe del kilometraje basado en el importe del alquiler por día.',
    'El ARRENDANTE no asume responsabilidad por artículos dejados en el vehículo por el ARRENDATARIO.',
    'El presente contrato podrá ser modificado únicamente por escrito y con la anuencia de ambas partes.',
    'Para el caso de controversia o interpretación del presente contrato, las partes se someten expresamente a la jurisdicción de los tribunales competentes de la ciudad de San Salvador, renunciando al fuero de cualquier otro domicilio presente o futuro.',
  ],
  accessories: [
    'Antena',
    'Copa de ruedas',
    'Cricos delanteros',
    'Cricos traseros',
    'Cubre llanta de repuesto',
    'Emblemas',
    'Encendedor',
    'Espejos exteriores',
    'Espejos interiores',
    'Extintores',
    'Faroles',
    'Llanta de repuesto',
    'Llave de ruedas',
    'Mica',
    'Llavero',
    'Loderas',
    'Luces delanteras',
    'Parlantes',
    'Placas',
    'Radio o pantalla',
    'Sobre alfombras',
    'Stops traseros',
    'Tapicería',
    'Tapón de gasolina',
    'Tarjeta de circulación',
    'Triángulos',
    'Vías delanteras',
    'Vidrios',
  ],
  logoFileId: null,
};
