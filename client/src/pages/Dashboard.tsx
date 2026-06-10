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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button
            onClick={() => setLocation('/import')}
            size="lg"
            className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
          >
            <Upload className="h-4 w-4" />
            Importar XLSX
          </Button>
        </div>
        <div>
          <h1 className="text-3xl font-bold">Dashboard Financeiro</h1>
          <p className="text-slate-400">Bem-vindo, {user?.name || 'Usuário'}!</p>
        </div>

        {/* Period Selector */}
        <div className="flex gap-2">
          <Select value={period} onValueChange={(value) => setPeriod(value as PeriodType)}>
            <SelectTrigger className="w-40">
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
          <Button variant="outline" size="icon">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Income */}
        <Card className="metric-card metric-positive">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Receitas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="metric-value text-green-400">
              R$ {metrics?.totalIncome.toFixed(2) || '0.00'}
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs text-green-400">
              <ArrowUpRight className="h-3 w-3" />
              <span>+{metrics?.savingsRate.toFixed(1) || '0'}% de economia</span>
            </div>
          </CardContent>
        </Card>

        {/* Total Expense */}
        <Card className="metric-card metric-negative">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Despesas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="metric-value text-red-400">
              R$ {metrics?.totalExpense.toFixed(2) || '0.00'}
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs text-red-400">
              <ArrowDownLeft className="h-3 w-3" />
              <span>{((metrics?.totalExpense || 0) / (metrics?.totalIncome || 1) * 100).toFixed(1)}% da renda</span>
            </div>
          </CardContent>
        </Card>

        {/* Net Balance */}
        <Card className={`metric-card ${(metrics?.netBalance || 0) >= 0 ? 'metric-positive' : 'metric-negative'}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Saldo Líquido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`metric-value ${(metrics?.netBalance || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              R$ {metrics?.netBalance.toFixed(2) || '0.00'}
            </div>
            <div className={`flex items-center gap-2 mt-2 text-xs ${(metrics?.netBalance || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {(metrics?.netBalance || 0) >= 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              <span>
                {(metrics?.netBalance || 0) >= 0 ? 'Superávit' : 'Déficit'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Average Monthly */}
        <Card className="metric-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Média Mensal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="metric-value text-blue-400">
              R$ {metrics?.averageMonthlyIncome.toFixed(2) || '0.00'}
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
              <Calendar className="h-3 w-3" />
              <span>Receita média</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Monthly Trend */}
        <Card className="chart-container">
          <CardHeader>
            <CardTitle>Evolução Mensal</CardTitle>
            <CardDescription>Receitas vs Despesas</CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        {/* Category Distribution */}
        <Card className="chart-container">
          <CardHeader>
            <CardTitle>Distribuição por Categoria</CardTitle>
            <CardDescription>Top 6 categorias de despesa</CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Categories */}
        <Card className="chart-container">
          <CardHeader>
            <CardTitle>Top Categorias</CardTitle>
            <CardDescription>Maiores gastos por categoria</CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        {/* Spending Anomalies */}
        <Card className="chart-container">
          <CardHeader>
            <CardTitle>Gastos Anômalos</CardTitle>
            <CardDescription>Transações fora do padrão</CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
