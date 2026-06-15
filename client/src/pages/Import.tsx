import { useState, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { Upload, CheckCircle, AlertCircle, FileUp, Wand2 } from 'lucide-react';
import { toast } from 'sonner';

export default function Import() {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = trpc.import.uploadFile.useMutation();
  const importHistoryQuery = trpc.import.history.useQuery();
  const reclassifyMutation = trpc.import.reclassifyTransactions.useMutation();
  const utils = trpc.useUtils();

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFile(files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      handleFile(files[0]);
    }
  };

  const handleFile = (selectedFile: File) => {
    if (!selectedFile.name.endsWith('.xlsx')) {
      toast.error('Por favor, selecione um arquivo XLSX válido');
      return;
    }
    setFile(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Selecione um arquivo primeiro');
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      // Convert ArrayBuffer to base64 using browser API
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      const result = await uploadMutation.mutateAsync({
        fileBuffer: base64,
        fileName: file.name,
      });

      if (result.success) {
        toast.success(`Importação concluída! ${result.totalRecords} transações adicionadas.`);
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        importHistoryQuery.refetch();
        utils.analysis.invalidate();
      } else {
        const errorMessage = result.error || (result.errors && result.errors.length > 0 ? result.errors[0] : 'Erro desconhecido');
        console.error('[Import] Error details:', result);
        toast.error(`Erro na importação: ${errorMessage}`);

        if (result.errors && result.errors.length > 0) {
          console.error('[Import] All errors:', result.errors);
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[Import] Exception:', error);
      toast.error(`Erro ao processar arquivo: ${errorMsg}`);
    }
  };

  const handleReclassify = async () => {
    try {
      const result = await reclassifyMutation.mutateAsync();

      if (result.success) {
        const total = (result.expenseRowsUpdated ?? 0) + (result.incomeRowsUpdated ?? 0);
        if (total === 0) {
          toast.success('Tudo certo! Nenhuma transferência interna precisava ser corrigida.');
        } else {
          toast.success(
            `${total} lançamento(s) corrigido(s) (${result.categoriesAffected?.join(', ')}).`
          );
          utils.analysis.invalidate();
        }
      } else {
        toast.error(`Erro ao corrigir dados: ${result.error}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      toast.error(`Erro ao corrigir dados: ${errorMsg}`);
    }
  };

  const importHistory = importHistoryQuery.data || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl mb-1">Importar Dados Financeiros</h1>
        <p className="text-muted-foreground">
          Faça upload do seu arquivo XLSX para importar transações
        </p>
      </div>

      {/* Upload Area */}
      <div className="chart-container">
        <h3 className="chart-title">Upload de Arquivo</h3>
        <p className="text-muted-foreground text-sm mb-6">Selecione o arquivo Gastos_Financeiros.xlsx do seu aplicativo financeiro</p>

        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
            dragActive
              ? 'border-primary bg-primary/10'
              : 'border-border hover:border-ring'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            onChange={handleChange}
            className="hidden"
          />

          <div className="flex flex-col items-center gap-4">
            {file ? (
              <>
                <FileUp className="h-12 w-12 text-income" />
                <div>
                  <p className="font-semibold">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024).toFixed(2)} KB
                  </p>
                </div>
              </>
            ) : (
              <>
                <Upload className="h-12 w-12 text-muted-foreground" />
                <div>
                  <p className="font-semibold">Arraste seu arquivo aqui</p>
                  <p className="text-sm text-muted-foreground">
                    ou clique para selecionar
                  </p>
                </div>
              </>
            )}
          </div>

          <Button
            variant="outline"
            className="mt-4 btn-secondary"
            onClick={() => fileInputRef.current?.click()}
          >
            Selecionar Arquivo
          </Button>
        </div>

        {file && (
          <div className="mt-6 flex gap-3">
            <Button
              onClick={handleUpload}
              disabled={uploadMutation.isPending}
              className="flex-1 btn-primary"
            >
              {uploadMutation.isPending ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Importando...
                </>
              ) : (
                'Importar Arquivo'
              )}
            </Button>
            <Button
              variant="outline"
              className="btn-secondary"
              onClick={() => {
                setFile(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
            >
              Cancelar
            </Button>
          </div>
        )}
      </div>

      {/* Fix already-imported data */}
      <div className="chart-container">
        <h3 className="chart-title">Corrigir Dados Já Importados</h3>
        <p className="text-muted-foreground text-sm mb-6">
          Lançamentos com categorias de transferência entre suas próprias contas (ex: "Transf. Entre Contas")
          que foram importados antes dessa correção contam como gasto ou receita real, inflando seus totais.
          Use o botão abaixo para reclassificá-los como transferências internas — sem precisar reenviar a planilha.
        </p>
        <Button
          onClick={handleReclassify}
          disabled={reclassifyMutation.isPending}
          className="btn-secondary"
        >
          {reclassifyMutation.isPending ? (
            <>
              <Spinner className="mr-2 h-4 w-4" />
              Corrigindo...
            </>
          ) : (
            <>
              <Wand2 className="h-4 w-4" />
              Corrigir Dados Importados
            </>
          )}
        </Button>
      </div>

      {/* Import History */}
      <div className="chart-container">
        <h3 className="chart-title">Histórico de Importações</h3>
        <p className="text-muted-foreground text-sm mb-6">Últimas importações realizadas</p>

        {importHistory.length > 0 ? (
          <div className="space-y-1">
            {importHistory.map((imp) => (
              <div key={imp.id} className="transaction-row">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {imp.status === 'success' ? (
                      <CheckCircle className="h-5 w-5 text-income mt-0.5" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-expense mt-0.5" />
                    )}
                    <div>
                      <p className="font-medium">{imp.fileName}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(imp.importedAt).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{imp.totalRecords} registros</p>
                    <p className={`text-sm ${imp.status === 'success' ? 'text-income' : 'text-expense'}`}>
                      {imp.status === 'success' ? 'Sucesso' : 'Erro'}
                    </p>
                  </div>
                </div>
                {imp.errorMessage && (
                  <Alert className="mt-2" variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{imp.errorMessage}</AlertDescription>
                  </Alert>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma importação realizada ainda
          </div>
        )}
      </div>
    </div>
  );
}
