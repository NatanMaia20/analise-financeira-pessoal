import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { BarChart3, TrendingUp, Zap } from "lucide-react";

export default function Home() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return null; // Redirect to dashboard happens in App.tsx
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Navigation */}
      <nav className="border-b border-slate-700 bg-slate-900/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-8 h-8 text-green-500" />
            <span className="text-xl font-bold text-white">Análise Financeira</span>
          </div>
          <Button asChild>
            <a href={getLoginUrl()}>Entrar</a>
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-5xl font-bold text-white mb-6">
            Controle suas Finanças com Inteligência
          </h1>
          <p className="text-xl text-slate-300 mb-8">
            Dashboard moderno para análise financeira pessoal com gráficos interativos, 
            insights automáticos e assistente inteligente.
          </p>
          <Button size="lg" asChild className="bg-green-600 hover:bg-green-700">
            <a href={getLoginUrl()}>Começar Agora</a>
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-20">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-8">
            <TrendingUp className="w-12 h-12 text-green-500 mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Análise em Tempo Real</h3>
            <p className="text-slate-300">
              Visualize suas receitas, despesas e saldo com gráficos interativos e atualizações instantâneas.
            </p>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-8">
            <Zap className="w-12 h-12 text-yellow-500 mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Insights Automáticos</h3>
            <p className="text-slate-300">
              Receba análises automáticas com IA identificando padrões de gasto e oportunidades de economia.
            </p>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-8">
            <BarChart3 className="w-12 h-12 text-blue-500 mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Assistente Inteligente</h3>
            <p className="text-slate-300">
              Faça perguntas em linguagem natural sobre seus dados financeiros e obtenha respostas instantâneas.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-3xl font-bold text-white mb-6">
          Pronto para organizar suas finanças?
        </h2>
        <Button size="lg" asChild className="bg-green-600 hover:bg-green-700">
          <a href={getLoginUrl()}>Acessar Dashboard</a>
        </Button>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-700 bg-slate-900/50 py-8">
        <div className="container mx-auto px-4 text-center text-slate-400">
          <p>&copy; 2026 Sistema de Análise Financeira Pessoal. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
