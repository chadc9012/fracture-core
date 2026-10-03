import { Button } from "@/components/ui/button";

/** In-game panel shown instead of a black canvas when 3D graphics are unavailable or lost. */
export function GraphicsError({ title, message, safari }: { title: string; message: string; safari: boolean }) {
  return (
    <div className="fixed inset-0 z-[210] grid place-items-center bg-background/95 p-4 backdrop-blur">
      <div className="max-w-md border border-destructive bg-card/90 p-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-destructive">Graphics offline</p>
        <h2 className="mt-2 text-lg font-semibold">{title}</h2>
        <p className="mt-2 text-xs text-muted-foreground">{message}</p>
        {safari && (
          <ol className="mt-3 list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
            <li>Update Safari / macOS to the latest version.</li>
            <li>Safari → Settings → Advanced → turn on "Show features for web developers", then in the Develop menu make sure WebGL is enabled.</li>
            <li>Turn off Lockdown Mode for this site if it is on.</li>
            <li>Close other heavy tabs, or try Chrome.</li>
          </ol>
        )}
        <p className="mt-3 text-xs text-muted-foreground">Your progress is saved.</p>
        <Button className="mt-4" onClick={() => window.location.reload()}>Try again</Button>
      </div>
    </div>
  );
}
