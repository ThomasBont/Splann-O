import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Crown, Check } from "lucide-react";

export default function UpgradePage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-2xl mx-auto px-4 py-16">
        <h1 className="text-3xl font-display font-bold text-center mb-2">
          Splanno Pro
        </h1>
        <p className="text-muted-foreground text-center mb-12">
          Get more from your shared expenses
        </p>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <div className="rounded-xl border bg-card p-6">
            <h2 className="font-semibold text-lg mb-4">Free</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                3 events
              </li>
              <li className="flex gap-2">
                <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                20 people per plan
              </li>
              <li className="flex gap-2">
                <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                Export with watermark
              </li>
            </ul>
          </div>

          <div className="rounded-xl border-2 border-primary bg-primary/5 p-6 relative">
            <div className="absolute -top-2 right-4">
              <span className="text-xs font-medium bg-primary text-primary-foreground px-2 py-0.5 rounded">
                Pro
              </span>
            </div>
            <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              Pro
            </h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                Unlimited events
              </li>
              <li className="flex gap-2">
                <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                Unlimited participants
              </li>
              <li className="flex gap-2">
                <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                Export without watermark
              </li>
            </ul>
          </div>
        </div>

        <div className="text-center space-y-4">
          <p className="text-muted-foreground">
            Pro is coming soon. Join the waitlist or contact us to get early access.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild>
              <Link href="/app">Back to app</Link>
            </Button>
            <Button variant="outline" asChild>
              <a href="mailto:hello@splanno.app?subject=Pro%20waitlist">
                Join waitlist
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
