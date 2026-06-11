import { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ArrowUpRight, ArrowDownLeft, TrendingUp, TrendingDown, Calendar, Download, Upload } from 'lucide-react';

type PeriodType = 'week' | 'month' | 'quarter' | 'year' | 'all';

export default function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [period, setPeriod] = useState<PeriodType>('month');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  // Calculate date range based on period
  const dateRange = useMemo(() => {
    const today = new Date();
    let start = new Date();

    switch (period) {
      case 'week':
        start.setDate(today.getDate() - 7);
        break;
      case 'month':
        start.setMonth(today.getMonth() - 1);
        break;
      case 'quarter':
        start.setMonth(today.getMonth() - 3);
        break;
      case 'year':
        start.setFullYear(today.getFullYear() - 1);
        break;
      case 'all':
        start = new Date('2000-01-01');
        break;
    }

    return {
      startDate: customStart || start.toISOString().split('T')[0],
      endDate: customEnd || today.toISOString().split('T')[0],
    };
  }, [period, customStart, customEnd]);

  // Fetch financial data
  const metricsQuery = trpc.analysis.metrics.useQuery(dateRange);
  const categoryQuery = trpc.analysis.byCategory.useQuery(dateRange);
  const monthlySummaryQuery = trpc.analysis.monthlySummary.useQuery();
  const anomaliesQuery = trpc.analysis.anomalies.useQuery({ threshold: 2 });

  const metrics = metricsQuery.data;
  const categoryAnalysis = categoryQuery.data || [];
  const monthlySummary = monthlySummaryQuery.data || [];
  const anomalies = anomaliesQuery.data || [];

  // Prepare chart data
  const categoryChartData = categoryAnalysis.slice(0, 6).map(cat => ({
    name: cat.category,
    value: cat.total,
    percentage: cat.percentage,
  }));

  const monthlyChartData = monthlySummary.map(month => ({
    month: `${month.month}/${month.year}`,
    income: month.income,
    expense: month.expense,
    balance: month.balance,
  }));

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  const isLoading = metricsQuery.isLoading || categoryQuery.isLoading;

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="animate-slideInFromTop">
        <div className="mb-6">
          <h1 className="text-4xl mb-2">Dashboard Financeiro</h1>
          <p className="text-slate-400 text-lg">Bem-vindo, {user?.name || 'Usuário'}! Aqui está seu resumo financeiro.</p>
        </div>
        
        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <Button
            onClick={() => setLocation('/import')}
            className="btn-primary"
          >
            <Upload className="h-4 w-4" />
            Importar XLSX
          </Button>

          <div className="flex gap-3 items-center">
            <Select value={period} onValueChange={(value) => setPeriod(value as PeriodType)}>
              <SelectTrigger className="w-48 select-base">
                <SelectValue placeholder="Selecione período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Última semana</SelectItem>
                <SelectItem value="month">Último mês</SelectItem>
                <SelectItem value="quarter">Último trimestre</SelectItem>
                <SelectItem value="year">Último ano</SelectItem>
                <SelectItem value="all">Todo período</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" className="btn-secondary">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Income */}
        <div className="metric-card metric-positive animate-slideInFromLeft">
          <div className="flex items-start justify-between">
            <div>
              <p className="metric-label">Receitas</p>
              <div className="metric-value text-green-400">
                R$ {metrics?.totalIncome.toFixed(2) || '0.00'}
              </div>
            </div>
            <ArrowUpRight className="h-5 w-5 text-green-400" />
          </div>
          <div className="flex items-center gap-2 mt-4 text-xs text-green-400">
            <span className="font-semibold">+{metrics?.savingsRate.toFixed(1) || '0'}%</span>
            <span className="text-slate-400">economia</span>
          </div>
        </div>

        {/* Total Expense */}
        <div className="metric-card metric-negative animate-slideInFromLeft" style={{animationDelay: '0.1s'}}>
          <div className="flex items-start justify-between">
            <div>
              <p className="metric-label">Despesas</p>
              <div className="metric-value text-red-400">
                R$ {metrics?.totalExpense.toFixed(2) || '0.00'}
              </div>
            </div>
            <ArrowDownLeft className="h-5 w-5 text-red-400" />
          </div>
          <div className="flex items-center gap-2 mt-4 text-xs text-red-400">
            <span className="font-semibold">{((metrics?.totalExpense || 0) / (metrics?.totalIncome || 1) * 100).toFixed(1)}%</span>
            <span className="text-slate-400">da renda</span>
          </div>
        </div>

        {/* Net Balance */}
        <div className={`metric-card ${(metrics?.netBalance || 0) >= 0 ? 'metric-positive' : 'metric-negative'} animate-slideInFromLeft`} style={{animationDelay: '0.2s'}}>
          <div className="flex items-start justify-between">
            <div>
              <p className="metric-label">Saldo Líquido</p>
              <div className={`metric-value ${(metrics?.netBalance || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                R$ {metrics?.netBalance.toFixed(2) || '0.00'}
              </div>
            </div>
            {(metrics?.netBalance || 0) >= 0 ? (
              <TrendingUp className="h-5 w-5 text-green-400" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-400" />
            )}
          </div>
          <div className={`flex items-center gap-2 mt-4 text-xs ${(metrics?.netBalance || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            <span className="font-semibold">{(metrics?.netBalance || 0) >= 0 ? 'Superávit' : 'Déficit'}</span>
          </div>
        </div>

        {/* Average Monthly */}
        <div className="metric-card animate-slideInFromLeft" style={{animationDelay: '0.3s'}}>
          <div className="flex items-start justify-between">
            <div>
              <p className="metric-label">Média Mensal</p>
              <div className="metric-value text-blue-400">
                R$ {metrics?.averageMonthlyIncome.toFixed(2) || '0.00'}
              </div>
            </div>
            <Calendar className="h-5 w-5 text-blue-400" />
          </div>
          <div className="flex items-center gap-2 mt-4 text-xs text-slate-400">
            <span className="font-semibold">Receita média</span>
          </div>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Monthly Trend */}
        <div className="chart-container animate-slideInFromLeft">
          <h3 className="chart-title">Evolução Mensal</h3>
          <p className="text-slate-400 text-sm mb-4">Receitas vs Despesas</p>
          <div>
            {monthlyChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '0.5rem',
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2} name="Receita" />
                  <Line type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2} name="Despesa" />
                  <Line type="monotone" dataKey="balance" stroke="#3b82f6" strokeWidth={2} name="Saldo" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-slate-400">
                Nenhum dado disponível
              </div>
            )}
          </div>
        </div>

        {/* Category Distribution */}
        <div className="chart-container animate-slideInFromRight">
          <h3 className="chart-title">Distribuição por Categoria</h3>
          <p className="text-slate-400 text-sm mb-4">Top 6 categorias de despesa</p>
          <div>
            {categoryChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percentage }) => `${name} ${percentage.toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {categoryChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '0.5rem',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-slate-400">
                Nenhum dado disponível
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Categories */}
        <div className="chart-container animate-slideInFromLeft">
          <h3 className="chart-title">Top Categorias</h3>
          <p className="text-slate-400 text-sm mb-4">Maiores gastos por categoria</p>
          <div>
            {categoryAnalysis.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={categoryAnalysis.slice(0, 6)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="category" stroke="hsl(var(--muted-foreground))" angle={-45} textAnchor="end" height={80} />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '0.5rem',
                    }}
                  />
                  <Bar dataKey="total" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-slate-400">
                Nenhum dado disponível
              </div>
            )}
          </div>
        </div>

        {/* Spending Anomalies */}
        <div className="chart-container animate-slideInFromRight">
          <h3 className="chart-title">Gastos Anômalos</h3>
          <p className="text-slate-400 text-sm mb-4">Transações fora do padrão</p>
          <div>
            <div className="space-y-3">
              {anomalies.length > 0 ? (
                anomalies.slice(0, 5).map((anomaly, idx) => (
                  <div key={idx} className="transaction-row">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{anomaly.category}</p>
                        <p className="text-sm text-slate-400">
                          {new Date(anomaly.date).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-red-400">
                          R$ {anomaly.amount.toFixed(2)}
                        </p>
                        <p className="text-xs text-yellow-400">
                          {anomaly.deviation.toFixed(1)}σ acima da média
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-400">
                  Nenhuma anomalia detectada
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
