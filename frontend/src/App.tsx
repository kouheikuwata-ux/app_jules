import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CreateCarteForm } from "@/components/features/CreateCarteForm"
import { CarteList } from "@/components/features/CarteList"
import { Button } from "./components/ui/button"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

function ThemeToggle() {
  const { setTheme, theme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
    >
      <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div className="min-h-screen bg-background text-foreground">
        <header className="bg-card shadow-md">
          <div className="container mx-auto px-4 py-2 flex justify-between items-center">
            <h1 className="text-2xl font-bold">VoiceInsight v3.0 Enhanced</h1>
            <ThemeToggle />
          </div>
        </header>

        <main className="container mx-auto p-4 md:p-8">
          <Tabs defaultValue="create-carte" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="create-carte">カルテ作成</TabsTrigger>
              <TabsTrigger value="carte-list">カルテ一覧</TabsTrigger>
            </TabsList>

            <TabsContent value="create-carte">
              <CreateCarteForm />
            </TabsContent>

            <TabsContent value="carte-list">
              <CarteList />
            </TabsContent>
          </Tabs>
        </main>
        <Toaster />
      </div>
    </ThemeProvider>
  )
}

export default App
