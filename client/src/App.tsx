import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Hub from "@/pages/hub";
import Voyages from "@/pages/voyages";
import Expo from "@/pages/expo";
import Diner from "@/pages/diner";
import BountyOffice from "@/pages/bounty-office";
import BountyPage from "@/pages/bounty";
import Aurelia from "@/pages/aurelia";
import NotFound from "@/pages/not-found";
import { SoundToggle } from "@/components/SoundToggle";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Hub} />
      <Route path="/voyages" component={Voyages} />
      <Route path="/expo" component={Expo} />
      <Route path="/diner" component={Diner} />
      <Route path="/bounties" component={BountyOffice} />
      <Route path="/bounty/:id" component={BountyPage} />
      <Route path="/aurelia" component={Aurelia} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router hook={useHashLocation}>
          <AppRouter />
          <SoundToggle />
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
