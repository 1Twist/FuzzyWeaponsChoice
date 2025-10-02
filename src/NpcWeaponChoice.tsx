import { useState } from "react";
import { Button } from "./components/ui/button";
import { Card, CardContent } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "./components/ui/popover";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import pistolImage from './assets/pistol.png';
import rifleImage from './assets/rifle.png';
import rocketLauncherImage from './assets/rocket-launcher.png';

const trimf = (x: number, a: number, b: number, c: number): number => {
  if (x === b) return 1;
  if (x <= a || x >= c) return 0;
  if (x > a && x < b) return (x - a) / (b - a);
  return (c - x) / (c - b);
};

const defuzzifyCentroid = (mu: (x: number) => number, samples = 101): number => {
  let num = 0;
  let den = 0;
  for (let i = 0; i < samples; i++) {
    const x = (100 / (samples - 1)) * i;
    const m = mu(x);
    num += x * m;
    den += m;
  }
  return den === 0 ? 0 : num / den;
};

const fuzzifyDistance = (dist: number) => ({
  Perto: trimf(dist, 0, 0, 25),
  Medio: trimf(dist, 15, 50, 85),
  Longe: trimf(dist, 75, 100, 100),
});

const fuzzifyAmmo = (ammo: number) => ({
  Baixa: trimf(ammo, 0, 0, 30),
  Media: trimf(ammo, 20, 50, 80),
  Alta: trimf(ammo, 70, 100, 100),
});

const muDesirability = {
  Indesejavel: (x: number) => trimf(x, 0, 0, 33),
  Desejavel: (x: number) => trimf(x, 15, 50, 85),
  Imprescindivel: (x: number) => trimf(x, 67, 100, 100),
};

type FuzzyInput = {
  distance: ReturnType<typeof fuzzifyDistance>;
  ammo: ReturnType<typeof fuzzifyAmmo>;
};
type Rule = {
  out: keyof typeof muDesirability;
  strength: number;
};
type WeaponResult = {
  name: string;
  desirability: number;
  inputs: {
    distance: ReturnType<typeof fuzzifyDistance>;
    ammo: ReturnType<typeof fuzzifyAmmo>;
  };
  ruleStrengths: Record<keyof typeof muDesirability, number>;
};

const createWeaponModule = (
  evaluateRules: (input: FuzzyInput) => Rule[]
) => {
  return (distance: number, ammo: number): Omit<WeaponResult, 'name'> => {
    const fuzzyInputs = {
      distance: fuzzifyDistance(distance),
      ammo: fuzzifyAmmo(ammo),
    };
    const rules = evaluateRules(fuzzyInputs);
    const agg: Record<keyof typeof muDesirability, number> = {
      Indesejavel: 0,
      Desejavel: 0,
      Imprescindivel: 0,
    };
    for (const r of rules) {
      agg[r.out] = Math.max(agg[r.out], r.strength);
    }
    const aggregatedOutput = (x: number) => {
      let m = 0;
      m = Math.max(m, Math.min(agg.Indesejavel, muDesirability.Indesejavel(x)));
      m = Math.max(m, Math.min(agg.Desejavel, muDesirability.Desejavel(x)));
      m = Math.max(m, Math.min(agg.Imprescindivel, muDesirability.Imprescindivel(x)));
      return m;
    };
    const crispResult = defuzzifyCentroid(aggregatedOutput);
    return {
      desirability: crispResult,
      inputs: fuzzyInputs,
      ruleStrengths: agg,
    };
  };
};

const evaluatePistol = createWeaponModule((input) => {
  const rules: Rule[] = [];
  const { distance, ammo } = input;
  const AND = (a: number, b: number) => a * b;
  const OR = Math.max;

  rules.push({ out: 'Imprescindivel', strength: AND(distance.Perto, OR(ammo.Media, ammo.Alta)) });
  rules.push({ out: 'Desejavel', strength: AND(distance.Perto, ammo.Baixa) });
  rules.push({ out: 'Desejavel', strength: AND(distance.Medio, OR(ammo.Media, ammo.Alta)) });
  rules.push({ out: 'Indesejavel', strength: OR(distance.Longe, AND(distance.Medio, ammo.Baixa)) });

  return rules;
});

const evaluateRifle = createWeaponModule((input) => {
  const rules: Rule[] = [];
  const { distance, ammo } = input;
  const AND = (a: number, b: number) => a * b;
  const OR = Math.max;

  rules.push({ out: 'Imprescindivel', strength: AND(distance.Longe, ammo.Alta) });
  rules.push({ out: 'Desejavel', strength: AND(distance.Longe, ammo.Media) });
  rules.push({ out: 'Desejavel', strength: AND(distance.Longe, ammo.Baixa) });
  rules.push({ out: 'Desejavel', strength: AND(distance.Medio, OR(ammo.Alta, ammo.Media)) });
  rules.push({ out: 'Indesejavel', strength: AND(OR(distance.Perto, distance.Medio), ammo.Baixa) });
  rules.push({ out: 'Indesejavel', strength: AND(distance.Perto, OR(ammo.Baixa, ammo.Media)) });

  return rules;
});

const evaluateRocketLauncher = createWeaponModule((input) => {
  const rules: Rule[] = [];
  const { distance, ammo } = input;
  const AND = (a: number, b: number) => a * b;
  const OR = Math.max;
  rules.push({ out: 'Imprescindivel', strength: AND(distance.Medio, OR(ammo.Baixa, ammo.Media)) });
  rules.push({ out: 'Desejavel', strength: AND(distance.Medio, ammo.Alta) });
  rules.push({ out: 'Indesejavel', strength: OR(distance.Perto, distance.Longe) });
  return rules;
});
const WeaponPerformanceChart = ({ data, lines, verticalLineX, title }: { data: any[], lines: { key: string; color: string }[], verticalLineX?: number, title: string }) => (
  <div>
    <h4 className="text-center font-semibold mb-2 text-sm">{title}</h4>
    <ResponsiveContainer width="100%" height={130}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.2)" />
        <XAxis dataKey="x" type="number" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} allowDataOverflow={true} tick={{ fill: 'white', fontSize: 12 }} />
        <YAxis type="number" domain={[0, 100]} tick={{ fill: 'white', fontSize: 12 }} />
        <Tooltip wrapperClassName="text-sm bg-gray-800/80 backdrop-blur-sm rounded-md border-gray-700" contentStyle={{ color: 'white', backgroundColor: 'rgba(30, 41, 59, 0.8)' }} />
        <Legend wrapperStyle={{ fontSize: "12px" }} />
        {lines.map(line => (<Line key={line.key} type="monotone" dataKey={line.key} stroke={line.color} dot={false} strokeWidth={2} />))}
        {verticalLineX !== undefined && (<ReferenceLine x={verticalLineX} stroke="#facc15" strokeWidth={2} label={{ value: `${verticalLineX.toFixed(0)}`, fill: '#facc15', fontSize: 12 }} />)}
      </LineChart>
    </ResponsiveContainer>
  </div>
);

const FuzzyShapeChart = ({ data, lines, verticalLineX, title }: { data: any[], lines: { key: string; color: string }[], verticalLineX?: number, title: string }) => (
  <div>
    <h4 className="text-center font-semibold mb-2 text-sm">{title}</h4>
    <ResponsiveContainer width="100%" height={130}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.2)" />
        <XAxis dataKey="x" type="number" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} allowDataOverflow={true} tick={{ fill: 'white', fontSize: 12 }} />
        <YAxis type="number" domain={[0, 1]} tick={{ fill: 'white', fontSize: 12 }} />
        <Tooltip wrapperClassName="text-sm bg-gray-800/80 backdrop-blur-sm rounded-md border-gray-700" contentStyle={{ color: 'white', backgroundColor: 'rgba(30, 41, 59, 0.8)' }} />
        <Legend wrapperStyle={{ fontSize: "12px" }} />
        {lines.map(line => (<Line key={line.key} type="monotone" dataKey={line.key} stroke={line.color} dot={false} strokeWidth={2} />))}
        {verticalLineX !== undefined && (<ReferenceLine x={verticalLineX} stroke="#facc15" strokeWidth={2} label={{ value: `${verticalLineX.toFixed(0)}`, fill: '#facc15', fontSize: 12 }} />)}
      </LineChart>
    </ResponsiveContainer>
  </div>
);
type ExtendedWeaponResult = WeaponResult & { aggregatedFn: (x: number) => number };

const weaponData = {
  'Pistola': { image: pistolImage, stats: { 'Alcance Efetivo': 'Curto/Médio', 'Dependência de Munição': 'Média' } },
  'Rifle': { image: rifleImage, stats: { 'Alcance Efetivo': 'Longo', 'Dependência de Munição': 'Alta' } },
  'Lançador de Foguetes': { image: rocketLauncherImage, stats: { 'Alcance Efetivo': 'Médio', 'Dependência de Munição': 'Baixa' } },
};

const getScoreColorClasses = (score: number) => {
  if (score >= 67) {
    return { text: 'text-green-400', border: 'border-green-500' };
  }
  if (score >= 33) {
    return { text: 'text-yellow-400', border: 'border-yellow-500' };
  }
  return { text: 'text-red-500', border: 'border-red-600' };
};

export const NpcWeaponChoice = () => {
  const [distance, setDistance] = useState<number>(50);
  const [ammo, setAmmo] = useState<number>(50);
  const [results, setResults] = useState<ExtendedWeaponResult[] | null>(null);
  const [recommendedWeapon, setRecommendedWeapon] = useState<string | null>(null);

  const handleCalculate = () => {
    const weaponsToEvaluate = [
      { name: 'Pistola', evaluate: evaluatePistol },
      { name: 'Rifle', evaluate: evaluateRifle },
      { name: 'Lançador de Foguetes', evaluate: evaluateRocketLauncher }
    ];

    const allResults = weaponsToEvaluate.map(weapon => {
     
      const baseResult = weapon.evaluate(distance, ammo);
      const agg = baseResult.ruleStrengths;
      const aggregatedFn = (x: number) => {
        let m = 0;
        m = Math.max(m, Math.min(agg.Indesejavel, muDesirability.Indesejavel(x)));
        m = Math.max(m, Math.min(agg.Desejavel, muDesirability.Desejavel(x)));
        m = Math.max(m, Math.min(agg.Imprescindivel, muDesirability.Imprescindivel(x)));
        return m;
      };

      return { ...baseResult, name: weapon.name, aggregatedFn };
    });

    allResults.sort((a, b) => b.desirability - a.desirability);

    setResults(allResults);
    setRecommendedWeapon(allResults[0]?.name ?? 'Nenhuma');
  };

  const handleValueChange = (value: string, setter: React.Dispatch<React.SetStateAction<number>>) => {
    if (value === "") { setter(1); return; }
    const numValue = parseInt(value, 10);
    if (numValue > 100) { setter(100); }
    else if (numValue < 1) { setter(1); }
    else { setter(numValue); }
  };

  const generateChartData = (fn: (x: number) => any, keys: string[]) => {
    const data = [];
    for (let i = 0; i < 101; i++) {
      const point = { x: i, ...Object.fromEntries(keys.map(k => [k, fn(i)[k]])) };
      data.push(point);
    }
    return data;
  };
  const generateAggregatedData = (fn: (x: number) => number) => {
    const data = [];
    for (let i = 0; i < 101; i++) {
      data.push({ x: i, 'Forma da Saída': fn(i) });
    }
    return data;
  };
const [distanceError, setDistanceError] = useState<string | null>(null);
const [ammoError, setAmmoError] = useState<string | null>(null);

  const generateWeaponPerformanceData = (
    evaluateFn: (distance: number, ammo: number) => Omit<WeaponResult, 'name'>,
    vary: 'distance' | 'ammo',
    fixedValue: number
  ) => {
    const data = [];
    for (let i = 1; i <= 100; i++) {
      const result = vary === 'distance'
        ? evaluateFn(i, fixedValue)
        : evaluateFn(fixedValue, i);
      data.push({ x: i, Desejabilidade: result.desirability });
    }
    return data;
  };
  return (
    <div className="p-4 md:p-8 text-white min-h-screen">
      <Card className="bg-gray-800/80 border-gray-700 backdrop-blur-sm max-w-2xl mx-auto">
        <CardContent className="pt-6">
          <h1 className="text-3xl md:text-4xl font-pixel text-center mb-8 text-yellow-400" style={{ textShadow: '2px 2px #000' }}>
            Análise de Loadout
          </h1>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <Label htmlFor="distance" className="text-gray-400 text-sm">Distância do Alvo (1-100)</Label>
              <Input id="distance" type="number" min={1} max={100} value={distance} onChange={(e) => handleValueChange(e.target.value, setDistance)} className="bg-gray-900 border-gray-600 text-white" />
            </div>
            <div>
              <Label htmlFor="ammo" className="text-gray-400 text-sm">Munição Disponível (1-100)</Label>
              <Input id="ammo" type="number" min={1} max={100} value={ammo} onChange={(e) => handleValueChange(e.target.value, setAmmo)} className="bg-gray-900 border-gray-600 text-white" />
            </div>
          </div>
          <Button className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold font-pixel tracking-wider" onClick={handleCalculate}>Analisar</Button>

          {results && (
            <div className="mt-8 space-y-4">
              {results.map((res) => {
                const wData = weaponData[res.name as keyof typeof weaponData];
                const scoreColors = getScoreColorClasses(res.desirability);
                const evaluateFunctions = {
                  'Pistola': evaluatePistol,
                  'Rifle': evaluateRifle,
                  'Lançador de Foguetes': evaluateRocketLauncher
                };

                return (
                  <Card key={res.name} className={`p-4 bg-gray-900/50 border-2 ${scoreColors.border}`}>
                    <div className="flex items-center gap-4">
                      <img src={wData.image} alt={res.name} className="w-20 h-20 object-contain bg-black/50 p-1 rounded-md border border-gray-600 pixel-art-image" />
                      <div className="flex-grow">
                        <h3 className="text-lg font-bold">{res.name} {res.name === recommendedWeapon && <span className="text-xs text-yellow-400 font-pixel">(RECOMENDADA)</span>}</h3>
                        <div className="text-xs text-gray-400 mt-2 space-y-1">
                          {Object.entries(wData.stats).map(([key, value]) => (
                            <p key={key}><strong>{key}:</strong> {value}</p>
                          ))}
                        </div>
                      </div>
                      <div className="text-right pl-2">
                        <div className="text-xs text-gray-400">Score Fuzzy</div>
                        <Popover>
                          <PopoverTrigger asChild>
                            <span className={`text-3xl font-mono cursor-pointer p-2 rounded-md transition-colors hover:bg-blue-400/20 ${scoreColors.text}`}>
                              {res.desirability.toFixed(2)}
                            </span>
                          </PopoverTrigger>
                          <PopoverContent className="w-[95vw] sm:w-[500px] bg-gray-800/90 border-gray-700 text-white backdrop-blur-sm p-0" side="bottom">
                            <div className="max-h-[80vh] overflow-y-auto space-y-4 p-4">
                              <h3 className="font-bold text-center text-yellow-300">Análise de Desempenho: {res.name}</h3>

      
                              <WeaponPerformanceChart
                                title={`Desejabilidade por Distância (Munição em ${ammo})`}
                                data={generateWeaponPerformanceData(evaluateFunctions[res.name as keyof typeof evaluateFunctions], 'distance', ammo)}
                                lines={[{ key: 'Desejabilidade', color: '#82ca9d' }]}
                                verticalLineX={distance}
                              />
                              <WeaponPerformanceChart
                                title={`Desejabilidade por Munição (Distância em ${distance})`}
                                data={generateWeaponPerformanceData(evaluateFunctions[res.name as keyof typeof evaluateFunctions], 'ammo', distance)}
                                lines={[{ key: 'Desejabilidade', color: '#ffc658' }]}
                                verticalLineX={ammo}
                              />

                
                              <FuzzyShapeChart
                                title="Cálculo de Saída Fuzzy"
                                data={generateAggregatedData(res.aggregatedFn)}
                                lines={[{ key: 'Forma da Saída', color: '#63b3ed' }]}
                                verticalLineX={res.desirability}
                              />

                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
