import { useState, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { Upload, CheckCircle, AlertCircle, FileUp } from 'lucide-react';
import { toast } from 'sonner';

export default function Import() {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = trpc.import.uploadFile.useMutation();
  const importHistoryQuery = trpc.import.history.useQuery();

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
      const base64 = Buffer.from(buffer).toString('base64');

      const result = await uploadMutation.mutateAsync({
        fileBuffer: base64,
        fileName: file.name,
      });

      if (result.success) {
        toast.success(`Importação concluída! ${result.totalRecords} transações adicionadas.`);
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        importHistoryQuery.refetch();
      } else {
        toast.error(`Erro na importação: ${result.error || result.errors?.join(', ')}`);
      }
    } catch (error) {
      toast.error('Erro ao processar arquivo');
      console.error(error);
    }
  };

  const importHistory = importHistoryQuery.data || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Importar Dados Financeiros</h1>
        <p className="text-slate-400">
          Faça upload do seu arquivo XLSX para importar transações
        </p>
      </div>

      {/* Upload Area */}
      <div className="chart-container">
        <h3 className="chart-title">Upload de Arquivo</h3>
        <p className="text-slate-400 text-sm mb-6">Selecione o arquivo GastosFinanceiros.xlsx do seu aplicativo financeiro</p>
        
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
            dragActive
              ? 'border-green-500 bg-green-500/10'
              : 'border-slate-700 hover:border-slate-600'
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
                <FileUp className="h-12 w-12 text-green-500" />
                <div>
                  <p className="font-semibold">{file.name}</p>
                  <p className="text-sm text-slate-400">
                    {(file.size / 1024).toFixed(2)} KB
                  </p>
                </div>
              </>
            ) : (
              <>
                <Upload className="h-12 w-12 text-slate-400" />
                <div>
                  <p className="font-semibold">Arraste seu arquivo aqui</p>
                  <p className="text-sm text-slate-400">
                    ou clique para selecionar
                  </p>
                </div>
              </>
            )}
          </div>

          <Button
            variant="outline"
            className="mt-4"
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
              className="flex-1"
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

      {/* Import History */}
      <div className="chart-container">
        <h3 className="chart-title">Histórico de Importações</h3>
        <p className="text-slate-400 text-sm mb-6">Últimas importações realizadas</p>
        
        {importHistory.length > 0 ? (
          <div className="space-y-3">
            {importHistory.map((imp) => (
              <div key={imp.id} className="transaction-row">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {imp.status === 'success' ? (
                      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
                    )}
                    <div>
                      <p className="font-medium">{imp.fileName}</p>
                      <p className="text-sm text-slate-400">
                        {new Date(imp.importedAt).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{imp.totalRecords} registros</p>
                    <p className={`text-sm ${imp.status === 'success' ? 'text-green-400' : 'text-red-400'}`}>
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
          <div className="text-center py-8 text-slate-400">
            Nenhuma importação realizada ainda
          </div>
        )}
      </div>
    </div>
  );
}
