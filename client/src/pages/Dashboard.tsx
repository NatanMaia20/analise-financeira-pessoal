import { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import {
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  TrendingUp,
  TrendingDown,
  Calendar,
  Download,
  Upload,
  Wallet,
  PiggyBank,
  Users,
} from 'lucide-react';
import { CATEGORY_FLOW_LABELS, CATEGORY_FLOW_DESCRIPTIONS } from '@shared/category-rules';

type PeriodType = 'week' | 'month' | 'quarter' | 'year' | 'all';

const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: '0.5rem',
    color: 'var(--foreground)',
  },
  labelStyle: { color: 'var(--foreground)' },
  itemStyle: { color: 'var(--foreground)' },
};

const PIE_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--muted-foreground)',
];

function formatBRL(value: number | undefined | null): string {
  return (value ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

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
  const personalQuery = trpc.analysis.personalMetrics.useQuery(dateRange);
  const categoryGroupsQuery = trpc.analysis.categoryGroups.useQuery(dateRange);
  const categoryQuery = trpc.analysis.byCategory.useQuery(dateRange);
  const monthlySummaryQuery = trpc.analysis.monthlySummary.useQuery();
  const anomaliesQuery = trpc.analysis.anomalies.useQuery({ threshold: 2 });

  const metrics = metricsQuery.data;
  const personal = personalQuery.data;
  const categoryGroups = categoryGroupsQuery.data || [];
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

  const isLoading = metricsQuery.isLoading || categoryQuery.isLoading;
  const netBalance = metrics?.netBalance ?? 0;
  const personalBalance = personal?.personalNetBalance ?? 0;

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="animate-slideInFromTop">
        <div className="mb-6">
          <h1 className="text-4xl mb-2">Diário Financeiro</h1>
          <p className="text-muted-foreground text-lg">Bem-vindo, {user?.name || 'Usuário'}! Aqui está seu resumo financeiro.</p>
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

      {/* Key Metrics — total cash flow */}
      <div>
        <div className="section-header">
          <h2>Fluxo de Caixa</h2>
          <p>Tudo o que entrou e saiu da conta no período — inclui repasses a terceiros e investimentos.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Total Income */}
          <div className="metric-card metric-positive animate-slideInFromLeft">
            <div className="flex items-start justify-between">
              <div>
                <p className="metric-label">Receitas</p>
                <div className="metric-value income-amount">
                  R$ {formatBRL(metrics?.totalIncome)}
                </div>
              </div>
              <ArrowUpRight className="h-5 w-5 text-income" />
            </div>
            <div className="flex items-center gap-2 mt-4 text-xs">
              <span className="font-semibold text-income">+{(metrics?.savingsRate ?? 0).toFixed(1)}%</span>
              <span className="text-muted-foreground">economia (caixa)</span>
            </div>
          </div>

          {/* Total Expense */}
          <div className="metric-card metric-negative animate-slideInFromLeft" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="metric-label">Despesas</p>
                <div className="metric-value expense-amount">
                  R$ {formatBRL(metrics?.totalExpense)}
                </div>
              </div>
              <ArrowDownLeft className="h-5 w-5 text-expense" />
            </div>
            <div className="flex items-center gap-2 mt-4 text-xs">
              <span className="font-semibold text-expense">
                {((metrics?.totalExpense ?? 0) / (metrics?.totalIncome || 1) * 100).toFixed(1)}%
              </span>
              <span className="text-muted-foreground">da renda</span>
            </div>
          </div>

          {/* Net Balance */}
          <div className={`metric-card ${netBalance >= 0 ? 'metric-positive' : 'metric-negative'} animate-slideInFromLeft`} style={{ animationDelay: '0.2s' }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="metric-label">Saldo do Período</p>
                <div className={`metric-value ${netBalance >= 0 ? 'income-amount' : 'expense-amount'}`}>
                  R$ {formatBRL(metrics?.netBalance)}
                </div>
              </div>
              {netBalance >= 0 ? (
                <TrendingUp className="h-5 w-5 text-income" />
              ) : (
                <TrendingDown className="h-5 w-5 text-expense" />
              )}
            </div>
            <div className="mt-4">
              <span className={`stamp ${netBalance >= 0 ? 'text-income' : 'text-expense'}`}>
                {netBalance >= 0 ? 'Superávit' : 'Déficit'}
              </span>
            </div>
          </div>

          {/* Average Monthly */}
          <div className="metric-card animate-slideInFromLeft" style={{ animationDelay: '0.3s' }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="metric-label">Média Mensal</p>
                <div className="metric-value text-transfer">
                  R$ {formatBRL(metrics?.averageMonthlyIncome)}
                </div>
              </div>
              <Calendar className="h-5 w-5 text-transfer" />
            </div>
            <div className="flex items-center gap-2 mt-4 text-xs">
              <span className="font-semibold text-muted-foreground">Receita média / mês</span>
            </div>
          </div>
        </div>
      </div>

      {/* Visão Pessoal */}
      <div>
        <div className="section-header">
          <h2>Visão Pessoal</h2>
          <p>
            Sem transferências entre suas próprias contas, sem repasses/reembolsos de terceiros e sem
            o que foi separado para investimentos — só o que de fato é seu, entrando e saindo.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Personal Income */}
          <div className="metric-card metric-positive animate-slideInFromLeft">
            <div className="flex items-start justify-between">
              <div>
                <p className="metric-label">Receita Pessoal</p>
                <div className="metric-value income-amount">
                  R$ {formatBRL(personal?.personalIncome)}
                </div>
              </div>
              <Wallet className="h-5 w-5 text-income" />
            </div>
          </div>

          {/* Personal Expense */}
          <div className="metric-card metric-negative animate-slideInFromLeft" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="metric-label">Gasto Pessoal</p>
                <div className="metric-value expense-amount">
                  R$ {formatBRL(personal?.personalExpense)}
                </div>
              </div>
              <ArrowDownLeft className="h-5 w-5 text-expense" />
            </div>
          </div>

          {/* Personal Net Balance */}
          <div className={`metric-card ${personalBalance >= 0 ? 'metric-positive' : 'metric-negative'} animate-slideInFromLeft`} style={{ animationDelay: '0.2s' }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="metric-label">Saldo Pessoal</p>
                <div className={`metric-value ${personalBalance >= 0 ? 'income-amount' : 'expense-amount'}`}>
                  R$ {formatBRL(personal?.personalNetBalance)}
                </div>
              </div>
              {personalBalance >= 0 ? (
                <TrendingUp className="h-5 w-5 text-income" />
              ) : (
                <TrendingDown className="h-5 w-5 text-expense" />
              )}
            </div>
            <div className="flex items-center gap-2 mt-4 text-xs">
              <span className={`font-semibold ${personalBalance >= 0 ? 'text-income' : 'text-expense'}`}>
                {(personal?.personalSavingsRate ?? 0).toFixed(1)}%
              </span>
              <span className="text-muted-foreground">taxa de economia pessoal</span>
            </div>
          </div>

          {/* Investments */}
          <div className="metric-card animate-slideInFromLeft" style={{ animationDelay: '0.3s' }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="metric-label">Investido / Reserva</p>
                <div className="metric-value investment-amount">
                  R$ {formatBRL(personal?.investmentAmount)}
                </div>
              </div>
              <PiggyBank className="h-5 w-5 text-investment" />
            </div>
            <div className="flex items-center gap-2 mt-4 text-xs">
              <span className="font-semibold text-muted-foreground">Ex: BOLÃO, poupança</span>
            </div>
          </div>
        </div>
      </div>

      {/* Para onde vai o dinheiro + movimentações internas */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="chart-container animate-slideInFromLeft">
          <h3 className="chart-title">Para onde vai o dinheiro</h3>
          <p className="text-muted-foreground text-sm mb-4">Receitas e despesas por tipo de fluxo</p>
          <div className="space-y-3">
            {categoryGroups.length > 0 ? (
              categoryGroups.map(group => (
                <div key={group.flow} className="transaction-row flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="tag-pill">{CATEGORY_FLOW_LABELS[group.flow]}</span>
                    <p className="text-xs text-muted-foreground hidden sm:block truncate max-w-xs">
                      {CATEGORY_FLOW_DESCRIPTIONS[group.flow]}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-sm shrink-0">
                    {group.totalIncome > 0 && (
                      <span className="income-amount">+R$ {formatBRL(group.totalIncome)}</span>
                    )}
                    {group.totalExpense > 0 && (
                      <span className="expense-amount">-R$ {formatBRL(group.totalExpense)}</span>
                    )}
                    <span className="text-muted-foreground text-xs">{group.count} lanç.</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">Nenhum dado disponível</div>
            )}
          </div>
        </div>

        <div className="chart-container animate-slideInFromRight">
          <h3 className="chart-title">Movimentações Internas</h3>
          <p className="text-muted-foreground text-sm mb-4">{CATEGORY_FLOW_DESCRIPTIONS.internal_transfer}</p>
          <div className="flex flex-col items-center justify-center gap-4 py-6">
            <ArrowLeftRight className="h-8 w-8 text-transfer" />
            <div className="metric-value text-transfer">
              R$ {formatBRL(personal?.internalTransferTotal)}
            </div>
            <p className="metric-label">Transferido entre suas próprias contas</p>
          </div>
          {personal && (personal.thirdPartyExpense > 0 || personal.thirdPartyReimbursement > 0) && (
            <div className="divider !my-4" />
          )}
          {personal && (personal.thirdPartyExpense > 0 || personal.thirdPartyReimbursement > 0) && (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Saldo com terceiros</span>
              </div>
              <span className={personal.thirdPartyNet >= 0 ? 'income-amount' : 'expense-amount'}>
                {personal.thirdPartyNet >= 0 ? '+' : '-'}R$ {formatBRL(Math.abs(personal.thirdPartyNet))}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Monthly Trend */}
        <div className="chart-container animate-slideInFromLeft">
          <h3 className="chart-title">Evolução Mensal</h3>
          <p className="text-muted-foreground text-sm mb-4">Receitas vs Despesas</p>
          <div>
            {monthlyChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" stroke="var(--muted-foreground)" />
                  <YAxis stroke="var(--muted-foreground)" />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Legend />
                  <Line type="monotone" dataKey="income" stroke="var(--income)" strokeWidth={2} name="Receita" />
                  <Line type="monotone" dataKey="expense" stroke="var(--expense)" strokeWidth={2} name="Despesa" />
                  <Line type="monotone" dataKey="balance" stroke="var(--investment)" strokeWidth={2} name="Saldo" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Nenhum dado disponível
              </div>
            )}
          </div>
        </div>

        {/* Category Distribution */}
        <div className="chart-container animate-slideInFromRight">
          <h3 className="chart-title">Distribuição por Categoria</h3>
          <p className="text-muted-foreground text-sm mb-4">Top 6 categorias de despesa</p>
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
                    dataKey="value"
                  >
                    {categoryChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip {...TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
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
          <p className="text-muted-foreground text-sm mb-4">Maiores gastos por categoria</p>
          <div>
            {categoryAnalysis.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={categoryAnalysis.slice(0, 6)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="category" stroke="var(--muted-foreground)" angle={-45} textAnchor="end" height={80} />
                  <YAxis stroke="var(--muted-foreground)" />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Bar dataKey="total" fill="var(--expense)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Nenhum dado disponível
              </div>
            )}
          </div>
        </div>

        {/* Spending Anomalies */}
        <div className="chart-container animate-slideInFromRight">
          <h3 className="chart-title">Gastos Anômalos</h3>
          <p className="text-muted-foreground text-sm mb-4">Transações fora do padrão</p>
          <div>
            <div className="space-y-1">
              {anomalies.length > 0 ? (
                anomalies.slice(0, 5).map((anomaly, idx) => (
                  <div key={idx} className="transaction-row">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{anomaly.category}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(anomaly.date).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="expense-amount">
                          R$ {formatBRL(anomaly.amount)}
                        </p>
                        <p className="text-xs text-transfer">
                          {anomaly.deviation.toFixed(1)}σ acima da média
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
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
