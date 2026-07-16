import { isDemoMode } from '../config/demo-mode.js';
import { mockTaxTransactions } from '../data/mock-tax-transactions.js';

const BRACKET_1_RATE = 0.30;
const BRACKET_2_RATE = 0.34;
const BRACKET_1_LIMIT = 30000;

function calcTax(netGainEur) {
  if (netGainEur <= 0) return 0;
  if (netGainEur <= BRACKET_1_LIMIT) {
    return +(netGainEur * BRACKET_1_RATE).toFixed(2);
  }
  const bracket1 = BRACKET_1_LIMIT * BRACKET_1_RATE;
  const bracket2 = (netGainEur - BRACKET_1_LIMIT) * BRACKET_2_RATE;
  return +(bracket1 + bracket2).toFixed(2);
}

function platformStats(transactions) {
  const gains   = transactions.filter((t) => t.gainEur > 0).reduce((s, t) => s + t.gainEur, 0);
  const losses  = transactions.filter((t) => t.gainEur < 0).reduce((s, t) => s + t.gainEur, 0);
  const net     = +(gains + losses).toFixed(2);
  return { gains: +gains.toFixed(2), losses: +losses.toFixed(2), net };
}

export function getTaxData(year) {
  const yearData = (isDemoMode() && year === 2026)
    ? mockTaxTransactions
    : { nordnet: [], nordea: [], kvarnx: [] };

  const nordnet = { transactions: yearData.nordnet, ...platformStats(yearData.nordnet) };
  const nordea  = { transactions: yearData.nordea,  ...platformStats(yearData.nordea)  };
  const kvarnx  = { transactions: yearData.kvarnx,  ...platformStats(yearData.kvarnx)  };

  const combinedNet = +(nordnet.net + nordea.net + kvarnx.net).toFixed(2);

  const availableCarryForward = 0;

  const adjustedNet = +(combinedNet - availableCarryForward).toFixed(2);

  const taxBeforeCarry = calcTax(combinedNet);
  const taxAfterCarry  = calcTax(Math.max(0, adjustedNet));

  // Vero pre-fill field mappings
  const veroFields = {
    nordnetNordea: {
      label: 'Luovutusvoitot arvopaperikaupasta',
      section: 'Pääomatulot',
      gains:  +(nordnet.gains + nordea.gains).toFixed(2),
      losses: +(nordnet.losses + nordea.losses).toFixed(2),
      net:    +(nordnet.net + nordea.net).toFixed(2),
      autoReported: true,
    },
    kvarnx: {
      label: 'Virtuaalivaluutan luovutusvoitto',
      section: 'Pääomatulot',
      gains:  kvarnx.gains,
      losses: kvarnx.losses,
      net:    kvarnx.net,
      autoReported: false,
    },
    carryForward: {
      label: 'Pääomatappio aiemmilta vuosilta',
      section: 'Pääomatulot',
      amount: availableCarryForward,
      years:  [],
    },
  };

  return {
    year,
    nordnet,
    nordea,
    kvarnx,
    summary: {
      combinedNet,
      availableCarryForward: +availableCarryForward.toFixed(2),
      adjustedNet,
      taxBeforeCarry,
      taxAfterCarry,
      taxSaving: +(taxBeforeCarry - taxAfterCarry).toFixed(2),
      bracket: combinedNet > BRACKET_1_LIMIT ? 34 : 30,
    },
    veroFields,
    yearOverYear: [],
    carryForwards: {},
    availableYears: [year],
  };
}
