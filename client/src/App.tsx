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
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { usePlayer } from "@/lib/game";

// Reads the hunter's profile once when the game loads, whichever page the player lands
// on (Aurelia and the not-found page don't read it themselves). The server renews the
// hunter's cookie on that read, and the pages that show the profile share this one answer.
function KeepHunterCookie() {
  usePlayer();
  return null;
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Hub} />
      <Route path="/voyages" component={Voyages} />
      <Route path="/expo" component={Expo} />
      <Route path="/diner" component={Diner} />
      <Route path="/bounties" component={BountyOffice} />
      {/* Keyed by bounty so moving between cases (e.g. back/forward) starts each one fresh */}
      <Route path="/bounty/:id">
        {(params) => <BountyPage key={params.id} />}
      </Route>
      <Route path="/aurelia" component={Aurelia} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    // Outermost, so a crash anywhere (sound button, toasts, providers) shows the
    // "try again" card rather than a blank page
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router hook={useHashLocation}>
            <KeepHunterCookie />
            <AppRouter />
            <SoundToggle />
          </Router>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
