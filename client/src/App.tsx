import { Switch, Route, Router } from "wouter";
import { ModeProvider } from "@/lib/mode-context";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Terminal from "@/pages/Terminal";
import Arbitrage from "@/pages/Arbitrage";
import Simulator from "@/pages/Simulator";
import Heatmap from "@/pages/Heatmap";
import Yields from "@/pages/Yields";
import Strategies from "@/pages/Strategies";
import Calculator from "@/pages/Calculator";
import Calendar from "@/pages/Calendar";
import History from "@/pages/History";
import Rewards from "@/pages/Rewards";
import Portfolio from "@/pages/Portfolio";
import Compare from "@/pages/Compare";
import Screener from "@/pages/Screener";
import Whales from "@/pages/Whales";
import SPendle from "@/pages/SPendle";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/terminal" component={Terminal} />
      <Route path="/arbitrage" component={Arbitrage} />
      <Route path="/simulator" component={Simulator} />
      <Route path="/heatmap" component={Heatmap} />
      <Route path="/yields" component={Yields} />
      <Route path="/strategies" component={Strategies} />
      <Route path="/calculator" component={Calculator} />
      <Route path="/calendar" component={Calendar} />
      <Route path="/history" component={History} />
      <Route path="/rewards" component={Rewards} />
      <Route path="/portfolio" component={Portfolio} />
      <Route path="/compare" component={Compare} />
      <Route path="/screener" component={Screener} />
      <Route path="/whales" component={Whales} />
      <Route path="/spendle" component={SPendle} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ModeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router hook={useHashLocation}>
            <AppRouter />
          </Router>
        </TooltipProvider>
      </QueryClientProvider>
    </ModeProvider>
  );
}

export default App;
