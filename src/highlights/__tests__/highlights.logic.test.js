import { computeWeeklyHighlights } from '../../highlights/highlights.logic.js';

function assert(cond, msg){ if(!cond) throw new Error(msg); }

export function run(){
  const data = [
    { entryId:1, playerName:'A', teamName:'X', gwPoints: 10, totalPoints: 100, overallRank: 1000, prevOverallRank: 1200 },
    { entryId:2, playerName:'B', teamName:'Y', gwPoints: 3,  totalPoints: 90,  overallRank: 1500, prevOverallRank: 1400 },
    { entryId:3, playerName:'C', teamName:'Z', gwPoints: 10, totalPoints: 80,  overallRank: null, prevOverallRank: null }
  ];

  const r = computeWeeklyHighlights(data);
  assert(r.veckansKanon?.entryId === 1 || r.veckansKanon?.entryId === 3, 'Kanon should have 10p');
  assert(r.veckansSopa?.entryId === 2, 'Sopa should have 3p');
  assert(r.veckansRaket && r.veckansRaket.delta === 200 && r.veckansRaket.agg.entryId === 1, 'Raket should improve by +200');
  assert(r.veckansStörtdyk && r.veckansStörtdyk.delta === -100 && r.veckansStörtdyk.agg.entryId === 2, 'Störtdyk should be -100');

  const r2 = computeWeeklyHighlights([{ entryId:4, playerName:'D', teamName:'W', gwPoints: 1, totalPoints: 10, overallRank: null, prevOverallRank: null }]);
  assert(r2.veckansRaket === null && r2.veckansStörtdyk === null, 'No rank deltas when ranks missing');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run();
  console.log('highlights.logic tests passed');
}

