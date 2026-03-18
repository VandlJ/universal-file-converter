import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import Page from "@/app/page";
import "@/app/globals.css";

export function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <Page />
      </TooltipProvider>
      <Toaster richColors position="bottom-right" />
    </ThemeProvider>
  );
}
