import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GenerateTab } from "@/components/generate-tab";
import { DecomposeTab } from "@/components/decompose-tab";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <div className="min-h-[100dvh] w-full flex flex-col bg-background text-foreground font-sans">
            <header className="border-b bg-card">
              <div className="container mx-auto px-4 h-14 flex items-center justify-between max-w-6xl">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 bg-primary rounded shadow-sm flex items-center justify-center font-mono text-primary-foreground text-sm font-bold border border-primary/20">D</div>
                  <h1 className="font-semibold tracking-tight text-sm">DDM Stream</h1>
                </div>
                <ThemeToggle />
              </div>
            </header>
            <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl">
              <Tabs defaultValue="generate" className="w-full">
                <TabsList className="grid w-full grid-cols-2 max-w-[400px] mb-8">
                  <TabsTrigger value="generate">Generate</TabsTrigger>
                  <TabsTrigger value="decompose">Decompose</TabsTrigger>
                </TabsList>
                <TabsContent value="generate" className="focus-visible:outline-none">
                  <GenerateTab />
                </TabsContent>
                <TabsContent value="decompose" className="focus-visible:outline-none">
                  <DecomposeTab />
                </TabsContent>
              </Tabs>
            </main>
          </div>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
