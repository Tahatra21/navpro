/** Pemetaan unit organisasi untuk proyek demo (Pusat + SBU) */

export const PUSAT_UNIT_CODES = ['SOLAR-ENT-1', 'SOLAR-ENT-2', 'SOLAR-PLN-1', 'SOLAR-PLN-2'];

export const SBU_UNIT_CODES = [
  'REG-SBU',
  'REG-SBT',
  'REG-SBS',
  'REG-JBR',
  'REG-JBTG',
  'REG-JBTM',
  'REG-BNR',
  'REG-KLM',
  'REG-SIBT',
];

/** Rotasi 26 slot: campuran Pusat (4) + SBU (9) */
const ROTATION_26 = [
  'SOLAR-ENT-1',
  'SOLAR-ENT-2',
  'SOLAR-PLN-1',
  'SOLAR-PLN-2',
  'REG-SBU',
  'REG-SBT',
  'REG-SBS',
  'REG-JBR',
  'REG-JBTG',
  'REG-JBTM',
  'REG-BNR',
  'REG-KLM',
  'REG-SIBT',
  'SOLAR-ENT-1',
  'SOLAR-ENT-2',
  'SOLAR-PLN-1',
  'REG-SBU',
  'REG-SBT',
  'REG-SBS',
  'SOLAR-PLN-2',
  'REG-JBR',
  'SOLAR-PLN-1',
  'SOLAR-ENT-1',
  'REG-SIBT',
  'SOLAR-ENT-2',
  'REG-KLM',
];

export function orgUnitCodeForSeq(seq) {
  return ROTATION_26[(seq - 1) % ROTATION_26.length];
}

export function orgUnitCodeForIndex(index, preferSbu = false) {
  const codes = preferSbu ? SBU_UNIT_CODES : [...PUSAT_UNIT_CODES, ...SBU_UNIT_CODES];
  return codes[index % codes.length];
}
