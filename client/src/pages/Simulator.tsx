import { useState, useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { PageContainer, StickyCTA } from "@/components/Layout";
import { useBorosMarkets, formatPercent, formatUSD } from "@/lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";

const DURATIONS = [
  { label: "7 days", value: 7 },
  { label: "14 days", value: 14 },
  { label: "30 days", value: 30 },
  { label: "60 days", value: 60 },
  { label: "90 days", value: 90 },
];

export default function Simulator() {
  const { data: markets } = useBorosMarkets();
  const [selectedMarket, setSelectedMarket] = useState("1");
  const [direction, setDirection] = useState<"long" | "short">("long");
  const [positionSize, setPositionSize] = useState(10);
  const [entryRate, setEntryRate] = useState(12.0);
  const [expectedRate, setExpectedRate] = useState(10.0);
  const [duration, setDuration] = useState(30);
  const [leverage, setLeverage] = useState(1);

  const market = markets?.find((m) => m.id === selectedMarket) ?? markets?.[0];

  // Sync entry rate with selected market
  useMemo(() => {
    if (market) {
      setEntryRate(market.impliedApr);
      setExpectedRate(market.underlyingApr);
    }
  }, [market?.id]);

  // Calculations
  const notional = positionSize * 40000; // rough USD value
  const fixedRate = entryRate / 100;
  const actualRate = expectedRate / 100;
  const pnlRaw = direction === "long"
    ? (actualRate - fixedRate) * notional * (duration / 365)
    : (fixedRate - actualRate) * notional * (duration / 365);
  const pnl = pnlRaw * leverage;
  const margin = notional / leverage;
  const roi = margin > 0 ? (pnl / margin) * 100 : 0;
  const breakEvenRate = direction === "long" ? entryRate : entryRate;
  const liqRate = direction === "long"
    ? entryRate - (100 / leverage) * 0.8
    : entryRate + (100 / leverage) * 0.8;

  // P&L curve data
  const pnlCurve = useMemo(() => {
    const points = [];
    for (let rate = -5; rate <= 35; rate += 0.5) {
      const actual = rate / 100;
      const fixed = entryRate / 100;
      const pnlAtRate = direction === "long"
        ? (actual - fixed) * notional * (duration / 365) * leverage
        : (fixed - actual) * notional * (duration / 365) * leverage;
      points.push({ rate, pnl: Math.round(pnlAtRate) });
    }
    return points;
  }, [entryRate, direction, notional, duration, leverage]);

  return (
    <PageContainer>
      <div className="mb-6">
        <h1 className="font-display text-xl font-bold">P&L Simulator</h1>
        <p className="text-sm text-muted-foreground">Model positions before you trade</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-16">
        {/* Left: inputs */}
        <div className="lg:col-span-2 space-y-5" data-testid="simulator-inputs">
          <div className="bg-card border border-card-border rounded-xl p-4 space-y-4">
            {/* Market */}
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Market</label>
              <Select value={selectedMarket} onValueChange={setSelectedMarket}>
                <SelectTrigger className="bg-background border-border" data-testid="sim-select-market">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(markets ?? []).map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Direction */}
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Direction</label>
              <div className="flex gap-1 bg-background rounded-lg p-1">
                <button
                  onClick={() => setDirection("long")}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    direction === "long" ? "bg-primary/20 text-primary" : "text-muted-foreground"
                  }`}
                  data-testid="btn-long"
                >
                  Long
                </button>
                <button
                  onClick={() => setDirection("short")}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    direction === "short" ? "bg-destructive/20 text-destructive" : "text-muted-foreground"
                  }`}
                  data-testid="btn-short"
                >
                  Short
                </button>
              </div>
            </div>

            {/* Position size */}
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">
                Position Size ({market?.underlying ?? "BTC"})
              </label>
              <Input
                type="number"
                value={positionSize}
                onChange={(e) => setPositionSize(+e.target.value || 0)}
                className="bg-background border-border tabular-nums"
                data-testid="input-size"
              />
              <Slider
                value={[positionSize]}
                onValueChange={([v]) => setPositionSize(v)}
                min={0.1}
                max={100}
                step={0.1}
                className="mt-2"
              />
            </div>

            {/* Entry rate */}
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Entry Rate (Implied APR %)</label>
              <Input
                type="number"
                value={entryRate}
                onChange={(e) => setEntryRate(+e.target.value || 0)}
                className="bg-background border-border tabular-nums"
                step={0.1}
                data-testid="input-entry-rate"
              />
            </div>

            {/* Expected rate */}
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">
                Expected Funding Rate (%)
                <span className="text-muted-foreground/60 ml-1">{expectedRate.toFixed(1)}%</span>
              </label>
              <Slider
                value={[expectedRate]}
                onValueChange={([v]) => setExpectedRate(v)}
                min={-10}
                max={40}
                step={0.1}
                className="mt-1"
                data-testid="slider-expected"
              />
            </div>

            {/* Duration */}
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Duration</label>
              <Select value={String(duration)} onValueChange={(v) => setDuration(+v)}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATIONS.map((d) => (
                    <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Leverage */}
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">
                Leverage: <span className="text-foreground font-medium">{leverage}x</span>
              </label>
              <Slider
                value={[leverage]}
                onValueChange={([v]) => setLeverage(v)}
                min={1}
                max={20}
                step={1}
                data-testid="slider-leverage"
              />
            </div>
          </div>
        </div>

        {/* Right: outputs */}
        <div className="lg:col-span-3 space-y-4" data-testid="simulator-outputs">
          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: "Estimated P&L", value: formatUSD(pnl), color: pnl >= 0 ? "text-primary" : "text-destructive" },
              { label: "ROI %", value: `${roi >= 0 ? "+" : ""}${roi.toFixed(2)}%`, color: roi >= 0 ? "text-primary" : "text-destructive" },
              { label: "Break-even Rate", value: `${breakEvenRate.toFixed(2)}%`, color: "text-chart-4" },
              { label: "Margin Required", value: formatUSD(margin), color: "text-foreground" },
              { label: "Liquidation Rate", value: liqRate > 0 ? `${liqRate.toFixed(2)}%` : "N/A", color: "text-destructive" },
              { label: "Notional", value: formatUSD(notional), color: "text-muted-foreground" },
            ].map((kpi) => (
              <div key={kpi.label} className="glass-card p-3">
                <p className="text-[11px] text-muted-foreground mb-1">{kpi.label}</p>
                <p className={`text-base font-bold tabular-nums ${kpi.color}`}>{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* P&L Chart */}
          <div className="bg-card border border-card-border rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3">P&L Across Funding Rates</h3>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={pnlCurve} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="pnlGreen" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1BE3C2" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#1BE3C2" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(55,75,109,0.3)" />
                  <XAxis dataKey="rate" tick={{ fontSize: 11, fill: "#9DAFCD" }} tickFormatter={(v) => `${v}%`} />
                  <YAxis tick={{ fontSize: 11, fill: "#9DAFCD" }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1C2B3D", border: "1px solid #2B3B55", borderRadius: "8px", fontSize: "12px" }}
                    formatter={(value: number) => [formatUSD(value), "P&L"]}
                    labelFormatter={(label) => `Rate: ${label}%`}
                  />
                  <ReferenceLine y={0} stroke="#374B6D" strokeWidth={1} />
                  <ReferenceLine x={expectedRate} stroke="#F0CE74" strokeDasharray="4 4" strokeWidth={1} label={{ value: "Expected", position: "top", fill: "#F0CE74", fontSize: 10 }} />
                  <ReferenceLine x={entryRate} stroke="#6079FF" strokeDasharray="4 4" strokeWidth={1} label={{ value: "Entry", position: "top", fill: "#6079FF", fontSize: 10 }} />
                  <Area type="monotone" dataKey="pnl" stroke="#1BE3C2" fill="url(#pnlGreen)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Comparison card */}
          <div className="bg-card border border-card-border rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-2">vs. Just Holding (No Hedge)</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Without locking your rate on Boros, your P&L depends entirely on volatile funding rates.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] text-muted-foreground mb-1">With Boros (Fixed)</p>
                <p className={`text-lg font-bold tabular-nums ${pnl >= 0 ? "text-primary" : "text-destructive"}`}>
                  {formatUSD(pnl)}
                </p>
                <p className="text-[10px] text-muted-foreground">Predictable outcome</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground mb-1">Without Boros (Floating)</p>
                <p className="text-lg font-bold tabular-nums text-chart-4">
                  ???
                </p>
                <p className="text-[10px] text-muted-foreground">Depends on rate volatility</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <StickyCTA text="Ready to lock in your rate?" />
    </PageContainer>
  );
}
