import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { useTheme } from "@/contexts/ThemeContext";
import { BookOpen, LineChart, Sparkles, Moon, Sun, Wallet } from "lucide-react";

export default function Home() {
  const { isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  if (isAuthenticated) {
    return null; // Redirect to dashboard happens in App.tsx
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav className="border-b border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-sidebar-primary" />
            <span className="text-xl font-display font-semibold tracking-tight">Diário Financeiro</span>
          </div>
          <div className="flex items-center gap-2">
            {toggleTheme && (
              <button
                onClick={toggleTheme}
                className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-sidebar-accent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                aria-label={isDark ? "Mudar para tema claro" : "Mudar para tema escuro"}
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            )}
            <Button asChild className="btn-primary">
              <a href={getLoginUrl()}>Entrar</a>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="mb-6">
            Suas finanças, página por página
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Importe seus lançamentos, separe o que é seu do que é repasse ou investimento,
            e veja exatamente quanto sobra no fim do mês — sem letras miúdas.
          </p>
          <Button size="lg" asChild className="btn-primary">
            <a href={getLoginUrl()}>Começar Agora</a>
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-20">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="card-base p-8">
            <LineChart className="w-10 h-10 text-income mb-4" />
            <h3 className="mb-2">Visão Pessoal de Verdade</h3>
            <p className="text-muted-foreground">
              Transferências entre suas próprias contas, repasses a terceiros e investimentos ficam
              separados do seu saldo pessoal — sem inflar nem esconder números.
            </p>
          </div>

          <div className="card-base p-8">
            <Sparkles className="w-10 h-10 text-transfer mb-4" />
            <h3 className="mb-2">Insights Automáticos</h3>
            <p className="text-muted-foreground">
              Receba análises com IA identificando padrões de gasto, anomalias e oportunidades de economia.
            </p>
          </div>

          <div className="card-base p-8">
            <Wallet className="w-10 h-10 text-investment mb-4" />
            <h3 className="mb-2">Assistente Inteligente</h3>
            <p className="text-muted-foreground">
              Faça perguntas em linguagem natural sobre seus dados financeiros e obtenha respostas instantâneas.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h2 className="mb-6">
          Pronta para organizar suas finanças?
        </h2>
        <Button size="lg" asChild className="btn-primary">
          <a href={getLoginUrl()}>Acessar Dashboard</a>
        </Button>
      </section>

      {/* Footer */}
      <footer className="border-t border-sidebar-border bg-sidebar text-sidebar-foreground/70 py-8">
        <div className="container mx-auto px-4 text-center">
          <p>&copy; 2026 Diário Financeiro. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
