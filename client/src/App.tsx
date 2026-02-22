import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { LanguageProvider } from "@/hooks/use-language";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Basic from "@/pages/basic";
import LoginPage from "@/pages/login";
import AppRoute from "@/pages/app-route";
import ResetPassword from "@/pages/reset-password";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/basic" component={Basic} />
      <Route path="/login" component={LoginPage} />
      <Route path="/app" component={AppRoute} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <Router />
        <Toaster />
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
